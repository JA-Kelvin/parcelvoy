import { SQLModel } from '../core/Model'

export type CampaignSendEventName =
    | 'queued'
    | 'pending'
    | 'throttled'
    | 'sent'
    | 'failed'
    | 'bounced'
    | 'aborted'
    | 'opened'
    | 'clicked'
    | 'complained'

export class CampaignSendEvent extends SQLModel {
    project_id!: number
    campaign_id!: number
    user_id!: number
    channel!: string
    event!: CampaignSendEventName
    reference_type?: 'journey' | 'trigger'
    reference_id?: string
    provider_id?: number
    provider_message_id?: string
    meta?: Record<string, unknown>

    static jsonAttributes = ['meta']
}
