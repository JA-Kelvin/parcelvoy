import { useState, useContext } from 'react'
import { JourneyContext, ProjectContext } from '../../contexts'
import Button from '../../ui/Button'
import PageContent from '../../ui/PageContent'
import JourneyEditor from './JourneyEditor'
import { useTranslation } from 'react-i18next'

export default function JourneyDetail() {

    const { t } = useTranslation()
    const [journey] = useContext(JourneyContext)
    const [project] = useContext(ProjectContext)
    const [open, setOpen] = useState<null | 'edit-steps'>(null)
    const isEditor = project.role === 'editor'

    return (
        <PageContent
            title={journey.name}
            actions={
                !isEditor ? (
                    <Button onClick={() => setOpen('edit-steps')}>{t('edit_journey_steps')}</Button>
                ) : null
            }
        >
            {
                open === 'edit-steps' && <JourneyEditor />
            }
        </PageContent>
    )
}
