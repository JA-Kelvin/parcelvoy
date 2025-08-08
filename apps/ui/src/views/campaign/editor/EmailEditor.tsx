import { SetStateAction, Suspense, lazy, useContext, useEffect, useState } from 'react'
import { CampaignContext, LocaleContext, LocaleSelection, ProjectContext } from '../../../contexts'
import './EmailEditor.css'
import Button, { LinkButton } from '../../../ui/Button'
import api from '../../../api'
import { Campaign, Resource, Template } from '../../../types'
import { useBlocker, useNavigate } from 'react-router'
import { localeState } from '../CampaignDetail'
import Modal from '../../../ui/Modal'
import HtmlEditor from './HtmlEditor'
import LocaleSelector from '../LocaleSelector'
import { toast } from 'react-hot-toast/headless'
import { QuestionIcon } from '../../../ui/icons'
import { useTranslation } from 'react-i18next'
import ResourceModal from '../ResourceModal'
import EnhancedVisualEditor from './EnhancedVisualEditor'

const VisualEditor = lazy(async () => await import('./VisualEditor'))
const LazyEnhancedVisualEditorDndKit = lazy(async () => await import('./EnhancedVisualEditorDndKit'))

export default function EmailEditor() {
    const navigate = useNavigate()
    const { t } = useTranslation()
    const [project] = useContext(ProjectContext)
    const [campaign, setCampaign] = useContext(CampaignContext)
    const { templates } = campaign

    const [locale, setLocale] = useState<LocaleSelection>(localeState(templates ?? []))
    const [resources, setResources] = useState<Resource[]>([])

    const [template, setTemplate] = useState<Template | undefined>(templates[0])
    const [isSaving, setIsSaving] = useState(false)
    const [showConfig, setShowConfig] = useState(false)
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
    const [useDndKit, setUseDndKit] = useState(false)

    useEffect(() => {
        api.resources.all(project.id)
            .then(resources => setResources(resources))
            .catch(() => setResources([]))
    }, [])

    const blocker = useBlocker(
        ({ currentLocation, nextLocation }) => hasUnsavedChanges && currentLocation.pathname !== nextLocation.pathname,
    )

    useEffect(() => {
        if (blocker.state !== 'blocked') return
        if (confirm(t('confirm_unsaved_changes'))) {
            blocker.proceed()
        } else {
            blocker.reset()
        }
    }, [blocker.state])

    async function handleTemplateSave({ id, type, data }: Template) {
        setIsSaving(true)
        try {
            const value = await api.templates.update(project.id, id, { type, data })

            const newCampaign = { ...campaign }
            newCampaign.templates = templates.map(obj => obj.id === id ? value : obj)
            setCampaign(newCampaign)
            toast.success(t('template_saved'))
        } finally {
            setHasUnsavedChanges(false)
            setIsSaving(false)
        }
    }

    const handleTemplateChange = (change: SetStateAction<Template | undefined>) => {
        setHasUnsavedChanges(true)
        setTemplate(change)
    }

    const campaignChange = (change: SetStateAction<Campaign>) => {
        setCampaign(change)
    }

    return (
        <>
            <LocaleContext.Provider value={[locale, setLocale]}>
                <Modal
                    size="fullscreen"
                    title={campaign.name}
                    open
                    onClose={async () => {
                        await navigate(`../campaigns/${campaign.id}/design?locale=${locale.currentLocale?.key}`)
                    }}
                    actions={
                        <>
                            <Button
                                size="small"
                                variant="secondary"
                                onClick={() => setUseDndKit(!useDndKit)}
                            >{useDndKit ? 'Use React-DnD' : 'Use DndKit'}</Button>
                            <Button
                                size="small"
                                variant="secondary"
                                onClick={() => setShowConfig(true)}
                            >Config</Button>
                            <LinkButton
                                icon={<QuestionIcon />}
                                variant="secondary"
                                size="small"
                                to="https://docs.parcelvoy.com/how-to/campaigns/templates"
                                target="_blank" />
                            <LocaleSelector campaignState={[campaign, campaignChange]} />
                            {template && (
                                <Button
                                    size="small"
                                    isLoading={isSaving}
                                    onClick={async () => await handleTemplateSave(template)}
                                >{t('template_save')}</Button>
                            )}
                        </>
                    }
                >
                    <section className="email-editor">
                        {templates.filter(template => template.locale === locale.currentLocale?.key)
                            .map(template => {
                                // Enhanced Visual Editor (new default)
                                if (template.data.editor === 'enhanced-visual'
                                    || (template.data.editor === 'visual' && !template.data.mjml)) {
                                    return useDndKit
                                        ? (
                                            <Suspense key={`${template.id}-dndkit-suspense`} fallback={<div className="loading-editor">Loading DndKit editor...</div>}>
                                                <LazyEnhancedVisualEditorDndKit
                                                    key={`${template.id}-dndkit`}
                                                    template={template}
                                                    setTemplate={handleTemplateChange}
                                                    resources={resources}
                                                />
                                            </Suspense>
                                        )
                                        : (
                                            <EnhancedVisualEditor
                                                key={template.id}
                                                template={template}
                                                setTemplate={handleTemplateChange}
                                                resources={resources}
                                            />
                                        )
                                }
                                // Legacy Visual Editor (GrapesJS)
                                if (template.data.editor === 'visual') {
                                    return (
                                        <Suspense key={template.id} fallback={null}>
                                            <VisualEditor
                                                template={template}
                                                setTemplate={handleTemplateChange}
                                                resources={resources}
                                            />
                                        </Suspense>
                                    )
                                }
                                // HTML Editor
                                return (
                                    <HtmlEditor
                                        template={template}
                                        key={template.id}
                                        setTemplate={handleTemplateChange}
                                    />
                                )
                            })
                        }
                    </section>

                    <ResourceModal
                        open={showConfig}
                        onClose={() => setShowConfig(false)}
                        resources={resources}
                        setResources={setResources}
                    />
                </Modal>
            </LocaleContext.Provider>
        </>
    )
}
