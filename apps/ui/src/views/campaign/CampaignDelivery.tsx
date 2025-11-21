import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import api from '../../api'
import { toast } from 'react-hot-toast/headless'
import { CampaignContext, ProjectContext } from '../../contexts'
import { CampaignSendState, Campaign } from '../../types'
import Alert from '../../ui/Alert'
import Heading from '../../ui/Heading'
import { PreferencesContext } from '../../ui/PreferencesContext'
import { SearchTable, useSearchTableState } from '../../ui/SearchTable'
import Tag, { TagVariant } from '../../ui/Tag'
import Tile, { TileGrid } from '../../ui/Tile'
import { formatDate } from '../../utils'
import { useRoute } from '../router'
import { Translation, useTranslation } from 'react-i18next'
import Button from '../../ui/Button'

const CampaignSendTag = ({ state }: { state: CampaignSendState }) => {
    const variant: Record<CampaignSendState, TagVariant | undefined> = {
        pending: 'info',
        throttled: 'warn',
        bounced: 'error',
        sent: 'success',
        failed: 'error',
        aborted: 'warn',
    }
    return <Tag variant={variant[state]}>
        <Translation>{ (t) => t(state) }</Translation>
    </Tag>
}

export const CampaignStats = ({ state, delivery, progress }: Pick<Campaign, 'state' | 'delivery' | 'progress'>) => {
    const { t } = useTranslation()
    const percent = new Intl.NumberFormat(undefined, { style: 'percent', minimumFractionDigits: 2 })

    const sent = delivery.sent.toLocaleString()
    const total = progress
        ? progress.total.toLocaleString()
        : delivery.total.toLocaleString()
    const deliveryRate = percent.format(delivery.total ? delivery.sent / delivery.total : 0)
    const openRate = percent.format(delivery.total ? delivery.opens / delivery.total : 0)
    const clickRate = percent.format(delivery.total ? delivery.clicks / delivery.total : 0)

    const SentSpan: React.ReactNode = <span>{sent}/<small>{state === 'loading' ? `~${total}` : total}</small></span>

    return (
        <TileGrid numColumns={4}>
            <Tile title={SentSpan} size="large">{t('sent')}</Tile>
            <Tile title={deliveryRate} size="large">{t('delivery_rate')}</Tile>
            <Tile title={openRate} size="large">{t('open_rate')}</Tile>
            <Tile title={clickRate} size="large">{t('click_rate')}</Tile>
        </TileGrid>
    )
}

