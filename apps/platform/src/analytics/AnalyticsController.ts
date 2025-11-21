import Router from '@koa/router'
import { ProjectState } from '../auth/AuthMiddleware'
import { Context } from 'koa'
import { CampaignSend } from '../campaigns/Campaign'
import { CampaignSendEvent } from '../campaigns/CampaignSendEvent'

const router = new Router<ProjectState>({ prefix: '/analytics' })

function parseDate(input?: string | string[]): Date | undefined {
    if (!input) return undefined
    const s = Array.isArray(input) ? input[0] : input
    const d = new Date(s)
    return isNaN(d.getTime()) ? undefined : d
}

function parseBucketSeconds(input?: string | string[], rangeMs?: number): number {
    if (!input && rangeMs != null) {
        if (rangeMs <= 60 * 60 * 1000) return 60 // 1 minute
        if (rangeMs <= 24 * 60 * 60 * 1000) return 5 * 60 // 5 minutes
        return 10 * 60 // 10 minutes
    }
    if (!input) return 60
    const s = Array.isArray(input) ? input[0] : input
    // Accept numeric seconds or tokens like 5m, 60m, 1d, 2d
    const sec = Number(s)
    if (!isNaN(sec) && sec > 0) return Math.max(1, Math.floor(sec))
    const m = /^([0-9]+)\s*([smhd])$/.exec(s.trim())
    if (!m) return 60
    const n = parseInt(m[1], 10)
    const unit = m[2]
    if (unit === 's') return n
    if (unit === 'm') return n * 60
    if (unit === 'h') return n * 3600
    if (unit === 'd') return n * 86400
    return 60
}

router.get('/blast-performance', async (ctx: Context & { state: ProjectState }) => {
    const projectId = ctx.state.project.id

    const now = new Date()
    let from = parseDate(ctx.query.from) ?? new Date(now.getTime() - 60 * 60 * 1000)
    let to = parseDate(ctx.query.to) ?? now

    // Cap range to 2 days
    const maxMs = 2 * 24 * 60 * 60 * 1000
    if (to.getTime() - from.getTime() > maxMs) {
        from = new Date(to.getTime() - maxMs)
    }

    const rangeMs = to.getTime() - from.getTime()
    const bucketSeconds = parseBucketSeconds(ctx.query.bucket, rangeMs)

    const channelsParam = ctx.query.channels
    const channels = (Array.isArray(channelsParam) ? channelsParam : (channelsParam ? [channelsParam] : []))
        .filter(Boolean) as Array<'email' | 'text' | 'push' | 'webhook' | 'in_app'>

    const typesParam = ctx.query.type || ctx.query.types
    const types = (Array.isArray(typesParam) ? typesParam : (typesParam ? [typesParam] : []))
        .filter(Boolean) as Array<'blast' | 'trigger'>

    const source = Array.isArray((ctx.query as any).source) ? (ctx.query as any).source[0] : (ctx.query as any).source

    let rows: any[] = []
    if (source === 'logs') {
        const qb = CampaignSendEvent.query()
            .join('campaigns', 'campaigns.id', 'campaign_send_events.campaign_id')
            .where('campaign_send_events.project_id', projectId)
            .where('campaign_send_events.created_at', '>=', from)
            .where('campaign_send_events.created_at', '<=', to)
        if (channels.length > 0) qb.whereIn('campaign_send_events.channel', channels)
        if (types.length > 0) qb.whereIn('campaigns.type', types)

        rows = await qb
            .select(
                CampaignSendEvent.raw(`FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP(campaign_send_events.created_at)/${bucketSeconds}) * ${bucketSeconds}) AS bucket`),
                'campaign_send_events.channel as channel',
                CampaignSendEvent.raw("CASE WHEN campaign_send_events.event IN ('opened','clicked','complained') THEN NULL ELSE campaign_send_events.event END AS status"),
                CampaignSendEvent.raw('COUNT(*) as count'),
                CampaignSendEvent.raw("SUM(CASE WHEN campaign_send_events.event = 'opened' THEN 1 ELSE 0 END) as opens"),
                CampaignSendEvent.raw("SUM(CASE WHEN campaign_send_events.event = 'clicked' THEN 1 ELSE 0 END) as clicks"),
            )
            .groupBy('bucket', 'channel', 'status')
            .havingNotNull('status')
            .orderBy('bucket', 'asc') as any[]
    } else {
        const qb = CampaignSend.query()
            .join('campaigns', 'campaigns.id', 'campaign_sends.campaign_id')
            .where('campaigns.project_id', projectId)
            .whereRaw('COALESCE(campaign_sends.sent_at, campaign_sends.send_at) >= ?', [from])
            .whereRaw('COALESCE(campaign_sends.sent_at, campaign_sends.send_at) <= ?', [to])
        if (channels.length > 0) qb.whereIn('campaigns.channel', channels)
        if (types.length > 0) qb.whereIn('campaigns.type', types)

        rows = await qb
            .select(
                CampaignSend.raw(`FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP(COALESCE(campaign_sends.sent_at, campaign_sends.send_at))/${bucketSeconds}) * ${bucketSeconds}) AS bucket`),
                'campaigns.channel as channel',
                CampaignSend.raw("CASE WHEN campaign_sends.state = 'pending' AND COALESCE(campaign_sends.sent_at, campaign_sends.send_at) > NOW() THEN 'Upcoming' ELSE campaign_sends.state END AS status"),
                CampaignSend.raw('COUNT(*) as count'),
                CampaignSend.raw('SUM(CASE WHEN campaign_sends.opened_at IS NOT NULL THEN 1 ELSE 0 END) as opens'),
                CampaignSend.raw('SUM(CASE WHEN campaign_sends.clicks > 0 THEN 1 ELSE 0 END) as clicks'),
            )
            .groupBy('bucket', 'channel', 'status')
            .orderBy('bucket', 'asc') as any[]
    }

    // Optional quick KPIs per channel
    const kpiMap: Record<string, any> = {}
    for (const r of rows as Array<any>) {
        const key = r.channel
        if (!kpiMap[key]) {
            kpiMap[key] = { sent: 0, pending: 0, throttled: 0, failed: 0, bounced: 0, aborted: 0, upcoming: 0, opens: 0, clicks: 0, total: 0 }
        }
        const s = String(r.status).toLowerCase()
        if (s === 'upcoming') kpiMap[key].upcoming += Number(r.count)
        else if (kpiMap[key][s] != null) kpiMap[key][s] += Number(r.count)
        kpiMap[key].opens += Number(r.opens)
        kpiMap[key].clicks += Number(r.clicks)
        kpiMap[key].total += Number(r.count)
    }

    // Rates
    for (const ch of Object.keys(kpiMap)) {
        const k = kpiMap[ch]
        k.successRate = k.total > 0 ? (k.sent / k.total) : 0
        k.openRate = k.sent > 0 ? (k.opens / k.sent) : 0
        k.clickRate = k.sent > 0 ? (k.clicks / k.sent) : 0
    }

    ctx.body = {
        series: (rows as Array<any>).map(r => ({
            bucket: new Date(r.bucket).toISOString(),
            channel: r.channel,
            status: r.status,
            count: Number(r.count),
            opens: Number(r.opens),
            clicks: Number(r.clicks),
        })),
        kpisByChannel: kpiMap,
        meta: {
            from: from.toISOString(),
            to: to.toISOString(),
            bucketSeconds,
            channels: channels.length ? channels : undefined,
            types: types.length ? types : undefined,
        },
    }
})

export default router
