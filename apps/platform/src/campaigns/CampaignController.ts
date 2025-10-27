import Router from '@koa/router'
import { JSONSchemaType, validate } from '../core/validate'
import Campaign, { CampaignCreateParams, CampaignUpdateParams, CampaignSend } from './Campaign'
import { archiveCampaign, campaignPreview, createCampaign, deleteCampaign, duplicateCampaign, getCampaign, getCampaignUsers, pagedCampaigns, updateCampaign } from './CampaignService'
import { searchParamsSchema, SearchSchema } from '../core/searchParams'
import { extractQueryParams } from '../utilities'
import { ProjectState } from '../auth/AuthMiddleware'
import { projectRoleMiddleware } from '../projects/ProjectService'
import { Context, Next } from 'koa'
import { PassThrough } from 'stream'

const router = new Router<ProjectState & { campaign?: Campaign }>({
    prefix: '/campaigns',
})

const checkCampaignId = async (value: string, ctx: Context, next: Next) => {
    ctx.state.campaign = await getCampaign(parseInt(value, 10), ctx.state.project.id)
    if (!ctx.state.campaign) {
        ctx.throw(404)
        return
    }
    return await next()
}

router.use(projectRoleMiddleware('editor'))

router.get('/', async ctx => {
    const searchSchema = SearchSchema('campaignSearchSchema', {
        sort: 'id',
        direction: 'desc',
    })
    const params = extractQueryParams(ctx.query, searchSchema)
    ctx.body = await pagedCampaigns(params, ctx.state.project.id)
})

const campaignCreateParams: JSONSchemaType<CampaignCreateParams> = {
    $id: 'campaignCreate',
    type: 'object',
    required: ['type', 'subscription_id', 'provider_id'],
    properties: {
        type: {
            type: 'string',
            enum: ['blast', 'trigger'],
        },
        name: {
            type: 'string',
        },
        channel: {
            type: 'string',
            enum: ['email', 'text', 'push', 'webhook', 'in_app'],
        },
        subscription_id: {
            type: 'integer',
        },
        provider_id: {
            type: 'integer',
        },
        list_ids: {
            type: 'array',
            items: { type: 'integer' },
            nullable: true,
        },
        exclusion_list_ids: {
            type: 'array',
            items: { type: 'integer' },
            nullable: true,
        },
        send_in_user_timezone: {
            type: 'boolean',
            nullable: true,
        },
        send_at: {
            type: 'string',
            format: 'date-time',
            nullable: true,
        },
        tags: {
            type: 'array',
            items: {
                type: 'string',
            },
            nullable: true,
        },
    },
    additionalProperties: false,
}

router.post('/', async ctx => {
    const payload = validate(campaignCreateParams, ctx.request.body)
    ctx.body = await createCampaign(ctx.state.project.id, {
        ...payload,
        admin_id: ctx.state.admin?.id,
    })
})

router.param('campaignId', checkCampaignId)

router.get('/:campaignId', async ctx => {
    ctx.body = ctx.state.campaign!
})

const campaignUpdateParams: JSONSchemaType<Partial<CampaignUpdateParams>> = {
    $id: 'campaignUpdate',
    type: 'object',
    properties: {
        name: {
            type: 'string',
            nullable: true,
        },
        subscription_id: {
            type: 'integer',
            nullable: true,
        },
        provider_id: {
            type: 'integer',
            nullable: true,
        },
        state: {
            type: 'string',
            enum: ['draft', 'scheduled', 'finished', 'aborted'],
            nullable: true,
        },
        list_ids: {
            type: 'array',
            items: { type: 'integer' },
            nullable: true,
        },
        exclusion_list_ids: {
            type: 'array',
            items: { type: 'integer' },
            nullable: true,
        },
        send_in_user_timezone: {
            type: 'boolean',
            nullable: true,
        },
        send_at: {
            type: 'string',
            format: 'date-time',
            nullable: true,
        },
        tags: {
            type: 'array',
            items: {
                type: 'string',
            },
            nullable: true,
        },
    },
    additionalProperties: false,
}

router.patch('/:campaignId', async ctx => {
    const payload = validate(campaignUpdateParams, ctx.request.body)
    ctx.body = await updateCampaign(ctx.state.campaign!.id, ctx.state.project.id, {
        ...payload,
        admin_id: ctx.state.admin?.id,
    })
})

router.get('/:campaignId/users', async ctx => {
    const params = extractQueryParams(ctx.query, searchParamsSchema)
    ctx.body = await getCampaignUsers(ctx.state.campaign!.id, params, ctx.state.project.id)
})

router.get('/:campaignId/export', async ctx => {
    const campaign = ctx.state.campaign!

    const format = String((ctx.query.format as string | undefined) ?? 'csv').toLowerCase()
    const requestedState = (ctx.query.state as string | undefined)?.toLowerCase()
    const state = requestedState === 'delivered' ? 'sent' : (requestedState ?? 'sent')

    const filename = `campaign_${campaign.id}_${state}.${format === 'ndjson' ? 'ndjson' : 'csv'}`
    ctx.set('Cache-Control', 'no-store')
    ctx.set('Content-Disposition', `attachment; filename="${filename}"`)
    ctx.type = format === 'ndjson' ? 'application/x-ndjson' : 'text/csv; charset=utf-8'

    const pass = new PassThrough()
    ctx.body = pass

    const write = async (chunk: string) => new Promise<void>((resolve) => {
        if (!pass.write(chunk)) pass.once('drain', () => resolve())
        else resolve()
    })

    if (format !== 'ndjson') {
        await write('user_id,external_id,email,phone,state,send_at,opened_at,clicks\n')
    }

    const qb = CampaignSend.query()
        .join('users', 'users.id', 'campaign_sends.user_id')
        .where('campaign_sends.campaign_id', campaign.id)
        .where('users.project_id', ctx.state.project.id)
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

    if (state) {
        qb.where('campaign_sends.state', state as any)
    }

    let aborted = false
    const onClose = () => { aborted = true; try { pass.end() } catch { /* noop */ } }
    ctx.req.on('close', onClose)
    try {
        await qb.stream(async function(stream) {
            for await (const row of stream as any) {
                if (aborted) break
                if (format === 'ndjson') {
                    const line = JSON.stringify(row) + '\n'
                    await write(line)
                } else {
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
                        if (s.includes('"') || s.includes(',') || s.includes('\n')) {
                            return '"' + s.replace(/"/g, '""') + '"'
                        }
                        return s
                    }
                    await write(vals.map(esc).join(',') + '\n')
                }
            }
        })
    } finally {
        try { pass.end() } catch { /* noop */ }
        ctx.req.off('close', onClose)
    }
})

router.delete('/:campaignId', async ctx => {
    const campaign = ctx.state.campaign!
    if (campaign.deleted_at) {
        await deleteCampaign(campaign, ctx.state.admin?.id)
    } else {
        await archiveCampaign(campaign, ctx.state.admin?.id)
    }
    ctx.body = true
})

router.post('/:campaignId/duplicate', async ctx => {
    ctx.body = await duplicateCampaign(ctx.state.campaign!, ctx.state.admin?.id)
})

router.get('/:campaignId/preview', async ctx => {
    ctx.body = await campaignPreview(ctx.state.project, ctx.state.campaign!)
})

export default router
