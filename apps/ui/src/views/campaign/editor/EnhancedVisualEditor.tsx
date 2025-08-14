// Enhanced Visual Editor Integration for Parcelvoy
import React, { useCallback, useContext, useState } from 'react'
import { Template } from '../../../types'
import { EnhancedTemplate } from './enhanced/types'
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
    const convertToParcelvoyTemplate = (enhancedTemplate: EnhancedTemplate): Template => {
        return {
            ...template, // Preserve original template metadata
            data: {
                editor: 'enhanced-visual',
                mjml: enhancedTemplate.data.mjml,
                html: enhancedTemplate.data.html,
                ...(enhancedTemplate.data.elements && { elements: enhancedTemplate.data.elements }),
                customTemplates: Array.isArray(enhancedTemplate.data.customTemplates)
                    ? enhancedTemplate.data.customTemplates
                    : [],
                ...(enhancedTemplate.data.metadata && { metadata: enhancedTemplate.data.metadata }),
            },
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

            // Some backends may not persist or echo customTemplates/metadata yet.
            // Merge them back from the local payload if missing in the server response
            const serverHasCustoms = Array.isArray(updatedTemplate?.data?.customTemplates)
            const finalTemplate = {
                ...updatedTemplate,
                data: {
                    ...updatedTemplate.data,
                    customTemplates: serverHasCustoms
                        ? updatedTemplate.data.customTemplates
                        : (Array.isArray(parcelvoyTemplate.data.customTemplates)
                            ? parcelvoyTemplate.data.customTemplates
                            : []),
                    metadata: updatedTemplate.data?.metadata ?? parcelvoyTemplate.data.metadata,
                },
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

    return (
        <div className="enhanced-visual-editor-wrapper">
            <EnhancedMjmlEditor
                template={enhancedTemplate}
                onTemplateChange={handleTemplateChange}
                onTemplateSave={handleTemplateSave}
                _resources={resources}
                isPreviewMode={false}
                isSaving={isSaving}
            />
        </div>
    )
}

export default EnhancedVisualEditor
