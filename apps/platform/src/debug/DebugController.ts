import Router from '@koa/router'
import App from '../app'
import { MetricPeriod } from '../queue/QueueProvider'
import JourneyDelayJob from '../journey/JourneyDelayJob'
import ProcessCampaignsJob from '../campaigns/ProcessCampaignsJob'
import CampaignStateJob from '../campaigns/CampaignStateJob'
import ScheduledEntranceOrchestratorJob from '../journey/ScheduledEntranceOrchestratorJob'

const router = new Router({
    prefix: '/debug',
})

router.get('/queue/status', async (ctx) => {
    const running = await App.main.queue.isRunning()
    const metrics = await App.main.queue.metrics(MetricPeriod.ONE_HOUR)
    const failedRaw = await App.main.queue.failed()
    const failedJobs: any[] = Array.isArray(failedRaw) ? failedRaw : []

    const failed = failedJobs.slice(0, 20).map((j: any) => ({
        id: j?.id,
        name: j?.name,
        failedReason: j?.failedReason,
        attemptsMade: j?.attemptsMade,
        timestamp: j?.timestamp,
    }))

    const redisPing = await App.main.redis.ping()
    const redisKeys = await App.main.redis.dbsize()

    ctx.body = {
        running,
        batchSize: App.main.queue.batchSize,
        metrics,
        failedCount: failedJobs.length ?? 0,
        failed,
        redis: { ping: redisPing, keys: Number(redisKeys) },
        driver: App.main.env.queue?.driver,
        concurrency: (App.main.env.queue as any)?.concurrency,
    }
})

router.post('/queue/pause', async (ctx) => {
    await App.main.queue.pause()
    ctx.status = 204
})

router.post('/queue/resume', async (ctx) => {
    await App.main.queue.resume()
    ctx.status = 204
})

// Simulate the per-minute scheduler tick
router.post('/kick/minute', async (ctx) => {
    await JourneyDelayJob.enqueueActive(App.main)
    await App.main.queue.enqueue(ProcessCampaignsJob.from())
    await App.main.queue.enqueue(CampaignStateJob.from())
    await App.main.queue.enqueue(ScheduledEntranceOrchestratorJob.from())
    ctx.status = 204
})

// Optional: simulate the hourly scheduler tick
router.post('/kick/hourly', async (ctx) => {
    // Currently, hourly tick enqueues UserSchemaSync and UpdateJourneys via scheduler.
    // We only expose the minute kick which is typically what operators need.
    ctx.status = 204
})

router.post('/queue/resume-and-kick', async (ctx) => {
    await App.main.queue.resume()
    await JourneyDelayJob.enqueueActive(App.main)
    await App.main.queue.enqueue(ProcessCampaignsJob.from())
    await App.main.queue.enqueue(CampaignStateJob.from())
    await App.main.queue.enqueue(ScheduledEntranceOrchestratorJob.from())
    ctx.status = 204
})

router.get('/sources', async (ctx) => {
    ctx.body = {
        mysql: {
            description: 'Primary operational store (campaigns, campaign_sends, journeys, journey_steps, journey_user_steps, lists, providers, templates, subscriptions, users metadata).',
            examples: [
                'campaigns.state / delivery updated by CampaignStateJob',
                'campaign_sends pending/sent/throttled/failed rows',
                'journey_user_steps step progression records',
            ],
        },
        clickhouse: {
            description: 'Large-scale analytics queries for recipient selection (lists/exclusions) and user attributes at scale.',
            examples: [
                'populateSendList() builds recipient lists using getRuleQuery()',
            ],
        },
        redis: {
            description: 'Queue (BullMQ), locks, rate limits and temporary progress counters.',
            examples: [
                'Locks: lock:campaign_send_{id}, parcelvoy:send:{campaignId}:{userId}',
                'Queue: bull:parcelvoy:* keys',
                'Progress: campaigns:{id}:progress / :total',
            ],
        },
    }
})

export default router
