import App from '../app'
import { DefaultRedis } from '../config/redis'
import Provider from './Provider'
import { logger } from '../config/logger'

export const PROVIDER_INVALIDATION_CHANNEL = 'providers:invalidate'

export type ProviderInvalidationMessage = {
    id: number
    project_id: number
    group: string
    reset_rate_limit?: boolean
}

export async function publishProviderInvalidation(app: App, msg: ProviderInvalidationMessage) {
    try {
        await app.redis.publish(PROVIDER_INVALIDATION_CHANNEL, JSON.stringify(msg))
    } catch (err) {
        logger.error({ err, msg }, 'failed to publish provider invalidation')
    }
}

export function setupProviderInvalidationSubscriber(app: App) {
    const sub = DefaultRedis(app.env.redis)
    sub.subscribe(PROVIDER_INVALIDATION_CHANNEL).then(() => {
        logger.info({ channel: PROVIDER_INVALIDATION_CHANNEL }, 'subscribed to provider invalidation')
    }).catch(err => logger.error({ err }, 'failed subscribing to provider invalidation'))

    sub.on('message', async (channel, payload) => {
        if (channel !== PROVIDER_INVALIDATION_CHANNEL) return
        try {
            const msg = JSON.parse(payload) as ProviderInvalidationMessage
            // Invalidate in-memory caches
            app.remove(Provider.cacheKey.internal(msg.id))
            app.remove(Provider.cacheKey.default(msg.project_id, msg.group))
            // Optionally reset rate limiter window for this provider
            if (msg.reset_rate_limit) {
                const key = `ratelimit-${msg.id}`
                await app.redis.del(key)
            }
            logger.info({ msg }, 'provider cache invalidated')
        } catch (err) {
            logger.error({ err, payload }, 'failed to handle provider invalidation message')
        }
    })

    // Store on app for lifecycle management (optional)
    ;(app as any).redisProviderSub = sub
}
