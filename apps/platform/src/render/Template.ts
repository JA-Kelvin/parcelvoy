import { htmlToText } from 'html-to-text'
import Render, { RenderObject, Variables, Wrap } from '.'
import { ChannelType } from '../config/channels'
import Model, { ModelParams } from '../core/Model'
import { isValid, IsValidSchema } from '../core/validate'
import { NotificationContent } from '../notifications/Notification'
import { Email, NamedEmail } from '../providers/email/Email'
import { BasePush } from '../providers/push/Push'
import { Webhook } from '../providers/webhook/Webhook'
import { paramsToEncodedLink } from './LinkService'

export default class Template extends Model {
    project_id!: number
    campaign_id!: number
    name?: string
    type!: ChannelType
    data!: Record<string, any>
    locale!: string

    static tableName = 'templates'

    static jsonAttributes = ['data']

    // Normalize any object-with-numeric-keys back into arrays, recursively
    private static normalizeArrayShapes(input: any): any {
        if (Array.isArray(input)) {
            return input.map(item => Template.normalizeArrayShapes(item))
        }
        if (input && typeof input === 'object') {
            const keys = Object.keys(input)
            const isNumericObject = keys.length > 0 && keys.every(k => /^\d+$/.test(k))
            if (isNumericObject) {
                const arr: any[] = []
                for (let i = 0; i < keys.length; i++) {
                    const v = (input as any)[String(i)]
                    arr.push(Template.normalizeArrayShapes(v))
                }
                return arr
            }
            const out: Record<string, any> = {}
            for (const [k, v] of Object.entries(input)) {
                out[k] = Template.normalizeArrayShapes(v)
            }
            return out
        }
        return input
    }

    toJSON() {
        const json: any = (this.constructor as any).toJson(this)
        if (this.data != null) {
            json.data = Template.normalizeArrayShapes(this.data)
        }
        return json
    }

    map(): TemplateType {
        const json = this as any
        if (this.type === 'email') {
            return EmailTemplate.fromJson(json)
        } else if (this.type === 'text') {
            return TextTemplate.fromJson(json)
        } else if (this.type === 'push') {
            return PushTemplate.fromJson(json)
        } else if (this.type === 'in_app') {
            return InAppTemplate.fromJson(json)
        }
        return WebhookTemplate.fromJson(json)
    }

    validate(): IsValidSchema {
        return [true, undefined]
    }

    requiredErrors(...fields: string[]) {
        const errors: Record<string, string> = {}
        for (const field of fields) {
            errors[field] = `The \`${field}\` field on the \`${this.locale}\` template is missing and is required.`
        }
        return errors
    }
}

export type TemplateParams = Omit<Template, ModelParams | 'map' | 'screenshotUrl' | 'validate' | 'requiredErrors'>
export type TemplateUpdateParams = Pick<Template, 'type' | 'name' | 'data'>
export type TemplateType = EmailTemplate | TextTemplate | PushTemplate | WebhookTemplate | InAppTemplate

type CompiledEmail = Omit<Email, 'to' | 'headers'> & { preheader?: string }

export class EmailTemplate extends Template {
    declare type: 'email'
    from!: string | NamedEmail
    cc?: string
    bcc?: string
    reply_to?: string
    subject!: string
    preheader?: string
    editor!: 'code' | 'visual' | 'enhanced-visual'
    text?: string
    html!: string
    mjml?: string

    parseJson(json: any) {
        super.parseJson(json)

        this.from = json?.data.from
        this.cc = json?.data.cc
        this.bcc = json?.data.bcc
        this.reply_to = json?.data.reply_to
        this.subject = json?.data.subject ?? ''
        this.preheader = json?.data.preheader
        this.editor = json?.data.type ?? 'code'
        this.text = json?.data.text
        this.html = json?.data.html ?? ''
        this.mjml = json?.data.mjml
    }

    compile(variables: Variables): CompiledEmail {
        const html = Render(this.html, variables)
        const preheader = this.preheader ? Render(this.preheader, variables) : undefined
        const email: CompiledEmail = {
            subject: Render(this.subject, variables),
            from: typeof this.from === 'string'
                ? Render(this.from, variables)
                : {
                    name: Render(this.from?.name ?? '', variables),
                    address: Render(this.from?.address ?? '', variables),
                },
            html: Wrap({ html, preheader, variables }), // Add link and open tracking

            // If the text copy has been left empty, generate from HTML
            text: this.text !== undefined && this.text !== ''
                ? Render(this.text, variables)
                : htmlToText(html),
        }

        if (preheader) email.preheader = preheader
        if (this.reply_to) email.reply_to = Render(this.reply_to, variables)
        if (this.cc) email.cc = Render(this.cc, variables)
        if (this.bcc) email.bcc = Render(this.bcc, variables)
        return email
    }

