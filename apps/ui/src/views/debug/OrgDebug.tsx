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
    const [providerId, setProviderId] = useState<string>('')
    const [resetRate, setResetRate] = useState<boolean>(true)

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
        <div className="page-content">
            <div className="heading heading-h1"><div className="heading-text"><h1>Admin Debug</h1></div></div>

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
