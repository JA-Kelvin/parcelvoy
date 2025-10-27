import { PassThrough } from 'stream'
import App from '../app'
import { cacheSet } from '../config/redis'
import { chunk, uuid } from '../utilities'
import { CampaignSend } from './Campaign'
import Storage from '../storage/Storage'
import { Job } from '../queue'

export type ExportFormat = 'csv' | 'ndjson'

export interface CampaignExportJobParams {
    project_id: number
    campaign_id: number
    export_id: string
    format: ExportFormat
    state: string
    path: string
    file_name: string
}

export interface CampaignExportStatus {
    state: 'queued' | 'running' | 'completed' | 'failed'
    processed: number
    total: number
    percent: number
    format: ExportFormat
    url?: string
    path: string
    file_name: string
    created_at: string
    finished_at?: string
    error?: string
}

export const exportStatusKey = (p: number, c: number, e: string) => `export:campaign:${p}:${c}:${e}:status`

export default class CampaignExportJob extends Job {
    static $name = 'campaign_export_job'

    static from({ project_id, campaign_id, format, state }: { project_id: number, campaign_id: number, format: ExportFormat, state: string }) {
        const export_id = uuid()
        const ext = format === 'ndjson' ? 'ndjson' : 'csv'
        const file_name = `campaign_${campaign_id}_${state}_${export_id}.${ext}`
        const path = `exports/${project_id}/${file_name}`
        return new this({ project_id, campaign_id, export_id, format, state, path, file_name })
            .deduplicationKey(`export:${project_id}:${campaign_id}:${format}:${state}:${export_id}`)
    }

    static async handler({ project_id, campaign_id, export_id, format, state, path, file_name }: CampaignExportJobParams) {
        const redis = App.main.redis
        const storage = App.main.storage
        const ttl = 60 * 60 * 24 // 24h

        const key = exportStatusKey(project_id, campaign_id, export_id)
        const startStatus: CampaignExportStatus = {
            state: 'running',
            processed: 0,
            total: 0,
            percent: 0,
            format,
            path,
            file_name,
            created_at: new Date().toISOString(),
        }
        await cacheSet(redis, key, startStatus, ttl)

        const qb = CampaignSend.query()
            .join('users', 'users.id', 'campaign_sends.user_id')
            .where('campaign_sends.campaign_id', campaign_id)
            .where('users.project_id', project_id)
            .modify((qb) => {
                if (state) qb.where('campaign_sends.state', state)
            })
            .select(
                'users.id as user_id',
                'users.external_id',
                'users.email',
                'users.phone',
                'campaign_sends.state',
                'campaign_sends.send_at',
                'campaign_sends.opened_at',
                'campaign_sends.clicks',
            )

        const totalRow = await qb.clone().clearSelect().count<{ c: number }[]>({ c: '*' }).first()
        const total = Number((totalRow as any)?.c ?? 0)
        await cacheSet(redis, key, { ...startStatus, total }, ttl)

        const content = new PassThrough()
        const uploadPromise = storage.upload({ stream: content, url: path })

        if (format === 'csv') {
            content.write('\uFEFFuser_id,external_id,email,phone,state,send_at,opened_at,clicks\n')
        }

        let processed = 0
        const writeCsv = (rows: any[]) => {
            for (const row of rows) {
                const vals = [
                    row.user_id,
                    row.external_id ?? '',
                    row.email ?? '',
                    row.phone ?? '',
                    row.state ?? '',
                    row.send_at ? new Date(row.send_at).toISOString() : '',
                    row.opened_at ? new Date(row.opened_at).toISOString() : '',
                    row.clicks ?? 0,
                ]
                const esc = (v: any) => {
                    if (v == null) return ''
                    const s = String(v)
                    return (s.includes('"') || s.includes(',') || s.includes('\n'))
                        ? '"' + s.replace(/"/g, '""') + '"'
                        : s
                }
                content.write(vals.map(esc).join(',') + '\n')
            }
        }
        const writeNdjson = (rows: any[]) => {
            for (const row of rows) {
                content.write(JSON.stringify(row) + '\n')
            }
        }

        try {
            const batchSize = 1000
            await chunk<any>(qb, batchSize, async (rows) => {
                if (format === 'ndjson') writeNdjson(rows)
                else writeCsv(rows)
                processed += rows.length
                const percent = total > 0 ? Math.round((processed / total) * 100) : 0
                await cacheSet(redis, key, { ...startStatus, total, processed, percent }, ttl)
            })
            content.end()
            await uploadPromise
            const finalUrl = Storage.url(path)
            await cacheSet(redis, key, { ...startStatus, total, processed, percent: 100, state: 'completed', finished_at: new Date().toISOString(), url: finalUrl }, ttl)
        } catch (error: any) {
            content.destroy(error)
            await cacheSet(redis, key, { ...startStatus, total, processed, percent: total ? Math.round((processed / total) * 100) : 0, state: 'failed', error: error?.message }, ttl)
            throw error
        }
    }
}
