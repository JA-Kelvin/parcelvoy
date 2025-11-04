import { useCallback, useMemo, useState } from 'react'
import { useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import PageContent from '../../ui/PageContent'
import { SearchTable, useSearchTableQueryState } from '../../ui/SearchTable'
import api from '../../api'
import { Button, Modal } from '../../ui'
import { InfoTable } from '../../ui/InfoTable'
import TextInput from '../../ui/form/TextInput'
import { SingleSelect } from '../../ui/form/SingleSelect'

export default function ErrorLogs() {
    const { projectId = '' } = useParams()
    const { t } = useTranslation()

    const state = useSearchTableQueryState<any>(useCallback(async params => await api.errorLogs.search(projectId, params), [projectId]), {
        limit: 25,
        sort: 'id',
        direction: 'desc',
        filter: {},
    })

    const filter = state.params.filter ?? {}
    const setFilter = (patch: Record<string, any>) => state.setParams({ ...state.params, filter: { ...filter, ...patch } })

    const [pruneOpen, setPruneOpen] = useState(false)
    const [selected, setSelected] = useState<any | null>(null)
    const [pruneResult, setPruneResult] = useState<{ count?: number, deleted?: number } | null>(null)
    const [pruneDays, setPruneDays] = useState<string>('30')
    const [pruneBefore, setPruneBefore] = useState<string>('')

    const exportUrlNdjson = useMemo(() => api.errorLogs.exportUrl(projectId, { format: 'ndjson', filter }), [projectId, filter])
    const exportUrlCsv = useMemo(() => api.errorLogs.exportUrl(projectId, { format: 'csv', filter }), [projectId, filter])

    const dryRunPrune = async () => {
        const res = await api.errorLogs.prune(projectId, {
            before: pruneBefore || undefined,
            days: pruneDays ? parseInt(pruneDays, 10) : undefined,
            dryRun: true,
            filter,
        })
        setPruneResult(res)
    }

    const confirmPrune = async () => {
        const res = await api.errorLogs.prune(projectId, {
            before: pruneBefore || undefined,
            days: pruneDays ? parseInt(pruneDays, 10) : undefined,
            dryRun: false,
            filter,
        })
        setPruneResult(res)
        await state.reload()
        setPruneOpen(false)
    }

    return (
        <>
            <PageContent
                title={t('Error Logs')}
                actions={
                    <div style={{ display: 'flex', gap: 8 }}>
                        <a href={exportUrlNdjson} target="_blank" rel="noreferrer">
                            <Button variant="secondary">NDJSON</Button>
                        </a>
                        <a href={exportUrlCsv} target="_blank" rel="noreferrer">
                            <Button variant="secondary">CSV</Button>
                        </a>
                        <Button variant="destructive" onClick={() => { setPruneResult(null); setPruneOpen(true) }}>{t('Prune')}</Button>
                    </div>
                }
            >
                <SearchTable
                    {...state}
                    enableSearch
                    searchPlaceholder={t('Search by message')}
                    filters={[
                        <TextInput key="code" name="code" label={t('Code')} value={filter.code ?? ''} onChange={v => setFilter({ code: v || undefined })} />,
                        <TextInput key="path" name="path" label={t('Path')} value={filter.path ?? ''} onChange={v => setFilter({ path: v || undefined })} />,
                        <SingleSelect key="method" label={t('Method')} value={filter.method ?? ''} onChange={v => setFilter({ method: v || undefined })} options={['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']} />,
                        <SingleSelect key="status" label={t('Status')} value={(filter.status ?? '').toString()} onChange={v => setFilter({ status: v ? parseInt(v, 10) : undefined })} options={['400', '401', '403', '404', '429', '500', '502', '503']} />,
                        <TextInput key="from" name="from" label={t('From (ISO)')} value={filter.from ?? ''} onChange={v => setFilter({ from: v || undefined })} />,
                        <TextInput key="to" name="to" label={t('To (ISO)')} value={filter.to ?? ''} onChange={v => setFilter({ to: v || undefined })} />,
                    ]}
                    columns={[
                        { key: 'id', title: t('ID'), sortable: true },
                        { key: 'created_at', title: t('Created'), sortable: true },
                        { key: 'status', title: t('Status'), sortable: true },
                        { key: 'code', title: t('Code') },
                        { key: 'method', title: t('Method') },
                        { key: 'path', title: t('Path') },
                        { key: 'message', title: t('Message') },
                        { key: 'request_id', title: t('Request ID') },
                    ]}
                    onSelectRow={item => setSelected(item)}
                    selectedRow={selected?.id}
                />

                <Modal open={pruneOpen} onClose={() => setPruneOpen(false)} title={t('Prune Error Logs')}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                        <TextInput name="days" label={t('Older than (days)')} value={pruneDays} onChange={setPruneDays} />
                        <TextInput name="before" label={t('Or before (ISO)')} value={pruneBefore} onChange={setPruneBefore} />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <Button variant="secondary" onClick={dryRunPrune}>{t('Dry Run')}</Button>
                        <Button variant="destructive" onClick={confirmPrune}>{t('Confirm Prune')}</Button>
                    </div>
                    {pruneResult && (
                        <div style={{ marginTop: 12 }}>
                            {pruneResult.count != null && <div>{t('Would delete')} {pruneResult.count}</div>}
                            {pruneResult.deleted != null && <div>{t('Deleted')} {pruneResult.deleted}</div>}
                        </div>
                    )}
                </Modal>
            </PageContent>
            <Modal open={!!selected} onClose={() => setSelected(null)} title={t('Error Log Detail')}>
                {selected && (
                    <div style={{ display: 'grid', gap: 12 }}>
                        <InfoTable rows={{
                            id: selected.id,
                            created_at: selected.created_at,
                            status: selected.status,
                            code: selected.code,
                            method: selected.method,
                            path: selected.path,
                            request_id: selected.request_id,
                            user_id: selected.user_id,
                            project_id: selected.project_id,
                            message: selected.message,
                        }} />
                        {selected.stack && (
                            <div>
                                <div style={{ fontWeight: 600, marginBottom: 4 }}>Stack</div>
                                <div style={{ maxHeight: 300, overflow: 'auto', background: '#f6f8fa', padding: 8, borderRadius: 4 }}>
                                    {selected.stack}
                                </div>
                            </div>
                        )}
                        {selected.context && (
                            <div>
                                <div style={{ fontWeight: 600, marginBottom: 4 }}>Context</div>
                                <div style={{ maxHeight: 300, overflow: 'auto', background: '#f6f8fa', padding: 8, borderRadius: 4 }}>
                                    {typeof selected.context === 'string' ? selected.context : JSON.stringify(selected.context, null, 2)}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </>
    )
}