    validate() {
        return isValid({
            type: 'object',
            required: ['from', 'subject', 'html'],
            properties: {
                from: {
                    type: 'object',
                    required: ['address'],
                    properties: {
                        name: { type: 'string', nullable: true },
                        address: { type: 'string', format: 'email' },
                    },
                },
                subject: { type: 'string' },
                text: { type: 'string' },
                html: { type: 'string' },
            },
            additionalProperties: true,
            errorMessage: {
                required: this.requiredErrors('from', 'subject', 'text', 'html'),
            },
        }, this.data)
    }
}

export interface CompiledText {
    text: string
}

export class TextTemplate extends Template {
    declare type: 'text'
    text!: string

    parseJson(json: any) {
        super.parseJson(json)

        this.text = json?.data.text
    }

    compile(variables: Variables): CompiledText {
        return { text: Render(this.text ?? '', variables) }
    }

    validate() {
        return isValid({
            type: 'object',
            required: ['text'],
            properties: {
                text: { type: 'string' },
            },
            errorMessage: {
                required: this.requiredErrors('text'),
            },
        }, this.data)
    }
}

export class PushTemplate extends Template {
    declare type: 'push'
    title!: string
    body!: string
    url?: string
    silent!: boolean
    custom!: Record<string, any>

    parseJson(json: any) {
        super.parseJson(json)

        this.title = json?.data.title
        this.body = json?.data.body
        this.url = json?.data.url
        this.silent = json?.data.silent ?? false
        this.custom = json?.data.custom ?? {}
    }

    compile(variables: Variables): BasePush {
        const custom = RenderObject(this.custom, variables)
        const url = this.compileUrl(variables)

        return {
            title: Render(this.title, variables),
            body: Render(this.body, variables),
            silent: this.silent,
            custom: {
                ...custom,
                ...url ? { url } : {},
            },
        }
    }

    compileUrl(variables: Variables) {
        if (this.url === undefined) {
            return undefined
        }

        const { project, user, context } = variables
        const renderedUrl = Render(this.url, variables)

        return project.link_wrap_push
            ? paramsToEncodedLink({
                userId: user.id,
                campaignId: context.campaign_id,
                referenceId: context.reference_id,
                redirect: renderedUrl,
                path: 'c',
            })
            : renderedUrl
    }

    validate() {
        return isValid({
            type: 'object',
            required: ['title', 'body'],
            properties: {
                title: { type: 'string' },
                body: { type: 'string' },
                url: { type: 'string', nullable: true },
            },
            additionalProperties: true,
            errorMessage: {
                required: this.requiredErrors('title', 'body'),
            },
        }, this.data)
    }
}

export class WebhookTemplate extends Template {
    declare type: 'webhook'
    method!: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT'
    endpoint!: string
    body!: Record<string, any>
    headers: Record<string, string> = {}
    cacheKey?: string

    parseJson(json: any) {
        super.parseJson(json)

        this.method = json?.data.method
        this.endpoint = json?.data.endpoint
        this.body = json?.data.body
        this.headers = json?.data.headers || {}
        this.cacheKey = json?.data.cache_key
    }

    compile(variables: Variables): Webhook {
        const headers = RenderObject(this.headers, variables)
        const body = ['POST', 'PATCH', 'PUT'].includes(this.method)
            ? RenderObject(this.body, variables)
            : undefined

        const endpoint = Render(this.endpoint, variables)
        const cacheKey = this.cacheKey
            ? Render(this.cacheKey, variables)
            : undefined
        const method = this.method
        return {
            endpoint,
            method,
            headers,
            body,
            cacheKey,
        }
    }

    validate() {
        return isValid({
            type: 'object',
            required: ['method', 'endpoint'],
            properties: {
                method: { type: 'string' },
                endpoint: { type: 'string', nullable: true },
            },
            additionalProperties: true,
            errorMessage: {
                required: this.requiredErrors('method', 'endpoint'),
            },
        }, this.data)
    }
}

export class InAppTemplate extends Template {
    declare type: 'in_app'
    content!: NotificationContent

    parseJson(json: any) {
        super.parseJson(json)
        this.content = json?.data
    }

    compile(variables: Variables): NotificationContent {
        const base = {
            title: Render(this.content.title, variables),
            body: Render(this.content.body, variables),
            custom: RenderObject(this.content.custom, variables),
        }

        if (this.content.type === 'banner') {
            return { ...base, type: 'banner' }
        }

        return {
            ...base,
            html: Render(this.content.html, variables),
            type: this.content.type,
        }
    }

    validate() {
        return isValid({
            type: 'object',
            required: ['type', 'title', 'body'],
            properties: {
                read_on_show: { type: 'boolean' },
                title: { type: 'string' },
                body: { type: 'string' },
            },
            additionalProperties: true,
        }, this.data)
    }
}
