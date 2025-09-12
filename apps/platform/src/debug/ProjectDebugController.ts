import Router from '@koa/router'
import { ProjectState } from '../auth/AuthMiddleware'
import { searchParamsSchema } from '../core/searchParams'
import { extractQueryParams } from '../utilities'
import Campaign from '../campaigns/Campaign'
import { campaignDeliveryProgress, campaignSendReadyQuery } from '../campaigns/CampaignService'
import { Job } from '../queue'
import App from '../app'
import CampaignEnqueueSendsJob from '../campaigns/CampaignEnqueueSendsJob'
import CampaignGenerateListJob from '../campaigns/CampaignGenerateListJob'
import JourneyStatsJob from '../journey/JourneyStatsJob'
import Journey from '../journey/Journey'
import JourneyDelayJob from '../journey/JourneyDelayJob'
import JourneyProcessJob from '../journey/JourneyProcessJob'
import JourneyUserStep from '../journey/JourneyUserStep'

const router = new Router<ProjectState & { campaign?: Campaign }>({
    prefix: '/debug',
})

// List campaigns with state and delivery
router.get('/campaigns', async (ctx) => {
    const params = extractQueryParams(ctx.query, searchParamsSchema)
    const page = await Campaign.search(
        { ...params, fields: ['name'] },
        b => b.where('project_id', ctx.state.project.id).whereNull('deleted_at').orderBy('id', 'desc')
    )
    const rows = await Promise.all((page.results ?? []).map(async (c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        state: c.state,
        send_at: c.send_at,
        delivery: c.delivery,
        deliveryLive: await campaignDeliveryProgress(c.id),
    })))
    ctx.body = { limit: page.limit, nextCursor: page.nextCursor, prevCursor: page.prevCursor, count: rows.length, results: rows }
})

// Campaign diagnostics
router.get('/campaigns/:campaignId/diagnostics', async (ctx) => {
    const id = parseInt(ctx.params.campaignId, 10)
    const c = await Campaign.find(id, qb => qb.where('project_id', ctx.state.project.id))
    if (!c) { ctx.throw(404); return }

    const delivery = await campaignDeliveryProgress(id)

    // Ready-to-send now (pending+throttled and <= NOW())
    const ready = await campaignSendReadyQuery(id, true).count<{ c: number }[]>({ c: '*' }).first()

    ctx.body = {
        id: c.id,
        name: c.name,
        state: c.state,
        channel: c.channel,
        send_at: c.send_at,
        delivery,
        ready_now: Number((ready as any)?.c ?? 0),
    }
})

// Re-kick a campaign: enqueue generate (if loading) and enqueue sends pass
router.post('/campaigns/:campaignId/rekick', async (ctx) => {
    const id = parseInt(ctx.params.campaignId, 10)
    const c = await Campaign.find(id, qb => qb.where('project_id', ctx.state.project.id))
    if (!c) { ctx.throw(404); return }

    const jobs: Job[] = []
    if (c.state === 'loading') {
        jobs.push(CampaignGenerateListJob.from({ id: c.id, project_id: c.project_id }))
    }
    jobs.push(CampaignEnqueueSendsJob.from({ id: c.id, project_id: c.project_id }))
    await App.main.queue.enqueueBatch(jobs)
    ctx.status = 204
})

// Journey overview
router.get('/journeys', async (ctx) => {
    const journeys = await Journey.all(q => q.where('project_id', ctx.state.project.id).whereNull('deleted_at'))
    ctx.body = journeys.map(j => ({ id: j.id, name: j.name, status: (j as any).status, stats_at: (j as any).stats_at }))
})

// Journey stats refresh and delay kick
router.post('/journeys/:journeyId/rekick', async (ctx) => {
    const id = parseInt(ctx.params.journeyId, 10)
    const exists = await Journey.exists(q => q.where('id', id).where('project_id', ctx.state.project.id).whereNull('deleted_at'))
    if (!exists) { ctx.throw(404); return }
    await App.main.queue.enqueue(JourneyStatsJob.from(id))
    await App.main.queue.enqueue(JourneyDelayJob.from(id))
    ctx.status = 204
})

// Journey pending counts
router.get('/journeys/:journeyId/diagnostics', async (ctx) => {
    const id = parseInt(ctx.params.journeyId, 10)
    const counts = await JourneyUserStep.query()
        .select(JourneyUserStep.raw("SUM(type='pending') as pending, SUM(type='delay') as delay, SUM(type='error') as error, SUM(type='completed') as completed"))
        .where('journey_id', id)
        .first()
    ctx.body = {
        pending: Number((counts as any)?.pending ?? 0),
        delay: Number((counts as any)?.delay ?? 0),
        error: Number((counts as any)?.error ?? 0),
        completed: Number((counts as any)?.completed ?? 0),
    }
})

// Force process a single entrance (by JourneyUserStep id)
router.post('/journeys/entrances/:entranceId/process', async (ctx) => {
    const entranceId = parseInt(ctx.params.entranceId, 10)
    await App.main.queue.enqueue(JourneyProcessJob.from({ entrance_id: entranceId }))
    ctx.status = 204
})

export default router
