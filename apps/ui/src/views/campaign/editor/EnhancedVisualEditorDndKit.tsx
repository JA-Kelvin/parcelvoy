// Enhanced Visual Editor Integration for Parcelvoy using DndKit
import React, { useCallback, useContext, useState } from 'react'
import { Template } from '../../../types'
import { EnhancedTemplate } from './enhanced/types'
import EnhancedMjmlEditorWithDndKit from './enhanced/EnhancedMjmlEditorWithDndKit'
import { ProjectContext } from '../../../contexts'
import api from '../../../api'

interface EnhancedVisualEditorDndKitProps {
    template: Template
    setTemplate: (template: Template) => void
    resources: any[]
}

/**
 * This component is a test implementation of the EnhancedVisualEditor
 * that uses the new DndKit-based drag and drop implementation
 */
const EnhancedVisualEditorDndKit: React.FC<EnhancedVisualEditorDndKitProps> = ({
    template,
    setTemplate,
    resources,
}) => {
    const [project] = useContext(ProjectContext)
    const [isSaving, setIsSaving] = useState(false)

    // Convert Parcelvoy Template to Enhanced Template
    const convertToEnhancedTemplate = (parcelvoyTemplate: Template): EnhancedTemplate => {
        return {
            id: String(parcelvoyTemplate.id),
            type: parcelvoyTemplate.type,
            locale: parcelvoyTemplate.locale,
            data: {
                editor: 'enhanced-visual-dndkit' as const,
                mjml: parcelvoyTemplate.data.mjml || '<mjml><mj-body></mj-body></mjml>',
                html: parcelvoyTemplate.data.html || '',
                elements: parcelvoyTemplate.data.elements,
                metadata: {
                    id: String(parcelvoyTemplate.id),
                    name: `Template ${parcelvoyTemplate.id} (DndKit)`,
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
                editor: 'enhanced-visual-dndkit',
                mjml: enhancedTemplate.data.mjml,
                html: enhancedTemplate.data.html,
                ...(enhancedTemplate.data.elements && { elements: enhancedTemplate.data.elements }),
            },
        }
    }

    const handleTemplateChange = useCallback((enhancedTemplate: EnhancedTemplate) => {
        const parcelvoyTemplate = convertToParcelvoyTemplate(enhancedTemplate)
        setTemplate(parcelvoyTemplate)
    }, [setTemplate, template])

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

            // Update the template state with the response from API
            setTemplate(updatedTemplate)

        } catch (error) {
            console.error('Failed to save template:', error)
            throw error // Re-throw to let the enhanced editor handle the error display
        } finally {
            setIsSaving(false)
        }
    }, [project.id, template.id, setTemplate, template])

    const enhancedTemplate = convertToEnhancedTemplate(template)

    return (
        <div className="enhanced-visual-editor-wrapper">
            <EnhancedMjmlEditorWithDndKit
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

export default EnhancedVisualEditorDndKit
