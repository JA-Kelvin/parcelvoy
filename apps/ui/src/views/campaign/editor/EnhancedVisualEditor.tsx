// Enhanced Visual Editor Integration for Parcelvoy
import React, { useCallback } from 'react'
import { Template } from '../../../types'
import { EnhancedTemplate } from './enhanced/types'
import EnhancedMjmlEditor from './enhanced/EnhancedMjmlEditor'

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
    // Convert Parcelvoy Template to Enhanced Template
    const convertToEnhancedTemplate = (parcelvoyTemplate: Template): EnhancedTemplate => {
        return {
            id: String(parcelvoyTemplate.id),
            type: parcelvoyTemplate.type,
            locale: parcelvoyTemplate.locale,
            data: {
                editor: 'enhanced-visual',
                mjml: parcelvoyTemplate.data.mjml || '<mjml><mj-body></mj-body></mjml>',
                html: parcelvoyTemplate.data.html || '',
                elements: parcelvoyTemplate.data.elements,
                metadata: {
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
            },
        }
    }

    const handleTemplateChange = useCallback((enhancedTemplate: EnhancedTemplate) => {
        const parcelvoyTemplate = convertToParcelvoyTemplate(enhancedTemplate)
        setTemplate(parcelvoyTemplate)
    }, [setTemplate])

    const enhancedTemplate = convertToEnhancedTemplate(template)

    return (
        <div className="enhanced-visual-editor-wrapper">
            <EnhancedMjmlEditor
                template={enhancedTemplate}
                onTemplateChange={handleTemplateChange}
                resources={resources}
                isPreviewMode={false}
            />
        </div>
    )
}

export default EnhancedVisualEditor
