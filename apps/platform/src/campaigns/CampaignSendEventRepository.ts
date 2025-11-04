import { CampaignSendEvent, CampaignSendEventName } from './CampaignSendEvent'
import Campaign from './Campaign'

export interface SendEventInput {
    project_id: number
    campaign_id: number
    user_id: number
    channel: string
    event: CampaignSendEventName
    reference_type?: 'journey' | 'trigger'
    reference_id?: string
    provider_id?: number
    provider_message_id?: string
    meta?: Record<string, unknown>
}

export const insertSendEvent = async (input: SendEventInput) => {
    try {
        await CampaignSendEvent.query()
            .insert({
                ...input,
                created_at: new Date(),
                updated_at: new Date(),
            })
            .onConflict(['project_id','campaign_id','user_id','reference_id','event','created_at'])
            .ignore()
    } catch (e) {
        // Best-effort: do not throw to avoid impacting critical send paths
    }
}

export const insertSendEventFromCampaign = async (
    campaign: Campaign,
    user_id: number,
    event: CampaignSendEventName,
    params: Partial<Omit<SendEventInput, 'project_id' | 'campaign_id' | 'user_id' | 'channel' | 'event'>> = {},
) => insertSendEvent({
    project_id: campaign.project_id,
    campaign_id: campaign.id,
    user_id,
    channel: campaign.channel,
    event,
    reference_id: params.reference_id,
    reference_type: params.reference_type,
    provider_id: params.provider_id,
    provider_message_id: params.provider_message_id,
    meta: params.meta,
})
