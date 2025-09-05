import Router from '@koa/router'
import App from '../app'
import { encodedLinkToParts, trackMessageEvent } from './LinkService'
import Organization from '../organizations/Organization'
import { cacheGet, cacheSet } from '../config/redis'
import { getCampaignSend } from '../campaigns/CampaignService'
import Template, { EmailTemplate } from '../render/Template'
import { templatesInUserLocale } from '../render/TemplateService'
import Project from '../projects/Project'

const router = new Router<{
    app: App
    organization?: Organization
}>()

router.get('/c', async ctx => {

    // If no redirect, just show a default page
    if (!ctx.query.r) {
        ctx.body = 'It looks like this link doesn\'t work properly!'
        ctx.status = 200
        return
    }

    const parts = await encodedLinkToParts(ctx.URL)
    await trackMessageEvent(parts, 'clicked')
    ctx.redirect(parts.redirect)
    ctx.status = 303
})

router.get('/o', async ctx => {
    const parts = await encodedLinkToParts(ctx.URL)
    await trackMessageEvent(parts, 'opened')
    ctx.status = 204
})

router.get('/v', async ctx => {
    const parts = await encodedLinkToParts(ctx.URL)

    const user = parts.user
    const campaign = parts.campaign
    const referenceId = parts.referenceId ?? '0'

    if (!user || !campaign) {
        ctx.status = 404
        ctx.body = 'Message not found.'
        return
    }

    if (campaign.channel !== 'email') {
        ctx.status = 400
        ctx.body = 'Viewing is only supported for email messages.'
        return
    }

    // Validate that a send exists for this user/campaign/reference
    const send = await getCampaignSend(campaign.id, user.id, referenceId)
    if (!send || send.state === 'aborted') {
        ctx.status = 404
        ctx.body = 'Message not available.'
        return
    }

    // Load project and select the most appropriate template for this user
    const project = await Project.find(user.project_id)
    if (!project) {
        ctx.status = 404
        ctx.body = 'Project not found.'
        return
    }

    const templates = await Template.all(qb => qb.where('campaign_id', campaign.id))
    if (!templates.length) {
        ctx.status = 404
        ctx.body = 'Template not found.'
        return
    }

    const selected = templatesInUserLocale(templates, project, user)[0] ?? templates[0]
    const mapped = selected.map() as EmailTemplate

    // Build rendering variables to match send context as closely as possible
    const variables = {
        user,
        project,
        context: {
            template_id: mapped.id,
            campaign_id: campaign.id,
            subscription_id: campaign.subscription_id,
            reference_id: referenceId,
        },
    } as const

    const compiled = mapped.compile(variables as any)
    ctx.type = 'text/html; charset=utf-8'
    ctx.body = compiled.html
    ctx.status = 200
})

router.get('/.well-known/:file', async ctx => {
    const organization = ctx.state.organization
    const url = organization?.tracking_deeplink_mirror_url
    const file = ctx.params.file
    if (!url) {
        ctx.status = 404
        return
    }

    const key = `well-known:${organization.id}:${file}`
    const value = await cacheGet<any>(App.main.redis, key)
    if (value) {
        ctx.body = value
    } else {
        const response = await fetch(`${url}/.well-known/${file}`)
        const value = await response.json()
        await cacheSet(App.main.redis, key, value, 60 * 60 * 5)
        ctx.body = value
    }
})

export default router
