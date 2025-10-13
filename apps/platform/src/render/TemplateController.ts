import Router from '@koa/router'
import { isHandlerbarsError, Variables } from '.'
import { ProjectState } from '../auth/AuthMiddleware'
import { ChannelType } from '../config/channels'
import { RequestError } from '../core/errors'
import { searchParamsSchema } from '../core/searchParams'
import { JSONSchemaType, validate } from '../core/validate'
import { User } from '../users/User'
import { UserEvent } from '../users/UserEvent'
import { extractQueryParams } from '../utilities'
import Template, { TemplateParams, TemplateUpdateParams } from './Template'
import { getCampaign } from '../campaigns/CampaignService'
import { createTemplate, deleteTemplate, getTemplate, pagedTemplates, sendProof, updateTemplate } from './TemplateService'

const router = new Router<
    ProjectState & { template?: Template }
>({
    prefix: '/templates',
})

router.get('/', async ctx => {
    const params = extractQueryParams(ctx.query, searchParamsSchema)
    ctx.body = await pagedTemplates(params, ctx.state.project.id)
})

const templateDataEmailParams = {
    type: 'object',
    properties: {
        from: {
            type: 'object',
            nullable: true,
            properties: {
                name: {
                    type: 'string',
                    nullable: true,
                },
                address: {
                    type: 'string',
                    nullable: true,
                    format: 'email',
                },
            },
        },
        cc: {
            type: 'string',
            nullable: true,
            format: 'email',
        },
        bcc: {
            type: 'string',
            nullable: true,
            format: 'email',
        },
        reply_to: {
            type: 'string',
            nullable: true,
            format: 'email',
        },
        subject: {
            type: 'string',
            nullable: true,
        },
        text: {
            type: 'string',
            nullable: true,
        },
        html: {
            type: 'string',
            nullable: true,
        },
        mjml: {
            type: 'string',
            nullable: true,
        },
        // Editor type used by visual/enhanced editors (stored as data.type)
        type: {
            type: 'string',
            nullable: true,
        },
        // Visual editor content arrays
        elements: {
            type: 'array',
            nullable: true,
            items: {
                type: 'object',
                additionalProperties: true,
            },
        },
        customTemplates: {
            type: 'array',
            nullable: true,
            items: {
                type: 'object',
                additionalProperties: true,
            },
        },
        metadata: {
            type: 'object',
            nullable: true,
            additionalProperties: true,
        },
    },
    nullable: true,
}

const templateDataTextParams = {
    type: 'object',
    properties: {
        text: {
            type: 'string',
            nullable: true,
        },
    },
    nullable: true,
}

const templateDataPushParams = {
    type: 'object',
    required: ['title', 'body'],
    properties: {
        title: { type: 'string' },
        body: { type: 'string' },
        custom: {
            type: 'object',
            nullable: true,
            additionalProperties: true,
        },
    },
    nullable: true,
}

const templateDataWebhookParams = {
    type: 'object',
    required: ['method', 'endpoint'],
    properties: {
        method: { type: 'string' },
        endpoint: { type: 'string' },
        body: {
            type: 'object',
            nullable: true,
            additionalProperties: true,
        },
        headers: {
            type: 'object',
            nullable: true,
            additionalProperties: true,
        },
    },
    nullable: true,
}

const templateDataInAppParams = {
    type: 'object',
    properties: {
        html: { type: 'string' },
        custom: {
            type: 'object',
            nullable: true,
            additionalProperties: true,
        },
    },
    nullable: true,
}

const baseCreateType = (type: ChannelType, data: any) => ({
    type: 'object',
    required: ['type', 'campaign_id', 'locale'],
    properties: {
        type: {
            type: 'string',
            enum: [type],
        },
        campaign_id: {
            type: 'integer',
        },
        locale: {
            type: 'string',
        },
        name: { type: 'string', nullable: true },
        data,
    },
    additionalProperties: false,
}) as any

const baseUpdateType = (type: ChannelType, data: any) => ({
    type: 'object',
    required: ['type', 'data'],
    properties: {
        type: {
            type: 'string',
            enum: [type],
        },
        name: { type: 'string', nullable: true },
        data,
    },
    additionalProperties: false,
}) as any

const templateCreateParams: JSONSchemaType<TemplateParams> = {
    $id: 'templateCreateParams',
    oneOf: [
        baseCreateType('email', templateDataEmailParams),
        baseCreateType('text', templateDataTextParams),
        baseCreateType('push', templateDataPushParams),
        baseCreateType('webhook', templateDataWebhookParams),
        baseCreateType('in_app', templateDataInAppParams),
    ],
}
router.post('/', async ctx => {
    const payload = validate(templateCreateParams, ctx.request.body)
    ctx.body = await createTemplate(ctx.state.project.id, payload)
})

router.param('templateId', async (value, ctx, next) => {
    ctx.state.template = await getTemplate(parseInt(value), ctx.state.project.id)
    if (!ctx.state.template) {
        ctx.throw(404)
        return
    }
    return await next()
})

router.get('/:templateId', async ctx => {
    ctx.body = ctx.state.template
})

const templateUpdateParams: JSONSchemaType<TemplateUpdateParams> = {
    $id: 'templateUpdateParams',
    oneOf: [
        baseUpdateType('email', templateDataEmailParams),
        baseUpdateType('text', templateDataTextParams),
        baseUpdateType('push', templateDataPushParams),
        baseUpdateType('webhook', templateDataWebhookParams),
        baseUpdateType('in_app', templateDataInAppParams),
    ],
}
router.patch('/:templateId', async ctx => {
    const body = { ...ctx.request.body, type: ctx.state.template!.type }
    const payload = validate(templateUpdateParams, body)
    ctx.body = await updateTemplate(ctx.state.template!.id, payload)
})

router.delete('/:templateId', async ctx => {
    const template = ctx.state.template!
    ctx.body = await deleteTemplate(template.id, template.project_id)
})

router.post('/:templateId/preview', async ctx => {
    const payload = ctx.request.body as Variables
    const template = ctx.state.template!.map()

    try {
        // Base variables from payload
        let variables: Variables = {
            user: User.fromJson({ ...payload.user, data: payload.user }),
            event: UserEvent.fromJson(payload.event || {}),
            journey: payload.journey || {},
            context: payload.context || {},
            project: ctx.state.project,
        }

        // For webhook previews, inject provider into context so {{context.provider...}} resolves
        if (template.type === 'webhook') {
            const campaign = await getCampaign(template.campaign_id, ctx.state.project.id)
            if (campaign?.provider) {
                variables = {
                    ...variables,
                    context: {
                        ...variables.context,
                        provider: campaign.provider,
                    },
                }
            }
        }

        ctx.body = template.compile(variables)
    } catch (error: any) {
        throw new RequestError(error.message, 400)
    }
})

interface TemplateProofParams {
    variables: any
    recipient: string
}

const templateProofParams: JSONSchemaType<TemplateProofParams> = {
    $id: 'templateProof',
    type: 'object',
    required: ['recipient'],
    properties: {
        variables: {
            type: 'object',
            nullable: true,
            additionalProperties: true,
        },
        recipient: { type: 'string' },
    },
    additionalProperties: false,
}
router.post('/:templateId/proof', async ctx => {
    const { variables, recipient } = validate(templateProofParams, ctx.request.body)
    const template = ctx.state.template!.map()
    try {
        ctx.body = await sendProof(template, variables, recipient)
    } catch (error) {
        if (isHandlerbarsError(error)) {
            throw new RequestError('Failed to send proof, invalid Handlebars in template', 400)
        } else {
            throw error
        }
    }
})

export default router
