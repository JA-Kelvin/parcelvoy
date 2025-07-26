import { useCallback, useContext, useState } from 'react'
import { useNavigate } from 'react-router'
import api, { apiUrl } from '../../api'
import { Campaign, CampaignDelivery, CampaignState } from '../../types'
import Button, { LinkButton } from '../../ui/Button'
import { ArchiveIcon, DuplicateIcon, EditIcon, PlusIcon } from '../../ui/icons'
import Menu, { MenuItem } from '../../ui/Menu'
import Modal from '../../ui/Modal'
import PageContent from '../../ui/PageContent'
import { SearchTable, useSearchTableQueryState } from '../../ui/SearchTable'
import Tag, { TagVariant } from '../../ui/Tag'
import { formatDate, snakeToTitle } from '../../utils'
import { CampaignForm } from './CampaignForm'
import { ChannelIcon } from './ChannelTag'
import PreviewImage from '../../ui/PreviewImage'
import { Alert } from '../../ui'
import { ProjectContext } from '../../contexts'
import { PreferencesContext } from '../../ui/PreferencesContext'
import { Translation, useTranslation } from 'react-i18next'
import { SingleSelect } from '../../ui/form/SingleSelect'

export const CampaignTag = ({ state, progress, send_at }: Pick<Campaign, 'state' | 'progress' | 'send_at'>) => {
    const variant: Record<CampaignState, TagVariant> = {
        draft: 'plain',
        aborted: 'error',
        aborting: 'error',
        loading: 'info',
        scheduled: 'info',
        running: 'info',
        finished: 'success',
    }

    const complete = progress?.complete ?? 0
    const total = progress?.total ?? 0
    const percent = total > 0 ? complete / total : 0
    const percentStr = percent.toLocaleString(undefined, { style: 'percent', minimumFractionDigits: 0 })

    const label = state === 'aborting' && send_at ? 'rescheduling' : state

    return <Tag variant={variant[state]}>
        <Translation>{ (t) => t(label) }</Translation>
        {progress && ` (${percentStr})`}
    </Tag>
}

export const DeliveryRatio = ({ delivery }: { delivery: CampaignDelivery }) => {
    const sent = (delivery?.sent ?? 0)
    const total = (delivery?.total ?? 0)
    const ratio = sent > 0 ? sent / total : 0
    const sentStr = sent.toLocaleString()
    const ratioStr = ratio.toLocaleString(undefined, { style: 'percent', minimumFractionDigits: 0 })
    return `${sentStr} (${ratioStr})`
}

export const OpenRate = ({ delivery }: { delivery: CampaignDelivery }) => {
    const opens = (delivery?.opens ?? 0)
    const sent = (delivery?.sent ?? 0)
    const ratio = sent > 0 ? opens / sent : 0
    const opensStr = opens.toLocaleString()
    const ratioStr = ratio.toLocaleString(undefined, { style: 'percent', minimumFractionDigits: 0 })
    return `${opensStr} (${ratioStr})`
}

export const ClickRate = ({ delivery }: { delivery: CampaignDelivery }) => {
    const clicks = (delivery?.clicks ?? 0)
    const sent = (delivery?.sent ?? 0)
    const ratio = sent > 0 ? clicks / sent : 0
    const clicksStr = clicks.toLocaleString()
    const ratioStr = ratio.toLocaleString(undefined, { style: 'percent', minimumFractionDigits: 0 })
    return `${clicksStr} (${ratioStr})`
}

const campaignTypes = [
    { key: 'blast', label: 'Blast' },
    { key: 'trigger', label: 'Journey' },
]

