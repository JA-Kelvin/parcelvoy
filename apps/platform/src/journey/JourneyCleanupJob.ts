import { Job } from '../queue'
import JourneyUserStep from './JourneyUserStep'

interface JourneyCleanupJobParams {
    journey_id: number
}

export default class JourneyCleanupJob extends Job {
    static $name = 'journey_delay_job'

    static from(journey_id: number) {
        return new JourneyCleanupJob({ journey_id })
    }

    static async handler({ journey_id }: JourneyCleanupJobParams) {
        if (!journey_id) return

        // Clean up the data for old user steps
        await JourneyUserStep.query()
            .where('journey_id', journey_id)
            .where('data_state', 'available')
            .update({
                data_state: 'cleared',
                data: null,
            })
    }
}