export default function CampaignDelivery() {
    const [project] = useContext(ProjectContext)
    const { t } = useTranslation()
    const [preferences] = useContext(PreferencesContext)
    const [campaign, setCampaign] = useContext(CampaignContext)
    const { id, state, send_at, delivery, progress } = campaign
    const searchState = useSearchTableState(useCallback(async params => await api.campaigns.users(project.id, id, params), [id, project]))
    const route = useRoute()

    const [exporting, setExporting] = useState(false)
    const [exportPercent, setExportPercent] = useState(0)
    const exportIdRef = useRef<string | null>(null)
    const pollIdRef = useRef<number | null>(null)
    const fmtRef = useRef<'csv' | 'ndjson'>('csv')

    const clearPoll = () => {
        if (pollIdRef.current) {
            clearInterval(pollIdRef.current)
            pollIdRef.current = null
        }
    }

    const storageKey = (fmt: 'csv' | 'ndjson') => `export:campaign:${project.id}:${id}:${fmt}`

    const startExport = useCallback(async (fmt: 'csv' | 'ndjson') => {
        if (exporting) return
        setExporting(true)
        setExportPercent(0)
        try {
            const { export_id } = await api.campaigns.exports.create(project.id, id, { format: fmt, state: 'delivered' })
            exportIdRef.current = export_id
            fmtRef.current = fmt
            sessionStorage.setItem(storageKey(fmt), export_id)
            const poll = async () => {
                if (!exportIdRef.current) return
                const s = await api.campaigns.exports.status(project.id, id, exportIdRef.current)
                const p = Math.max(0, Math.min(100, Math.round(s.percent ?? 0)))
                setExportPercent(p)
                if (s.state === 'completed') {
                    clearPoll()
                    setExporting(false)
                    const dl = api.campaigns.exports.downloadUrl(project.id, id, exportIdRef.current)
                    window.open(dl, '_blank')
                    sessionStorage.removeItem(storageKey(fmtRef.current))
                    toast.success('Export ready')
                } else if (s.state === 'failed') {
                    clearPoll()
                    setExporting(false)
                    sessionStorage.removeItem(storageKey(fmtRef.current))
                    toast.error('Export failed')
                }
            }
            pollIdRef.current = window.setInterval(() => { poll().catch(() => {}) }, 1500) as any
            await poll()
        } catch {
            setExporting(false)
            toast.error('Failed to start export')
        }
    }, [exporting, project.id, id])

    useEffect(() => {
        return () => clearPoll()
    }, [])

    useEffect(() => {
        const resume = async () => {
            const existCsv = sessionStorage.getItem(storageKey('csv'))
            const existNd = sessionStorage.getItem(storageKey('ndjson'))
            const eid = existCsv ?? existNd
            if (!eid) return
            exportIdRef.current = eid
            fmtRef.current = existCsv ? 'csv' : 'ndjson'
            setExporting(true)
            const poll = async () => {
                if (!exportIdRef.current) return
                const s = await api.campaigns.exports.status(project.id, id, exportIdRef.current)
                const p = Math.max(0, Math.min(100, Math.round(s.percent ?? 0)))
                setExportPercent(p)
                if (s.state === 'completed') {
                    clearPoll()
                    setExporting(false)
                    const dl = api.campaigns.exports.downloadUrl(project.id, id, exportIdRef.current)
                    window.open(dl, '_blank')
                    sessionStorage.removeItem(storageKey(fmtRef.current))
                    toast.success('Export ready')
                } else if (s.state === 'failed') {
                    clearPoll()
                    setExporting(false)
                    sessionStorage.removeItem(storageKey(fmtRef.current))
                    toast.error('Export failed')
                }
            }
            pollIdRef.current = window.setInterval(() => { poll().catch(() => {}) }, 1500) as any
            await poll()
        }
        resume().catch(() => {})
    }, [project.id, id])

    useEffect(() => {
        const refresh = () => {
            api.campaigns.get(project.id, campaign.id)
                .then(setCampaign)
                .then(searchState.reload)
                .catch(() => {})
        }

        if (!['loading', 'aborting'].includes(state)) return
        const complete = progress?.complete ?? 0
        const total = progress?.total ?? 0
        const percent = total > 0 ? complete / total * 100 : 0
        const refreshRate = percent < 5 ? 1000 : 5000
        const interval = setInterval(refresh, refreshRate)
        refresh()

        return () => clearInterval(interval)
    }, [state])

    return (
        <>
            <Heading
                title={t('delivery')}
                size="h3"
                actions={
                    <div style={{ display: 'flex', gap: 8 }}>
                        <Button
                            size="small"
                            variant="secondary"
                            disabled={exporting}
                            onClick={async () => { await startExport('csv') }}
                        >{exporting ? `${exportPercent}%` : t('export_delivered_csv')}</Button>
                        <Button
                            size="small"
                            variant="secondary"
                            disabled={exporting}
                            onClick={async () => { await startExport('ndjson') }}
                        >NDJSON</Button>
                    </div>
                }
            />
            {state !== 'draft'
                ? <>
                    {state === 'scheduled'
                        && <Alert title={t('scheduled')}>{t('campaign_alert_scheduled')} <strong>{formatDate(preferences, send_at)}</strong></Alert>
                    }
                    {delivery && <CampaignStats delivery={delivery} state={state} progress={progress} />}
                    <Heading title={t('users')} size="h4" />
                    <SearchTable
                        {...searchState}
                        columns={[
                            { key: 'full_name', title: t('name') },
                            { key: 'email', title: t('email') },
                            { key: 'phone', title: t('phone') },
                            {
                                key: 'state',
                                title: t('state'),
                                cell: ({ item: { state } }) => CampaignSendTag({ state }),
                                sortable: true,
                            },
                            {
                                key: 'send_at',
                                title: t('send_at'),
                                sortable: true,
                                cell: ({ item: { send_at, sent_at } }) => {
                                    const effective = sent_at ?? send_at
                                    return effective ? formatDate(preferences, effective) : ''
                                },
                            },
                            { key: 'opened_at', title: t('opened_at') },
                            { key: 'clicks', title: t('clicks') },
                        ]}
                        onSelectRow={({ id }) => route(`users/${id}`)}
                    />
                </>
                : <Alert variant="plain" title={t('pending')}>{t('campaign_alert_pending')}</Alert>
            }
        </>
    )
}
