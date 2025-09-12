import { useEffect, useState } from 'react'
import Button from '../../ui/Button'
import { client } from '../../api'

interface QueueStatus {
    running: boolean
    batchSize: number
    metrics?: {
        data: Array<{ date: string | number | Date, count: number }>
        waiting: number
    }
    failedCount: number
    failed: Array<{ id?: string, name?: string, failedReason?: string, attemptsMade?: number, timestamp?: number }>
    redis: { ping: string, keys: number }
    driver?: string
    concurrency?: number
}

interface SourcesInfo {
    mysql: { description: string, examples: string[] }
    clickhouse: { description: string, examples: string[] }
    redis: { description: string, examples: string[] }
}

export default function OrgDebug() {
    const [status, setStatus] = useState<QueueStatus | null>(null)
    const [sources, setSources] = useState<SourcesInfo | null>(null)
    const [loading, setLoading] = useState(false)

    const refresh = async () => {
        const s = await client.get<QueueStatus>('/admin/debug/queue/status').then(r => r.data)
        setStatus(s)
    }

    useEffect(() => {
        refresh().catch(console.error)
        client.get<SourcesInfo>('/admin/debug/sources').then(r => setSources(r.data)).catch(console.error)
    }, [])

    const call = async (path: string) => {
        try {
            setLoading(true)
            await client.post(path)
            await refresh()
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{ padding: 16 }}>
            <h1>Admin Debug</h1>

            <section style={{ marginBottom: 24 }}>
                <h2>Queue Controls</h2>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Button onClick={async () => await call('/admin/debug/queue/pause')} isLoading={loading} variant="secondary">Pause</Button>
                    <Button onClick={async () => await call('/admin/debug/queue/resume')} isLoading={loading}>Resume</Button>
                    <Button onClick={async () => await call('/admin/debug/kick/minute')} isLoading={loading}>Kick Minute Tick</Button>
                    <Button onClick={async () => await call('/admin/debug/queue/resume-and-kick')} isLoading={loading}>Resume + Kick</Button>
                    <Button onClick={refresh} variant="secondary">Refresh Status</Button>
                </div>
            </section>

            <section style={{ marginBottom: 24 }}>
                <h2>Queue Status</h2>
                {!status && <div>Loading...</div>}
                {status && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                        <div><b>Running</b>: {String(status.running)}</div>
                        <div><b>Waiting</b>: {status.metrics?.waiting ?? 0}</div>
                        <div><b>Driver</b>: {status.driver}</div>
                        <div><b>Concurrency</b>: {status.concurrency ?? '-'}</div>
                        <div><b>Batch Size</b>: {status.batchSize}</div>
                        <div><b>Failed Count (24h)</b>: {status.failedCount}</div>
                        <div><b>Redis Ping</b>: {status.redis.ping}</div>
                        <div><b>Redis Keys</b>: {status.redis.keys}</div>
                    </div>
                )}
            </section>

            <section style={{ marginBottom: 24 }}>
                <h2>Recent Failed Jobs (Top 20)</h2>
                <ul>
                    {status?.failed?.map((j, idx) => (
                        <li key={idx}>
                            <code>{j.name ?? '(unknown)'}</code> — {j.failedReason ?? ''} (attempts: {j.attemptsMade ?? 0})
                        </li>
                    ))}
                </ul>
            </section>

            <section>
                <h2>Sources</h2>
                {sources && (
                    <div style={{ display: 'grid', gap: 16 }}>
                        <div>
                            <h3>MySQL</h3>
                            <div>{sources.mysql.description}</div>
                            <ul>
                                {sources.mysql.examples.map((e, i) => <li key={`m-${i}`}>{e}</li>)}
                            </ul>
                        </div>
                        <div>
                            <h3>ClickHouse</h3>
                            <div>{sources.clickhouse.description}</div>
                            <ul>
                                {sources.clickhouse.examples.map((e, i) => <li key={`c-${i}`}>{e}</li>)}
                            </ul>
                        </div>
                        <div>
                            <h3>Redis</h3>
                            <div>{sources.redis.description}</div>
                            <ul>
                                {sources.redis.examples.map((e, i) => <li key={`r-${i}`}>{e}</li>)}
                            </ul>
                        </div>
                    </div>
                )}
            </section>
        </div>
    )
}
