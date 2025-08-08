// Integration file for testing the DndKit implementation
import React from 'react'
import EnhancedMjmlEditorDndKit from './EnhancedMjmlEditorDndKit'
import { EnhancedTemplate } from './types'

interface EnhancedMjmlEditorWithDndKitProps {
    template: EnhancedTemplate
    onTemplateChange: (template: EnhancedTemplate) => void
    onTemplateSave?: (template: EnhancedTemplate) => Promise<void>
    _resources?: any[]
    isPreviewMode?: boolean
    isSaving?: boolean
}

/**
 * This is a wrapper component that uses the new DndKit implementation
 * It has the same props interface as the original EnhancedMjmlEditor
 * so it can be used as a drop-in replacement for testing
 */
const EnhancedMjmlEditorWithDndKit: React.FC<EnhancedMjmlEditorWithDndKitProps> = (props) => {
    return <EnhancedMjmlEditorDndKit {...props} />
}

export default EnhancedMjmlEditorWithDndKit
