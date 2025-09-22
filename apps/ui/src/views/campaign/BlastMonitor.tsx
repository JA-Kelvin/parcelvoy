import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import api from '../../api'
import PageContent from '../../ui/PageContent'
import Heading from '../../ui/Heading'
import { SingleSelect } from '../../ui/form/SingleSelect'
import { CampaignContext, ProjectContext } from '../../contexts'
import ReactECharts from 'echarts-for-react'
import { format } from 'date-fns'
import type { CampaignUser, SearchResult } from '../../types'

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
    { key: '5m', label: '5m (past & next)', ms: 5 * 60 * 1000 },
    { key: '15m', label: '15m (past & next)', ms: 15 * 60 * 1000 },
    { key: '30m', label: '30m (past & next)', ms: 30 * 60 * 1000 },
    { key: '60m', label: '60m (past & next)', ms: 60 * 60 * 1000 },
    { key: '1d', label: '1 day (past & next)', ms: 24 * 60 * 60 * 1000 },
    { key: '2d', label: '2 days (past & next)', ms: 2 * 24 * 60 * 60 * 1000 },
]

function bucketMsForRange(rangeMs: number): number {
    if (rangeMs <= 5 * 60 * 1000) return 5 * 1000
    if (rangeMs <= 15 * 60 * 1000) return 10 * 1000
    if (rangeMs <= 30 * 60 * 1000) return 20 * 1000
    if (rangeMs <= 60 * 60 * 1000) return 60 * 1000
    if (rangeMs <= 24 * 60 * 60 * 1000) return 5 * 60 * 1000
    return 10 * 60 * 1000
}

function floorToBucket(ts: number, bucketMs: number): number {
    return Math.floor(ts / bucketMs) * bucketMs
}

function getStatusForPoint(user: CampaignUser, nowMs: number): (typeof STATUSES)[number] {
    const sendAt = Date.parse(user.send_at)
    if (sendAt > nowMs) return 'Upcoming'
    // else use user state (already constrained by CampaignSendState)
    return user.state as any
}

interface AggregationResult {
    seriesByStatus: Record<(typeof STATUSES)[number], Array<[number, number, number]>> // [time, statusIdx, count]
    sentCountsByBucket: Map<number, number>
    maxBucketCount: number
    startTime: number
    endTime: number
}

