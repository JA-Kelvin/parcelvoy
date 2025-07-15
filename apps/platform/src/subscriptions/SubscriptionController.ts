import Router from '@koa/router'
import App from '../app'
import { RequestError } from '../core/errors'
import { JSONSchemaType, validate } from '../core/validate'
import Subscription, { SubscriptionParams, SubscriptionState, SubscriptionUpdateParams, UserSubscription } from './Subscription'
import { createSubscription, getSubscription, getUserSubscriptions, pagedSubscriptions, toggleSubscription, unsubscribe, updateSubscription } from './SubscriptionService'
import SubscriptionError from './SubscriptionError'
import { encodedLinkToParts } from '../render/LinkService'
import { ProjectState } from '../auth/AuthMiddleware'
import { decodeHashid, extractQueryParams } from '../utilities'
import { searchParamsSchema } from '../core/searchParams'
import { projectRoleMiddleware } from '../projects/ProjectService'
import { compileTemplate } from '../render'
import { getUser } from '../users/UserRepository'
import { User } from 'users/User'

/**
 ***
 * Public routes for webhooks & unsubscribe links
 ***
 */
const publicRouter = new Router<{app: App}>({
    prefix: '/unsubscribe',
})

interface EmailUnsubscribeParams {
    campaign_id: number
    user_id: number
}

export const emailUnsubscribeSchema: JSONSchemaType<EmailUnsubscribeParams> = {
    $id: 'emailUnsubscribe',
    type: 'object',
    required: ['campaign_id', 'user_id'],
    properties: {
        campaign_id: {
            type: 'integer',
        },
        user_id: {
            type: 'integer',
        },
    },
    additionalProperties: false,
}

publicRouter.get('/email', async ctx => {
    const { user, campaign } = await encodedLinkToParts(ctx.URL)

    if (!user) throw new RequestError(SubscriptionError.UnsubscribeInvalidUser)
    if (!campaign) throw new RequestError(SubscriptionError.UnsubscribeInvalidCampaign)

    await unsubscribe(user.id, campaign.subscription_id)
    ctx.headers['content-type'] = 'text/html'
    ctx.body = '<html><body><h3>You have been unsubscribed!</h3></body></html>'
})

publicRouter.post('/email', async ctx => {
    const { user, campaign } = await encodedLinkToParts(ctx.URL)

    if (!user) throw new RequestError(SubscriptionError.UnsubscribeInvalidUser)
    if (!campaign) throw new RequestError(SubscriptionError.UnsubscribeInvalidCampaign)

    await unsubscribe(user.id, campaign.subscription_id)
    ctx.status = 200
})

/**
 ***
 * User-facing subscription preferences page
 ***
 */
const preferencesPage = new Router<{
    app: App
    user?: User
    subscriptions?: SubscriptionPreferencesArgs['subscriptions']
}>({
    prefix: '/preferences/:encodedUserId',
})

preferencesPage.param('encodedUserId', async (value, ctx, next) => {

    const userId = decodeHashid(value)
    if (!userId) throw new RequestError(SubscriptionError.UnsubscribeInvalidUser)
    const user = await getUser(userId)
    if (!user) throw new RequestError(SubscriptionError.UnsubscribeInvalidUser)
    const subscriptions = await getUserSubscriptions(user)

    ctx.state.user = user
    ctx.state.subscriptions = subscriptions.results

    return await next()
})

interface SubscriptionPreferencesArgs {
    url: string
    subscriptions: UserSubscription[]
    showUpdatedMessage?: boolean
}

const subscriptionPreferencesTemplate = compileTemplate<SubscriptionPreferencesArgs>(`
<!DOCTYPE html>
<html lang="en">
    <head>
        <title>Subscription Preferences</title>
        <style>
            body {
                font-family: 'Inter', 'Helvetica Neue', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
                font-size: 15px;
                margin: 0;
                padding: 0;
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
            }
            main {
                margin: 50px auto;
                padding: 15px;
                max-width: 500px;
            }
            label {
                display: block;
                margin-bottom: 10px;
            }
            input[type="submit"] {
                display: inline-block;
                padding: 10px 20px;
                border-radius: 8px;
                background-color: #151c2d;
                color: #fff;
                font-size: 15px;
                border: 0;
                cursor: pointer;
                margin-top: 15px;
            }
            .alert-success {
                background-color: #d1fadf;
                color: #039855;
                padding: 10px;
                margin: 10px 0;
                border-radius: 8px;
            }
        </style>
    </head>
    <body>
        <main>
            {{#if subscriptions}}
            <form action="{{url}}" method="post">
                <h1>Communication Preferences</h1>
                <p>Choose which methods of communication you would like to continue to receive:</p>
                {{#if showUpdatedMessage}}
                <div class="alert-success">
                    Your preferences have been updated!
                </div>
                {{/if}}
                {{#each subscriptions}}
                <label>
                    <input
                        type="checkbox"
                        name="subscriptionIds"
                        value="{{this.subscription_id}}"
                        {{#ifEquals this.state 1}}checked{{/ifEquals}}
                    />
                    <span>
                        {{this.name}}
                    </span>
                </label>
                {{/each}}
                <input type="submit" value="Save Preferences" />
            </form>
            {{else}}
            <div>
                You are not subscribed to any notifications.
            </div>
            {{/if}}
        </main>
    </body>
</html>
`)

