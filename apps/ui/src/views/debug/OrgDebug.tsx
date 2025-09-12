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

interface ActiveJob {
    id?: string
    name?: string
    attemptsMade?: number
    timestamp?: number
    processedOn?: number
}

interface WaitingJob {
    id?: string
    name?: string
    timestamp?: number
    priority?: number
    delay?: number
}

interface DelayedJob {
    id?: string
    name?: string
    timestamp?: number
    delay?: number
    opts?: Record<string, unknown>
}

interface JobDetail {
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
}

interface SourcesInfo {
    mysql: { description: string, examples: string[] }
    clickhouse: { description: string, examples: string[] }
    redis: { description: string, examples: string[] }
}

export default function OrgDebug() {
    const [status, setStatus] = useState<QueueStatus | null>(null)
    const [active, setActive] = useState<ActiveJob[]>([])
    const [waiting, setWaiting] = useState<WaitingJob[]>([])
    const [delayed, setDelayed] = useState<DelayedJob[]>([])
    const [jobDetail, setJobDetail] = useState<JobDetail | null>(null)
    const [sources, setSources] = useState<SourcesInfo | null>(null)
    const [loading, setLoading] = useState(false)
    const [providerId, setProviderId] = useState<string>('')
    const [resetRate, setResetRate] = useState<boolean>(true)

    const refresh = async () => {
        const s = await client.get<QueueStatus>('/admin/debug/queue/status').then(r => r.data)
        setStatus(s)
        const a = await client.get<ActiveJob[]>('/admin/debug/queue/active').then(r => r.data)
        setActive(a)
        const w = await client.get<WaitingJob[]>('/admin/debug/queue/waiting').then(r => r.data)
        setWaiting(w)
        const d = await client.get<DelayedJob[]>('/admin/debug/queue/delayed').then(r => r.data)
        setDelayed(d)
        setJobDetail(null)
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
        <div className="page-content">
            <div className="heading heading-h2"><div className="heading-text"><h1>Admin Debug</h1></div></div>

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
                <div className="heading heading-h2"><div className="heading-text"><h2>Provider Cache</h2></div></div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <label>
                        <span style={{ marginRight: 8 }}>Provider ID</span>
                        <input
                            type="number"
                            value={providerId}
                            onChange={e => setProviderId(e.target.value)}
                            style={{ padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: 6, width: 140 }}
                            placeholder="e.g. 12"
                        />
                    </label>
                    <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                        <input type="checkbox" checked={resetRate} onChange={e => setResetRate(e.target.checked)} />
                        <span>Reset rate limiter window</span>
                    </label>
                    <Button
                        onClick={async () => {
                            if (!providerId) return
                            setLoading(true)
                            try {
                                await client.post(`/admin/debug/providers/${providerId}/invalidate`, { reset_rate_limit: resetRate })
                            } finally {
                                setLoading(false)
                            }
                        }}
                        isLoading={loading}
                    >Invalidate provider cache</Button>
                </div>
                <div style={{ marginTop: 8, color: '#6b7280' }}>
                    Use this after updating Integrations to push new rate limits/config to all workers immediately.
                </div>
            </section>

            <section style={{ marginBottom: 24 }}>
                <div className="heading heading-h2"><div className="heading-text"><h2>Queue Status</h2></div></div>
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
                <div className="heading heading-h2"><div className="heading-text"><h2>Active Jobs (Top 50)</h2></div></div>
                {active.length === 0 && <div>None</div>}
                {active.length > 0 && (
                    <ul>
                        {active.map((j, idx) => (
                            <li key={j.id ?? idx}>
                                <code>{j.name ?? '(unknown)'}</code>
                                {' '}— id: {j.id ?? '-'} · attempts: {j.attemptsMade ?? 0}
                                {' '}· started: {j.processedOn ? new Date(j.processedOn).toLocaleString() : '-'}
                                {' '}
                                {j.id && (
                                    <Button
                                        variant="secondary"
                                        style={{ marginLeft: 8, padding: '2px 6px' }}
                                        onClick={async () => {
                                            const detail = await client.get<JobDetail>(`/admin/debug/queue/job/${j.id}`).then(r => r.data)
                                            setJobDetail(detail)
                                        }}
                                    >View</Button>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section style={{ marginBottom: 24 }}>
                <div className="heading heading-h2"><div className="heading-text"><h2>Waiting Jobs (Top 50)</h2></div></div>
                {waiting.length === 0 && <div>None</div>}
                {waiting.length > 0 && (
                    <ul>
                        {waiting.map((j, idx) => (
                            <li key={j.id ?? idx}>
                                <code>{j.name ?? '(unknown)'}</code>
                                {' '}— id: {j.id ?? '-'} · priority: {j.priority ?? '-'}
                                {' '}· queued: {j.timestamp ? new Date(j.timestamp).toLocaleString() : '-'}
                                {' '}
                                {j.id && (
                                    <Button
                                        variant="secondary"
                                        style={{ marginLeft: 8, padding: '2px 6px' }}
                                        onClick={async () => {
                                            const detail = await client.get<JobDetail>(`/admin/debug/queue/job/${j.id}`).then(r => r.data)
                                            setJobDetail(detail)
                                        }}
                                    >View</Button>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section style={{ marginBottom: 24 }}>
                <div className="heading heading-h2"><div className="heading-text"><h2>Delayed Jobs (Top 50)</h2></div></div>
                {delayed.length === 0 && <div>None</div>}
                {delayed.length > 0 && (
                    <ul>
                        {delayed.map((j, idx) => (
                            <li key={j.id ?? idx}>
                                <code>{j.name ?? '(unknown)'}</code>
                                {' '}— id: {j.id ?? '-'} · delay: {j.delay ?? '-'}ms
                                {' '}· queued: {j.timestamp ? new Date(j.timestamp).toLocaleString() : '-'}
                                {' '}
                                {j.id && (
                                    <Button
                                        variant="secondary"
                                        style={{ marginLeft: 8, padding: '2px 6px' }}
                                        onClick={async () => {
                                            const detail = await client.get<JobDetail>(`/admin/debug/queue/job/${j.id}`).then(r => r.data)
                                            setJobDetail(detail)
                                        }}
                                    >View</Button>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {jobDetail && (
                <section style={{ marginBottom: 24 }}>
                    <div className="heading heading-h2"><div className="heading-text"><h2>Job Detail</h2></div></div>
                    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, overflowX: 'auto' }}>
                        <pre style={{ margin: 0 }}>
                            {JSON.stringify(jobDetail, null, 2)}
                        </pre>
                    </div>
                </section>
            )}

            <section style={{ marginBottom: 24 }}>
                <div className="heading heading-h2"><div className="heading-text"><h2>Recent Failed Jobs (Top 20)</h2></div></div>
                <ul>
                    {status?.failed?.map((j, idx) => (
                        <li key={idx}>
                            <code>{j.name ?? '(unknown)'}</code> — {j.failedReason ?? ''} (attempts: {j.attemptsMade ?? 0})
                        </li>
                    ))}
                </ul>
            </section>

            <section>
                <div className="heading heading-h2"><div className="heading-text"><h2>Sources</h2></div></div>
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
