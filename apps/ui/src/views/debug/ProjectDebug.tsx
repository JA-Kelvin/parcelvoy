import { useContext, useEffect, useMemo, useState } from 'react'
import Button from '../../ui/Button'
import { client } from '../../api'
import { ProjectContext } from '../../contexts'

interface CampaignRow {
    id: number
    name: string
    type: string
    state: string
    send_at?: string
    delivery: any
    deliveryLive: { sent: number, pending: number, total: number, opens: number, clicks: number }
}

interface CampaignDiag {
    id: number
    name: string
    state: string
    channel: string
    send_at?: string
    delivery: { sent: number, pending: number, total: number, opens: number, clicks: number }
    ready_now: number
}

interface JourneyRow { id: number, name: string, status: string, stats_at?: string }
interface JourneyDiag { pending: number, delay: number, error: number, completed: number }

export default function ProjectDebug() {
    const [project] = useContext(ProjectContext)
    const projectId = project?.id

    const [campaigns, setCampaigns] = useState<CampaignRow[]>([])
    const [journeys, setJourneys] = useState<JourneyRow[]>([])
    const [loading, setLoading] = useState(false)
    const [diag, setDiag] = useState<Record<number, CampaignDiag>>({})
    const [jdiag, setJDiag] = useState<Record<number, JourneyDiag>>({})
    const [nextCursor, setNextCursor] = useState<string | undefined>(undefined)

    const base = useMemo(() => `/admin/projects/${projectId}/debug`, [projectId])
    const LIMIT = useMemo(() => 25, [])

    const load = async () => {
        if (!projectId) return
        const first = await client.get<{ results: CampaignRow[], nextCursor?: string }>(
            `${base}/campaigns?limit=${LIMIT}`,
        ).then(r => r.data)
        setCampaigns(first.results)
        setNextCursor(first.nextCursor)
        const js = await client.get<JourneyRow[]>(`${base}/journeys`).then(r => r.data)
        setJourneys(js)
    }

    useEffect(() => { load().catch(console.error) }, [projectId])

    const run = async (fn: () => Promise<any>) => {
        try { setLoading(true); await fn(); await load() } finally { setLoading(false) }
    }

    const loadMore = async () => {
        if (!projectId || !nextCursor) return
        try {
            setLoading(true)
            const more = await client.get<{ results: CampaignRow[], nextCursor?: string }>(
                `${base}/campaigns?limit=${LIMIT}&cursor=${encodeURIComponent(nextCursor)}&page=next`,
            ).then(r => r.data)
            setCampaigns(prev => [...prev, ...more.results])
            setNextCursor(more.nextCursor)
        } finally {
            setLoading(false)
        }
    }

    const diagnose = async (id: number) => {
        const d = await client.get<CampaignDiag>(`${base}/campaigns/${id}/diagnostics`).then(r => r.data)
        setDiag(s => ({ ...s, [id]: d }))
    }

    const jdiagnose = async (id: number) => {
        const d = await client.get<JourneyDiag>(`${base}/journeys/${id}/diagnostics`).then(r => r.data)
        setJDiag(s => ({ ...s, [id]: d }))
    }

    return (
        <div className="page-content">
            <div className="heading heading-h2"><div className="heading-text"><h1>Project Debug</h1></div></div>

            <section style={{ marginBottom: 24 }}>
                <div className="heading heading-h2"><div className="heading-text"><h2>Campaigns</h2></div></div>
                <div style={{ display: 'grid', gap: 12 }}>
                    {campaigns.map(c => (
                        <div key={c.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                    <b>#{c.id}</b> {c.name} — <i>{c.state}</i> · sent {c.deliveryLive?.sent}/{c.deliveryLive?.total} (pending {c.deliveryLive?.pending})
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <Button variant="secondary" onClick={async () => await diagnose(c.id)}>Diagnostics</Button>
                                    <Button onClick={async () => await run(async () => await client.post(`${base}/campaigns/${c.id}/rekick`))} isLoading={loading}>Re-kick</Button>
                                </div>
                            </div>
                            {diag[c.id] && (
                                <div style={{ marginTop: 8, fontSize: 14 }}>
                                    <div><b>Channel</b>: {diag[c.id].channel} · <b>Ready Now</b>: {diag[c.id].ready_now}</div>
                                    <div><b>Delivery</b>: sent {diag[c.id].delivery.sent}/{diag[c.id].delivery.total}; pending {diag[c.id].delivery.pending}; opens {diag[c.id].delivery.opens}; clicks {diag[c.id].delivery.clicks}</div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                {nextCursor && (
                    <div style={{ marginTop: 12 }}>
                        <Button onClick={loadMore} isLoading={loading}>Load more</Button>
                    </div>
                )}
            </section>

            <section>
                <div className="heading heading-h2"><div className="heading-text"><h2>Journeys</h2></div></div>
                <div style={{ display: 'grid', gap: 12 }}>
                    {journeys.map(j => (
                        <div key={j.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                    <b>#{j.id}</b> {j.name} — <i>{j.status}</i>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <Button variant="secondary" onClick={async () => await jdiagnose(j.id)}>Diagnostics</Button>
                                    <Button onClick={async () => await run(async () => await client.post(`${base}/journeys/${j.id}/rekick`))} isLoading={loading}>Re-kick</Button>
                                </div>
                            </div>
                            {jdiag[j.id] && (
                                <div style={{ marginTop: 8, fontSize: 14 }}>
                                    <div><b>Pending</b>: {jdiag[j.id].pending} · <b>Delay</b>: {jdiag[j.id].delay} · <b>Completed</b>: {jdiag[j.id].completed} · <b>Error</b>: {jdiag[j.id].error}</div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </section>
        </div>
    )
}
