import { useCallback, useContext, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { JourneyContext, ProjectContext } from '../../contexts'
import { SearchTable, useSearchTableState } from '../../ui/SearchTable'
import api from '../../api'
import { Button, Menu, MenuItem, Modal, Tag } from '../../ui'
import { camelToTitle } from '../../utils'
import { UserLookup } from '../users/UserLookup'
import { typeVariants } from './EntranceDetails'
import { ModalProps } from '../../ui/Modal'
import { JourneyUserStep, User } from '../../types'
import { EditIcon } from '../../ui/icons'
import { DataTableCol } from '../../ui/DataTable'

interface StepUsersProps extends Omit<ModalProps, 'title'> {
    stepId: number
    stepType: string
}

export function JourneyStepUsers({ open, onClose, stepType, stepId }: StepUsersProps) {

    const { t } = useTranslation()
    const [{ id: projectId }] = useContext(ProjectContext)
    const [{ id: journeyId }] = useContext(JourneyContext)
    const [isUserLookupOpen, setIsUserLookupOpen] = useState(false)
    const isEntrance = stepType === 'entrance'
    const options: Array<DataTableCol<JourneyUserStep>> = stepType === 'delay'
        ? [{
            key: 'options',
            title: t('options'),
            cell: ({ item: { id, user } }) => {
                if (user) {
                    return (
                        <Menu size="small">
                            <MenuItem onClick={async () => await handleSkipDelay(id, user)}>
                                <EditIcon />{t('skip_delay')}
                            </MenuItem>
                        </Menu>
                    )
                }
                return <></>
            },
        }]
        : []

    const state = useSearchTableState(useCallback(async params => await api.journeys.steps.searchUsers(projectId, journeyId, stepId, params), [projectId, journeyId, stepId]), {
        limit: 10,
        sort: 'id',
        direction: 'desc',
    })

    const handleAddUserToEntrance = async (stepId: number, user: User) => {
        await api.journeys.users.trigger(projectId, journeyId, stepId, user)
        await state.reload()
    }

    const handleSkipDelay = async (stepId: number, user: User) => {
        await api.journeys.users.skipDelay(projectId, journeyId, user.id, stepId)
        await state.reload()
    }

    return <>
        <Modal
            open={open}
            onClose={onClose}
            title={t('users')}
            size="large"
            actions={
                isEntrance && <Button
                    size="small"
                    variant="primary"
                    onClick={() => setIsUserLookupOpen(true)}
                >{t('journey_add_user_to_entrance')}</Button>
            }
        >
            <SearchTable
                {...state}
                columns={[
                    {
                        key: 'name',
                        title: t('name'),
                        cell: ({ item }) => item.user!.full_name ?? '-',
                    },
                    {
                        key: 'external_id',
                        title: t('external_id'),
                        cell: ({ item }) => item.user?.external_id ?? '-',
                    },
                    {
                        key: 'email',
                        title: t('email'),
                        cell: ({ item }) => item.user?.email ?? '-',
                    },
                    {
                        key: 'phone',
                        title: t('phone'),
                        cell: ({ item }) => item.user?.phone ?? '-',
                    },
                    {
                        key: 'type',
                        title: t('type'),
                        cell: ({ item }) => (
                            <Tag variant={typeVariants[item.type]}>
                                {camelToTitle(item.type)}
                            </Tag>
                        ),
                    },
                    {
                        key: 'created_at',
                        title: t('step_date'),
                    },
                    {
                        key: 'delay_until',
                        title: t('delay_until'),
                    },
                    ...options,
                ]}
                onSelectRow={isEntrance ? ({ id }) => window.open(`/projects/${projectId}/entrances/${id}`, '_blank') : undefined}
            />
            <UserLookup
                open={isUserLookupOpen}
                onClose={setIsUserLookupOpen}
                onSelected={async user => await handleAddUserToEntrance(stepId, user)} />
        </Modal>
    </>
}