preferencesPage.get('/', async ctx => {
    ctx.headers['content-type'] = 'text/html'
    ctx.body = subscriptionPreferencesTemplate({
        subscriptions: ctx.state.subscriptions ?? [],
        url: App.main.env.baseUrl + ctx.URL.pathname,
        showUpdatedMessage: ctx.query.u === '1',
    })
})

preferencesPage.post('/', async ctx => {
    const { subscriptionIds } = ctx.request.body
    const ids = (Array.isArray(subscriptionIds) ? subscriptionIds : [subscriptionIds as string])
        ?.map(Number)
        .filter(n => !isNaN(n)) ?? []
    for (const { subscription_id } of ctx.state.subscriptions ?? []) {
        await toggleSubscription(
            ctx.state.user!.id,
            subscription_id,
            ids.includes(subscription_id)
                ? SubscriptionState.subscribed
                : SubscriptionState.unsubscribed,
        )
    }
    return ctx.redirect(App.main.env.baseUrl + ctx.URL.pathname + '?u=1')
})

publicRouter.use(
    preferencesPage.routes(),
    preferencesPage.allowedMethods(),
)

export { publicRouter }

/**
 ***
 * Client router for things like push which will come direct from
 * our client side libraries
 ***
 */
const clientRouter = new Router<{app: App}>({
    prefix: '/unsubscribe',
})
clientRouter.post('/push', async ctx => {
    // TODO: Unsubscribe for push types
    // Since this is coming from a client it should probably
    // contain a token and may not belong here. How to
    // structure project for client endpoints is tricky

    ctx.status = 204
})
export { clientRouter }

/**
 ***
 * Private admin routes for managing subscription types
 ***
 */
const router = new Router<
    ProjectState & { subscription?: Subscription }
>({
    prefix: '/subscriptions',
})

router.get('/', async ctx => {
    const params = extractQueryParams(ctx.query, searchParamsSchema)
    ctx.body = await pagedSubscriptions(params, ctx.state.project.id)
})

export const subscriptionCreateSchema: JSONSchemaType<SubscriptionParams> = {
    $id: 'subscriptionCreate',
    type: 'object',
    required: ['name', 'channel'],
    properties: {
        name: {
            type: 'string',
        },
        channel: {
            type: 'string',
            enum: ['email', 'text', 'push', 'webhook'],
        },
        is_public: {
            type: 'boolean',
            required: false,
        },
    },
    additionalProperties: false,
}

router.post('/', projectRoleMiddleware('admin'), async ctx => {
    const payload = validate(subscriptionCreateSchema, ctx.request.body)
    ctx.body = await createSubscription(ctx.state.project.id, payload)
})

router.param('subscriptionId', async (value, ctx, next) => {
    ctx.state.subscription = await getSubscription(parseInt(value), ctx.state.project.id)
    if (!ctx.state.subscription) {
        ctx.throw(404)
        return
    }
    return await next()
})

router.get('/:subscriptionId', async ctx => {
    ctx.body = ctx.state.subscription
})

export const subscriptionUpdateSchema: JSONSchemaType<SubscriptionUpdateParams> = {
    $id: 'subscriptionUpdate',
    type: 'object',
    required: ['name', 'is_public'],
    properties: {
        name: {
            type: 'string',
        },
        is_public: {
            type: 'boolean',
        },
    },
    additionalProperties: false,
}
router.patch('/:subscriptionId', async ctx => {
    const payload = validate(subscriptionUpdateSchema, ctx.request.body)
    console.log(payload)
    ctx.body = await updateSubscription(ctx.state.subscription!.id, payload)
})

export default router
