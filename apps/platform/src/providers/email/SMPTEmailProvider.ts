import nodemailer from 'nodemailer'
import { ExternalProviderParams, ProviderControllers, ProviderSchema } from '../Provider'
import { createController } from '../ProviderService'
import EmailProvider from './EmailProvider'
import { Email } from './Email'

export interface SMTPDataParams {
    host: string
    port: number
    secure: boolean
    auth: { user: string, pass: string }
    /** Optional Mandrill subaccount to attach via X-MC-Subaccount header */
    subaccount?: string
}

type SMTPEmailProviderParams = Pick<SMTPEmailProvider, keyof ExternalProviderParams>

export default class SMTPEmailProvider extends EmailProvider {
    host!: string
    port!: number
    secure!: boolean
    auth!: { user: string, pass: string }

    declare data: SMTPDataParams

    static namespace = 'smtp'
    static meta = {
        name: 'SMTP',
        icon: 'https://parcelvoy.com/providers/smtp.svg',
    }

    static schema = ProviderSchema<SMTPEmailProviderParams, SMTPDataParams>('smtpProviderParams', {
        type: 'object',
        required: ['host', 'port', 'secure', 'auth'],
        properties: {
            host: { type: 'string' },
            port: { type: 'number' },
            secure: { type: 'boolean' },
            subaccount: {
                type: 'string',
                title: 'Mandrill Subaccount',
                description: 'Optional: Assign all sends to this Mandrill subaccount (adds X-MC-Subaccount header).',
                nullable: true,
            },
            auth: {
                type: 'object',
                required: ['user', 'pass'],
                properties: {
                    user: { type: 'string' },
                    pass: { type: 'string' },
                },
            },
        },
        additionalProperties: false,
    })

    boot() {
        this.transport = nodemailer.createTransport({
            host: this.host,
            port: this.port,
            secure: this.secure,
            auth: this.auth,
        })
    }

    async send(message: Email): Promise<any> {
        const headers = { ...(message.headers || {}) }
        if (this.data?.subaccount) {
            headers['X-MC-Subaccount'] = this.data.subaccount
        }
        return await super.send({ ...message, headers })
    }

    static controllers(): ProviderControllers {
        return { admin: createController('email', this) }
    }
}
