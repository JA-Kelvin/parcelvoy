import Router from '@koa/router'
import { JSONSchemaType } from 'ajv'
import { ProjectState } from '../auth/AuthMiddleware'
import { projectRoleMiddleware } from '../projects/ProjectService'
import { extractQueryParams } from '../utilities'
import { SearchSchema } from '../core/searchParams'
import { CampaignSendEvent } from './CampaignSendEvent'

const router = new Router<ProjectState>({ prefix: '/send-logs' })

router.use(projectRoleMiddleware('editor'))

const searchSchema = SearchSchema('sendLogSearch', {
    sort: 'id',
    direction: 'desc',
})

router.get('/', async ctx => {
    const params = extractQueryParams(ctx.query, searchSchema)
    const filter = params.filter || {}

    ctx.body = await CampaignSendEvent.search(
        { ...params, fields: ['provider_message_id', 'event', 'channel'] },
        qb => qb
            .where('project_id', ctx.state.project.id)
            .when(!!filter.channel, q => q.where('channel', filter.channel))
            .when(!!filter.event, q => q.where('event', filter.event))
            .when(!!filter.campaign_id, q => q.where('campaign_id', filter.campaign_id))
            .when(!!filter.user_id, q => q.where('user_id', filter.user_id))
            .when(!!filter.provider_message_id, q => q.where('provider_message_id', filter.provider_message_id))
            .when(!!filter.reference_type, q => q.where('reference_type', filter.reference_type))
            .when(!!filter.reference_id, q => q.where('reference_id', filter.reference_id))
            .when(!!filter.from, q => q.where('created_at', '>=', new Date(filter.from)))
            .when(!!filter.to, q => q.where('created_at', '<=', new Date(filter.to))),
    )
})

const exportSchema: JSONSchemaType<{ format?: 'csv' | 'ndjson'; filter?: Record<string, any> }> = {
    $id: 'sendLogExport',
    type: 'object',
    required: [],
    properties: {
        format: { type: 'string', enum: ['csv', 'ndjson'], nullable: true },
        filter: { type: 'object', nullable: true },
    },
}

router.get('/export', async ctx => {
    const { format = 'ndjson', filter = {} } = extractQueryParams(ctx.query, exportSchema)

    const qb = CampaignSendEvent.build(q => q
        .where('project_id', ctx.state.project.id)
        .when(!!filter.channel, q => q.where('channel', filter.channel))
        .when(!!filter.event, q => q.where('event', filter.event))
        .when(!!filter.campaign_id, q => q.where('campaign_id', filter.campaign_id))
        .when(!!filter.user_id, q => q.where('user_id', filter.user_id))
        .when(!!filter.provider_message_id, q => q.where('provider_message_id', filter.provider_message_id))
        .when(!!filter.reference_type, q => q.where('reference_type', filter.reference_type))
        .when(!!filter.reference_id, q => q.where('reference_id', filter.reference_id))
        .when(!!filter.from, q => q.where('created_at', '>=', new Date(filter.from)))
        .when(!!filter.to, q => q.where('created_at', '<=', new Date(filter.to)))
        .orderBy('id', 'desc'))

    const filename = `send_logs_${ctx.state.project.id}_${Date.now()}.${format === 'csv' ? 'csv' : 'ndjson'}`
    ctx.set('Content-Disposition', `attachment; filename="${filename}"`)

    if (format === 'csv') {
        ctx.type = 'text/csv'
        const rows: any[] = await qb
        const header = ['id','created_at','channel','event','campaign_id','user_id','provider_message_id','reference_type','reference_id'].join(',')
        const lines = [header, ...rows.map((r: any) => [
            r.id,
            r.created_at?.toISOString?.() || r.created_at,
            r.channel,
            r.event,
            r.campaign_id,
            r.user_id,
            (r.provider_message_id ?? '').toString().replaceAll('"', '""'),
            r.reference_type ?? '',
            r.reference_id ?? '',
        ].join(','))]
        ctx.body = lines.join('\n')
    } else {
        ctx.type = 'application/x-ndjson'
        const rows: any[] = await qb
        ctx.body = rows.map((r: any) => JSON.stringify(r)).join('\n')
    }
})

export default router
