import { logger } from '../config/logger'
import { releaseLock } from '../core/Lock'
import { Job } from '../queue'
import { CampaignJobParams, SentCampaign } from './Campaign'
import CampaignEnqueueSendsJob from './CampaignEnqueueSendsJob'
import { getCampaign, populateSendList } from './CampaignService'

export default class CampaignGenerateListJob extends Job {
    static $name = 'campaign_generate_list_job'

    static from({ id, project_id }: CampaignJobParams): CampaignGenerateListJob {
        return new this({ id, project_id }).deduplicationKey(`cid_${id}_generate`)
    }

    static async handler({ id, project_id }: CampaignJobParams) {
        const key = `campaign_generate_${id}`

        logger.info({ campaign_id: id }, 'campaign:generate:loading')

        const campaign = await getCampaign(id, project_id) as SentCampaign
        if (!campaign) return
        if (campaign.state === 'aborted' || campaign.state === 'draft') return

        try {
            logger.info({ campaignId: id }, 'campaign:generate:populating')
            await populateSendList(campaign)

            logger.info({ campaignId: id }, 'campaign:generate:sending')
            await CampaignEnqueueSendsJob.from({
                id: campaign.id,
                project_id: campaign.project_id,
            }).queue()

            await releaseLock(key)
        } catch (error) {
            logger.info({ campaignId: id, error }, 'campaign:generate:failed')
            throw error
        } finally {
            logger.info({ campaignId: id }, 'campaign:generate:lock_released')
            await releaseLock(key)
        }
    }
}
