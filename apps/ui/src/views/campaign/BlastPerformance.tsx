import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import api from '../../api'
import PageContent from '../../ui/PageContent'
import Heading from '../../ui/Heading'
import ReactECharts from 'echarts-for-react'
import { format } from 'date-fns'
import { ProjectContext } from '../../contexts'
import { MultiSelect } from '../../ui/form/MultiSelect'
import { SingleSelect } from '../../ui/form/SingleSelect'
import SwitchField from '../../ui/form/SwitchField'

const STATUSES = [
    'Upcoming',
    'pending',
    'throttled',
    'sent',
    'bounced',
    'failed',
    'aborted',
] as const

const STATUS_COLORS: Record<(typeof STATUSES)[number], string> = {
    Upcoming: 'var(--color-blue-soft)',
    pending: 'var(--color-blue)',
    throttled: 'var(--color-yellow)',
    sent: 'var(--color-green)',
    bounced: 'var(--color-purple)',
    failed: 'var(--color-red)',
    aborted: 'var(--color-orange)',
}

type WindowKey = '5m' | '15m' | '30m' | '60m' | '1d' | '2d'
const WINDOW_PRESETS: Array<{ key: WindowKey, label: string, ms: number }> = [
    { key: '5m', label: '5 minutes', ms: 5 * 60 * 1000 },
    { key: '15m', label: '15 minutes', ms: 15 * 60 * 1000 },
    { key: '30m', label: '30 minutes', ms: 30 * 60 * 1000 },
    { key: '60m', label: '1 hour', ms: 60 * 60 * 1000 },
    { key: '1d', label: '1 day', ms: 24 * 60 * 60 * 1000 },
    { key: '2d', label: '2 days', ms: 2 * 24 * 60 * 60 * 1000 },
]

const ALL_CHANNELS = ['email', 'text', 'push', 'webhook', 'in_app'] as const
type Channel = typeof ALL_CHANNELS[number]

function bucketSecondsForRange(rangeMs: number): number {
    if (rangeMs <= 5 * 60 * 1000) return 5
    if (rangeMs <= 15 * 60 * 1000) return 10
    if (rangeMs <= 30 * 60 * 1000) return 20
    if (rangeMs <= 60 * 60 * 1000) return 60
    if (rangeMs <= 24 * 60 * 60 * 1000) return 5 * 60
    return 10 * 60
}