export default function Campaigns() {
    const [project] = useContext(ProjectContext)
    const { t } = useTranslation()
    const navigate = useNavigate()
    const [preferences] = useContext(PreferencesContext)
    const state = useSearchTableQueryState(
        useCallback(async params => await api.campaigns.search(project.id, params), [project.id]),
        {
            filter: {
                type: 'blast',
            },
        })
    const [isCreateOpen, setIsCreateOpen] = useState(false)

    const handleCreateCampaign = async (campaign: Campaign) => {
        setIsCreateOpen(false)
        await navigate(`${campaign.id}/design`)
    }

    const handleEditCampaign = async (id: number) => {
        await navigate(id.toString())
    }

    const handleDuplicateCampaign = async (id: number) => {
        const campaign = await api.campaigns.duplicate(project.id, id)
        await navigate(campaign.id.toString())
    }

    const handleArchiveCampaign = async (id: number) => {
        await api.campaigns.delete(project.id, id)
        await state.reload()
    }

    return (
        <>
            <PageContent title={t('campaigns')} actions={
                <Button icon={<PlusIcon />} onClick={() => setIsCreateOpen(true)}>{t('create_campaign')}</Button>
            } banner={project.has_provider === false && (
                <Alert
                    variant="plain"
                    title={t('setup')}
                    actions={
                        <LinkButton to={`/projects/${project.id}/settings/integrations`}>{t('setup_integration')}</LinkButton>
                    }
                >{t('setup_integration_description')}</Alert>
            )}>
                <SearchTable
                    {...state}
                    columns={[
                        {
                            key: 'name',
                            title: t('name'),
                            sortable: true,
                            minWidth: '225px',
                            cell: ({ item: { id, name, channel } }) => (
                                <div className="multi-cell">
                                    { channel === 'email'
                                        ? <PreviewImage url={apiUrl(project.id, `campaigns/${id}/preview`)} width={50} height={40}>
                                            <div className="placeholder">
                                                <ChannelIcon channel={channel} />
                                            </div>
                                        </PreviewImage>
                                        : <div className="placeholder">
                                            <ChannelIcon channel={channel} />
                                        </div>
                                    }
                                    <div className="text">
                                        <div className="title">{name}</div>
                                        <div className="subtitle">
                                            {snakeToTitle(channel)}</div>
                                    </div>
                                </div>
                            ),
                        },
                        {
                            key: 'state',
                            title: t('state'),
                            sortable: true,
                            cell: ({ item: { state, send_at } }) => CampaignTag({ state, send_at }),
                        },
                        {
                            key: 'delivery',
                            title: t('delivery'),
                            cell: ({ item: { delivery } }) => DeliveryRatio({ delivery }),
                        },
                        {
                            key: 'engagement',
                            title: t('engagement'),
                            cell: ({ item: { channel, delivery } }) => delivery?.opens > 0
                                ? (
                                    <div className="multi-cell no-image">
                                        <div className="text">
                                            <div className="title">
                                                {OpenRate({ delivery })} {t('open_rate')}
                                            </div>
                                            {channel === 'email' && <div className="subtitle">
                                                {ClickRate({ delivery })} {t('click_rate')}
                                            </div>}
                                        </div>
                                    </div>
                                )
                                : null,
                        },
                        {
                            key: 'send_at',
                            sortable: true,
                            title: t('launched_at'),
                            cell: ({ item: { send_at, type } }) => {
                                return send_at != null
                                    ? formatDate(preferences, send_at, 'Pp')
                                    : type === 'trigger'
                                        ? t('api_triggered')
                                        : <>&#8211;</>
                            },
                        },
                        {
                            key: 'updated_at',
                            title: t('updated_at'),
                            sortable: true,
                        },
                        {
                            key: 'options',
                            title: t('options'),
                            cell: ({ item: { id } }) => (
                                <Menu size="small">
                                    <MenuItem onClick={async () => await handleEditCampaign(id)}>
                                        <EditIcon />{t('edit')}
                                    </MenuItem>
                                    <MenuItem onClick={async () => await handleDuplicateCampaign(id)}>
                                        <DuplicateIcon />{t('duplicate')}
                                    </MenuItem>
                                    <MenuItem onClick={async () => await handleArchiveCampaign(id)}>
                                        <ArchiveIcon />{t('archive')}
                                    </MenuItem>
                                </Menu>
                            ),
                        },
                    ]}
                    onSelectRow={async ({ id }) => { await navigate(id.toString()) }}
                    enableSearch
                    tagEntity="campaigns"
                    filters={[
                        <SingleSelect
                            key="type"
                            options={campaignTypes}
                            prefix={t('type')}
                            value={state.params.filter?.type}
                            onChange={value => state.setParams({
                                ...state.params,
                                filter: {
                                    ...state.params.filter,
                                    type: value,
                                },
                            })}
                            toValue={(value) => value.key}
                        />,
                    ]}
                />
            </PageContent>
            <Modal
                open={isCreateOpen}
                onClose={setIsCreateOpen}
                title={t('create_campaign')}
                size="large"
            >
                <CampaignForm onSave={handleCreateCampaign} />
            </Modal>
        </>
    )
}