export default function BlastMonitor() {
    const [project] = useContext(ProjectContext)
    const [campaign, setCampaign] = useContext(CampaignContext)
    const { id: campaignId } = campaign

    const [windowKey, setWindowKey] = useState<WindowKey>('30m')

    const windowMs = useMemo(() => WINDOW_PRESETS.find(w => w.key === windowKey)!.ms, [windowKey])
    const bucketMs = useMemo(() => bucketMsForRange(windowMs), [windowMs])

    const [option, setOption] = useState<any>()
    const isMounted = useRef(true)

    const fetchCampaign = useCallback(async () => {
        const value = await api.campaigns.get(project.id, campaignId)
        if (isMounted.current) setCampaign(value)
    }, [project.id, campaignId])

    const aggregateWindow = useCallback(async (): Promise<AggregationResult> => {
        const nowMs = Date.now()
        // symmetric window: [now - windowMs, now + windowMs]
        const startTime = nowMs - windowMs
        const endTime = nowMs + windowMs

        const seriesMap = new Map<string, number>() // key: `${bucket}|${status}` => count
        const sentCountsByBucket = new Map<number, number>()
        let maxBucketCount = 0

        let cursor: string | null = null
        const limit = 1000
        const maxRecords = 50000 // safety cap for client-side
        let processed = 0
        let stop = false

        while (!stop && processed < maxRecords) {
            const res: SearchResult<CampaignUser> = await api.campaigns.users(project.id, campaignId, {
                limit,
                sort: 'send_at',
                direction: 'desc',
                cursor: cursor ?? undefined,
            })

            for (const user of res.results) {
                const sendAt = Date.parse(user.send_at)
                if (sendAt < startTime) { // we've gone past window on the old side
                    stop = true
                    break
                }
                if (sendAt > endTime) { // too far in the future, skip but continue
                    continue
                }
                const status = getStatusForPoint(user, nowMs)
                const bucket = floorToBucket(sendAt, bucketMs)
                const key = `${bucket}|${status}`
                const nextCount = (seriesMap.get(key) ?? 0) + 1
                seriesMap.set(key, nextCount)
                if (status === 'sent') {
                    sentCountsByBucket.set(bucket, (sentCountsByBucket.get(bucket) ?? 0) + 1)
                }
                if (nextCount > maxBucketCount) maxBucketCount = nextCount
                processed++
            }

            if (stop || !res.nextCursor) break
            cursor = res.nextCursor
        }

        const seriesByStatus: AggregationResult['seriesByStatus'] = {
            Upcoming: [], pending: [], throttled: [], sent: [], bounced: [], failed: [], aborted: [],
        }

        // Convert map to arrays
        for (const [key, count] of seriesMap.entries()) {
            const [bucketStr, status] = key.split('|') as [string, (typeof STATUSES)[number]]
            const bucket = Number(bucketStr)
            const statusIdx = STATUSES.indexOf(status)
            seriesByStatus[status].push([bucket, statusIdx, count])
        }

        // Sort each series by time
        for (const s of Object.values(seriesByStatus)) {
            s.sort((a, b) => a[0] - b[0])
        }

        return { seriesByStatus, sentCountsByBucket, maxBucketCount, startTime, endTime }
    }, [project.id, campaignId, windowMs, bucketMs])

    const buildOption = useCallback((agg: AggregationResult) => {
        const { delivery } = campaign
        const total = delivery?.total ?? 0
        const currentSent = delivery?.sent ?? 0

        // Build progress series from within-window buckets using baseline = currentSent - sentSinceStart
        let sentSinceStart = 0
        for (const [bucket, count] of agg.sentCountsByBucket.entries()) {
            if (bucket >= agg.startTime && bucket <= Date.now()) sentSinceStart += count
        }
        const baseline = Math.max(0, currentSent - sentSinceStart)
        const progressSeries: Array<[number, number]> = []
        const bucketTimes = Array.from(new Set([...agg.sentCountsByBucket.keys()])).sort((a, b) => a - b)
        let cumulative = 0
        for (const bt of bucketTimes) {
            cumulative += agg.sentCountsByBucket.get(bt) ?? 0
            const pct = total > 0 ? ((baseline + cumulative) / total) * 100 : 0
            progressSeries.push([bt, pct])
        }

        const option: any = {
            grid: { left: 80, right: 60, top: 40, bottom: 60 },
            legend: { data: [...STATUSES, 'Progress'] },
            dataZoom: [
                { type: 'inside', xAxisIndex: 0 },
                { type: 'slider', xAxisIndex: 0 },
            ],
            xAxis: {
                type: 'time',
                min: agg.startTime,
                max: agg.endTime,
                boundaryGap: false,
                axisLabel: { formatter: (val: number) => format(val, 'HH:mm') },
                axisPointer: { snap: true, label: { show: true } },
            },
            yAxis: [
                { type: 'category', data: STATUSES, axisLabel: { margin: 12 } },
                { type: 'value', min: 0, max: 100, axisLabel: { formatter: (v: number) => `${v}%` }, splitLine: { show: false } },
            ],
            tooltip: { trigger: 'item' },
            series: [
                ...STATUSES.map((status) => ({
                    name: status,
                    type: 'scatter',
                    yAxisIndex: 0,
                    encode: { x: 0, y: 1, tooltip: [0, 2] },
                    itemStyle: { color: STATUS_COLORS[status] },
                    symbolSize: (val: any[]) => {
                        const count = val[2] ?? 1
                        // log-like scaling capped to reasonable size
                        const size = 6 + Math.log10(count + 1) * 12
                        return Math.max(6, Math.min(36, size))
                    },
                    data: agg.seriesByStatus[status],
                    tooltip: {
                        formatter: (p: any) => {
                            const [time, , count] = p.data as [number, number, number]
                            return `${status}<br/>${format(time, 'HH:mm:ss')}<br/>Count: ${count.toLocaleString()}`
                        },
                    },
                })),
                {
                    name: 'Progress',
                    type: 'line',
                    yAxisIndex: 1,
                    smooth: true,
                    showSymbol: false,
                    lineStyle: { width: 2, color: 'var(--color-green-hard)' },
                    data: progressSeries,
                    tooltip: { valueFormatter: (v: number) => `${(v ?? 0).toFixed(2)}%` },
                    markLine: {
                        symbol: 'none',
                        label: { formatter: 'Now' },
                        lineStyle: { type: 'dashed' },
                        data: [{ xAxis: Date.now() }],
                    },
                },
            ],
        }
        return option
    }, [campaign])

    const refresh = useCallback(async () => {
        try {
            await fetchCampaign()
            const agg = await aggregateWindow()
            const opt = buildOption(agg)
            if (isMounted.current) setOption(opt)
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error('BlastMonitor refresh failed', e)
        }
    }, [fetchCampaign, aggregateWindow, buildOption])

    // Initial and polling refresh
    useEffect(() => {
        isMounted.current = true
        refresh().catch(() => {})
        return () => { isMounted.current = false }
    }, [windowKey])

    useEffect(() => {
        // adaptive polling cadence like CampaignDelivery
        const percent = (campaign.progress?.total ?? 0) > 0
            ? (campaign.progress!.complete / campaign.progress!.total) * 100
            : 0
        const refreshRate = percent < 5 ? 1000 : 5000
        const id = setInterval(() => { refresh().catch(() => {}) }, refreshRate)
        return () => clearInterval(id)
    }, [campaign.progress?.complete, campaign.progress?.total, refresh])

    return (
        <PageContent
            title="Blasting Monitor"
            desc="Real-time blasting progress by status (time vs status)"
            fullscreen={true}
            actions={
                <div style={{ display: 'flex', gap: 12 }}>
                    <SingleSelect
                        size="small"
                        options={WINDOW_PRESETS.map(w => w.key)}
                        value={windowKey}
                        getOptionDisplay={(k: WindowKey) => WINDOW_PRESETS.find(w => w.key === k)!.label}
                        onChange={setWindowKey}
                    />
                </div>
            }
        >
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