export default function BlastPerformance() {
    const [project] = useContext(ProjectContext)

    const [windowKey, setWindowKey] = useState<WindowKey>('60m')
    const windowMs = useMemo(() => WINDOW_PRESETS.find(w => w.key === windowKey)!.ms, [windowKey])
    const [channels, setChannels] = useState<Channel[]>([...ALL_CHANNELS])
    const [types, setTypes] = useState<string[]>(['blast', 'trigger'])
    const [statuses, setStatuses] = useState<Array<(typeof STATUSES)[number]>>([...STATUSES])

    const [data, setData] = useState<any | null>(null)
    const [option, setOption] = useState<any | null>(null)
    const mounted = useRef(true)
    const [useLogs, setUseLogs] = useState(false)

    const fetchData = useCallback(async () => {
        const now = new Date()
        const from = new Date(now.getTime() - windowMs)
        const bucket = bucketSecondsForRange(windowMs)
        const res = await api.analytics.blastPerformance(project.id, {
            from: from.toISOString(),
            to: now.toISOString(),
            bucket,
            channels,
            types,
            source: useLogs ? 'logs' : undefined,
        })
        if (mounted.current) setData(res)
    }, [project.id, windowMs, channels, types, useLogs])

    const buildOption = useCallback(() => {
        if (!data) return null

        // series rows: { bucket, channel, status, count, opens, clicks }
        const seriesByStatus: Record<(typeof STATUSES)[number], Array<[number, number, number]>> = {
            Upcoming: [], pending: [], throttled: [], sent: [], bounced: [], failed: [], aborted: [],
        }
        const throughput: Map<number, number> = new Map()
        for (const row of data.series as any[]) {
            if (!statuses.includes(row.status)) continue
            const t = Date.parse(row.bucket)
            const s = row.status as (typeof STATUSES)[number]
            const idx = STATUSES.indexOf(s)
            seriesByStatus[s].push([t, idx, row.count])
            if (s === 'sent') throughput.set(t, (throughput.get(t) ?? 0) + row.count)
        }
        for (const arr of Object.values(seriesByStatus)) arr.sort((a, b) => a[0] - b[0])
        const throughputSeries = Array.from(throughput.entries()).sort((a, b) => a[0] - b[0]).map(([t, c]) => [t, c])

        const now = Date.now()
        const opt: any = {
            grid: { left: 80, right: 60, top: 40, bottom: 60 },
            legend: { data: [...STATUSES.filter(s => statuses.includes(s)), 'Throughput'] },
            dataZoom: [
                { type: 'inside', xAxisIndex: 0 },
                { type: 'slider', xAxisIndex: 0 },
            ],
            xAxis: {
                type: 'time',
                boundaryGap: false,
                axisLabel: { formatter: (val: number) => format(val, 'HH:mm') },
                axisPointer: { snap: true, label: { show: true } },
            },
            yAxis: [
                { type: 'category', data: STATUSES, axisLabel: { margin: 12 } },
                { type: 'value', min: 0, axisLabel: { formatter: (v: number) => `${v}` }, splitLine: { show: false } },
            ],
            tooltip: { trigger: 'item' },
            series: [
                ...STATUSES.filter(s => statuses.includes(s)).map((status) => ({
                    name: status,
                    type: 'scatter',
                    yAxisIndex: 0,
                    encode: { x: 0, y: 1, tooltip: [0, 2] },
                    itemStyle: { color: STATUS_COLORS[status] },
                    symbolSize: (val: any[]) => {
                        const count = val[2] ?? 1
                        const size = 6 + Math.log10(count + 1) * 12
                        return Math.max(6, Math.min(36, size))
                    },
                    data: seriesByStatus[status],
                    tooltip: {
                        formatter: (p: any) => {
                            const [time, , count] = p.data as [number, number, number]
                            return `${status}<br/>${format(time, 'HH:mm:ss')}<br/>Count: ${count.toLocaleString()}`
                        },
                    },
                })),
                {
                    name: 'Throughput',
                    type: 'line',
                    yAxisIndex: 1,
                    smooth: true,
                    showSymbol: false,
                    lineStyle: { width: 2, color: 'var(--color-green-hard)' },
                    data: throughputSeries,
                    markLine: {
                        symbol: 'none',
                        label: { formatter: 'Now' },
                        lineStyle: { type: 'dashed' },
                        data: [{ xAxis: now }],
                    },
                },
            ],
        }
        return opt
    }, [data, statuses])

    const refresh = useCallback(async () => {
        try {
            await fetchData()
        } catch (e) {
            console.error('BlastPerformance refresh failed', e)
        }
    }, [fetchData])

    useEffect(() => {
        mounted.current = true
        refresh().catch(() => {})
        return () => { mounted.current = false }
    }, [windowKey, channels.join('|'), types.join('|'), statuses.join('|')])

    useEffect(() => {
        const id = setInterval(() => { refresh().catch(() => {}) }, 20000)
        return () => clearInterval(id)
    }, [refresh])

    useEffect(() => {
        setOption(buildOption())
    }, [data, buildOption])

    const kpis = data?.kpisByChannel ?? {}

    return (
        <PageContent
            title="Blasting Performance"
            desc="Time-bucketed sendout performance across channels"
            fullscreen={true}
            actions={
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <SingleSelect
                        size="small"
                        options={WINDOW_PRESETS.map(w => w.key)}
                        value={windowKey}
                        getOptionDisplay={(k: WindowKey) => WINDOW_PRESETS.find(w => w.key === k)!.label}
                        onChange={setWindowKey}
                    />
                    <MultiSelect
                        size="small"
                        placeholder="Channels"
                        options={[...ALL_CHANNELS]}
                        value={channels}
                        onChange={(vals: string[]) => setChannels(vals as Channel[])}
                    />
                    <MultiSelect
                        size="small"
                        placeholder="Types"
                        options={['blast', 'trigger']}
                        value={types}
                        onChange={(vals: string[]) => setTypes(vals)}
                    />
                    <MultiSelect
                        size="small"
                        placeholder="Statuses"
                        options={[...STATUSES]}
                        value={statuses as string[]}
                        onChange={(vals: string[]) => setStatuses(vals as any)}
                    />
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <SwitchField<any, any>
                            label="Use send logs"
                            name={'useLogs' as any}
                            checked={useLogs}
                            onChange={setUseLogs}
                        />
                    </div>
                </div>
            }
        >
            <Heading size="h4" title="KPIs by Channel" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12, marginBottom: 16 }}>
                {Object.keys(kpis).map((ch) => {
                    const k = kpis[ch]
                    return (
                        <div key={ch} style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 12 }}>
                            <div style={{ fontWeight: 600, marginBottom: 6, textTransform: 'uppercase' }}>{ch}</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, fontSize: 12 }}>
                                <div>Sent</div><div style={{ textAlign: 'right' }}>{k.sent?.toLocaleString?.() ?? k.sent}</div>
                                <div>Pending</div><div style={{ textAlign: 'right' }}>{k.pending?.toLocaleString?.() ?? k.pending}</div>
                                <div>Throttled</div><div style={{ textAlign: 'right' }}>{k.throttled?.toLocaleString?.() ?? k.throttled}</div>
                                <div>Failed</div><div style={{ textAlign: 'right' }}>{k.failed?.toLocaleString?.() ?? k.failed}</div>
                                <div>Bounced</div><div style={{ textAlign: 'right' }}>{k.bounced?.toLocaleString?.() ?? k.bounced}</div>
                                <div>Aborted</div><div style={{ textAlign: 'right' }}>{k.aborted?.toLocaleString?.() ?? k.aborted}</div>
                                <div>Upcoming</div><div style={{ textAlign: 'right' }}>{k.upcoming?.toLocaleString?.() ?? k.upcoming}</div>
                                <div>Open Rate</div><div style={{ textAlign: 'right' }}>{((k.openRate ?? 0) * 100).toFixed(1)}%</div>
                                <div>Click Rate</div><div style={{ textAlign: 'right' }}>{((k.clickRate ?? 0) * 100).toFixed(1)}%</div>
                                <div>Success Rate</div><div style={{ textAlign: 'right' }}>{((k.successRate ?? 0) * 100).toFixed(1)}%</div>
                            </div>
                        </div>
                    )
                })}
            </div>

            <Heading size="h4" title="Timeline" />
            <div style={{ width: '100%', height: 520 }}>
                {option && (
                    <ReactECharts
                        option={option}
                        style={{ width: '100%', height: '100%' }}
                        notMerge={true}
                        lazyUpdate={true}
                    />
                )}
            </div>
        </PageContent>
    )
}
