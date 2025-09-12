import Queue from './Queue'
import { EncodedJob } from './Job'

export type QueueProviderName = 'redis' | 'memory' | 'logger'

export interface Metric {
    date: Date
    count: number
}

export interface QueueMetric {
    data: Metric[]
    waiting: number
}

export enum MetricPeriod {
    FIFTEEN_MINUTES = 15,
    ONE_HOUR = 60,
    FOUR_HOURS = 240,
    ONE_WEEK = 10080,
    TWO_WEEKS = 20160,
}

export default interface QueueProvider {
    queue: Queue
    batchSize: number
    enqueue(job: EncodedJob): Promise<void>
    enqueueBatch(jobs: EncodedJob[]): Promise<void>
    delay(job: EncodedJob, milliseconds: number): Promise<void>
    retry(job: EncodedJob): Promise<void>
    start(): void
    pause(): Promise<void>
    resume(): Promise<void>
    isRunning(): Promise<boolean>
    close(): void
    metrics?(period: MetricPeriod): Promise<QueueMetric>
    failed?(): Promise<any>
    /**
     * Return a simplified list of active jobs for debugging/inspection.
     * Providers that cannot supply this information can return an empty array.
     */
    active?(): Promise<Array<{
        id?: string
        name?: string
        attemptsMade?: number
        timestamp?: number
        processedOn?: number
    }>>
    /** Upcoming jobs that are queued and waiting to be processed */
    waiting?(): Promise<Array<{
        id?: string
        name?: string
        timestamp?: number
        priority?: number
        delay?: number
    }>>
    /** Jobs that are delayed/scheduled for the future */
    delayed?(): Promise<Array<{
        id?: string
        name?: string
        timestamp?: number
        delay?: number
        opts?: Record<string, unknown>
    }>>
    /** Fetch a single job detail by id */
    job?(id: string): Promise<{
        id?: string
        name?: string
        attemptsMade?: number
        timestamp?: number
        processedOn?: number
        finishedOn?: number
        failedReason?: string
        state?: string
        data?: any
        opts?: any
    } | null>
}
