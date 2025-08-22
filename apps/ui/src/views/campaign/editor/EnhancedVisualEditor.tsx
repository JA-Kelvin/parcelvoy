// Enhanced Visual Editor Integration for Parcelvoy
import React, { useCallback, useContext, useEffect, useState } from 'react'
import { Template } from '../../../types'
import { EnhancedTemplate, TemplateBlock } from './enhanced/types'
import EnhancedMjmlEditor from './enhanced/EnhancedMjmlEditor'
import { ProjectContext } from '../../../contexts'
import api from '../../../api'
import { normalizeArrayShapes } from './enhanced/utils/arrayUtils'

interface EnhancedVisualEditorProps {
    template: Template
    setTemplate: (template: Template) => void
    resources: any[]
}

const EnhancedVisualEditor: React.FC<EnhancedVisualEditorProps> = ({
    template,
    setTemplate,
    resources,
}) => {
    const [project] = useContext(ProjectContext)
    const [isSaving, setIsSaving] = useState(false)
    const [projectWideCustomTemplates, setProjectWideCustomTemplates] = useState<TemplateBlock[]>([])
    const [templatesLoading, setTemplatesLoading] = useState<boolean>(false)
    const [templatesError, setTemplatesError] = useState<string | null>(null)
    // Convert Parcelvoy Template to Enhanced Template
    const convertToEnhancedTemplate = (parcelvoyTemplate: Template): EnhancedTemplate => {
        const normalizedElements = normalizeArrayShapes(parcelvoyTemplate.data.elements)
        return {
            id: String(parcelvoyTemplate.id),
            type: parcelvoyTemplate.type,
            locale: parcelvoyTemplate.locale,
            data: {
                editor: 'enhanced-visual',
                mjml: parcelvoyTemplate.data.mjml || '<mjml><mj-body></mj-body></mjml>',
                html: parcelvoyTemplate.data.html || '',
                elements: Array.isArray(normalizedElements) ? normalizedElements : undefined,
                customTemplates: Array.isArray(parcelvoyTemplate.data.customTemplates)
                    ? parcelvoyTemplate.data.customTemplates
                    : [],
                metadata: parcelvoyTemplate.data.metadata ?? {
                    id: String(parcelvoyTemplate.id),
                    name: `Template ${parcelvoyTemplate.id}`,
                    savedAt: new Date().toISOString(),
                },
            },
        }
    }

    // Convert Enhanced Template back to Parcelvoy Template
    // IMPORTANT: Merge into existing template.data so details like from name/email/subject are preserved.
    const convertToParcelvoyTemplate = (enhancedTemplate: EnhancedTemplate): Template => {
        const mergedData = {
            ...template.data, // keep existing non-editor fields (from, subject, preheader, reply_to, cc, bcc, text, etc.)
            editor: 'enhanced-visual',
            mjml: enhancedTemplate.data.mjml,
            html: enhancedTemplate.data.html,
            ...(enhancedTemplate.data.elements && { elements: enhancedTemplate.data.elements }),
            customTemplates: Array.isArray(enhancedTemplate.data.customTemplates)
                ? enhancedTemplate.data.customTemplates
                : (Array.isArray(template.data?.customTemplates) ? template.data.customTemplates : []),
            metadata: enhancedTemplate.data.metadata ?? template.data?.metadata,
        }

        return {
            ...template, // Preserve template meta (id, type, locale, etc.)
            data: mergedData,
        }
    }

    const handleTemplateChange = useCallback((enhancedTemplate: EnhancedTemplate) => {
        const parcelvoyTemplate = convertToParcelvoyTemplate(enhancedTemplate)
        setTemplate(parcelvoyTemplate)
    }, [setTemplate])

    // Handle template save using Parcelvoy API
    const handleTemplateSave = useCallback(async (enhancedTemplate: EnhancedTemplate) => {
        setIsSaving(true)
        try {
            // Convert enhanced template back to Parcelvoy format
            const parcelvoyTemplate = convertToParcelvoyTemplate(enhancedTemplate)

            // Call Parcelvoy API to update the template
            const updatedTemplate = await api.templates.update(
                project.id,
                template.id,
                {
                    type: parcelvoyTemplate.type,
                    data: parcelvoyTemplate.data,
                },
            )

            // Some backends may not persist or echo certain fields.
            // Merge them back from the local payload if missing in the server response.
            const serverHasCustoms = Array.isArray(updatedTemplate?.data?.customTemplates)
            const mergedData = {
                ...updatedTemplate.data,
                // Email details fallbacks
                from: updatedTemplate.data?.from ?? parcelvoyTemplate.data?.from,
                subject: updatedTemplate.data?.subject ?? parcelvoyTemplate.data?.subject,
                preheader: updatedTemplate.data?.preheader ?? parcelvoyTemplate.data?.preheader,
                reply_to: updatedTemplate.data?.reply_to ?? parcelvoyTemplate.data?.reply_to,
                cc: updatedTemplate.data?.cc ?? parcelvoyTemplate.data?.cc,
                bcc: updatedTemplate.data?.bcc ?? parcelvoyTemplate.data?.bcc,
                // Editor extensions and metadata
                customTemplates: serverHasCustoms
                    ? updatedTemplate.data.customTemplates
                    : (Array.isArray(parcelvoyTemplate.data.customTemplates)
                        ? parcelvoyTemplate.data.customTemplates
                        : []),
                metadata: updatedTemplate.data?.metadata ?? parcelvoyTemplate.data?.metadata,
            }

            const finalTemplate = {
                ...updatedTemplate,
                data: mergedData,
            }

            if (!serverHasCustoms) {
                // Helpful debug log for diagnosing persistence gaps
                console.warn('[EnhancedVisualEditor] API response missing data.customTemplates; using local copy instead')
            }

            // Update the template state with the merged result
            setTemplate(finalTemplate)

        } catch (error) {
            console.error('Failed to save template:', error)
            throw error // Re-throw to let the enhanced editor handle the error display
        } finally {
            setIsSaving(false)
        }
    }, [project.id, template.id, setTemplate])

    const enhancedTemplate = convertToEnhancedTemplate(template)

    // Fetch and merge project-wide custom templates
    useEffect(() => {
        let cancelled = false
        const fetchTemplates = async () => {
            setTemplatesLoading(true)
            setTemplatesError(null)
            try {
                const res: any = await api.templates.search(project.id, { limit: 1000 })
                const results: any[] = Array.isArray(res?.results) ? res.results : []
                const merged: TemplateBlock[] = []
                const seen = new Set<string>()
                for (const tpl of results) {
                    const customs: TemplateBlock[] = Array.isArray(tpl?.data?.customTemplates) ? tpl.data.customTemplates : []
                    for (const block of customs) {
                        const key = String(block?.id ?? `${block?.name ?? 'untitled'}:${(block?.elements ?? []).length}`)
                        if (!seen.has(key)) {
                            seen.add(key)
                            merged.push(block)
                        }
                    }
                }
                if (!cancelled) setProjectWideCustomTemplates(merged)
            } catch (e) {
                console.error('[EnhancedVisualEditor] Failed to fetch project-wide templates:', e)
                if (!cancelled) setTemplatesError('Failed to load project templates')
            } finally {
                if (!cancelled) setTemplatesLoading(false)
            }
        }
        if (project?.id) void fetchTemplates()
        return () => { cancelled = true }
    }, [project?.id])

    return (
        <div className="enhanced-visual-editor-wrapper">
            <EnhancedMjmlEditor
                template={enhancedTemplate}
                onTemplateChange={handleTemplateChange}
                onTemplateSave={handleTemplateSave}
                _resources={resources}
                isPreviewMode={false}
                isSaving={isSaving}
                projectWideCustomTemplates={projectWideCustomTemplates}
                customTemplatesLoading={templatesLoading}
                customTemplatesError={templatesError}
            />
        </div>
    )
}

export default EnhancedVisualEditor
