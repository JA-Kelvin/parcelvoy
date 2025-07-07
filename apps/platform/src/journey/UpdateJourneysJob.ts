import { chunk } from '../utilities'
import { Job } from '../queue'
import Journey from './Journey'
import App from '../app'
import JourneyStatsJob from './JourneyStatsJob'
import JourneyCleanupJob from './JourneyCleanupJob'

export default class UpdateJourneysJob extends Job {
    static $name = 'update_journeys_job'

    static async handler() {

        const { db, queue } = App.main

        await chunk<Journey>(Journey.query(db), queue.batchSize, async journeys => {
            const steps = []
            for (const journey of journeys) {
                steps.push(
                    JourneyCleanupJob.from(journey.id),
                    JourneyStatsJob.from(journey.id),
                )
            }
            queue.enqueueBatch(steps)
        })
    }
}
