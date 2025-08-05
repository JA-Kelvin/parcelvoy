// Enhanced MJML Editor Types for Parcelvoy Integration
export interface EditorElement {
    id: string
    type: string
    tagName: string
    attributes: Record<string, any>
    content?: string
    children: EditorElement[]
}

export interface HistoryState {
    present: EditorElement[]
    history: EditorElement[][]
    future: EditorElement[][]
    selectedElementId: string | null
}

export interface EditorComponent {
    id: string
    type: string
    tagName: string
    attributes: Record<string, any>
    content?: string
    icon?: string
    label?: string
    category?: string
}

export interface TemplateMetadata {
    id?: string
    name?: string
    subject?: string
    preheader?: string
    savedAt?: string
}

export interface EnhancedTemplate {
    id: string
    type: string
    locale: string
    data: {
        editor: 'enhanced-visual' | 'visual' | 'html'
        mjml: string
        html: string
        elements?: EditorElement[]
        metadata?: TemplateMetadata
    }
}

export interface ComponentDefinition {
    type: string
    tagName: string
    displayName: string
    category: 'layout' | 'content' | 'media' | 'social'
    icon: string
    defaultAttributes: Record<string, any>
    allowedChildren?: string[]
    isVoid?: boolean
}

export interface EditorAction {
    type: 'ADD_ELEMENT' | 'UPDATE_ELEMENT' | 'DELETE_ELEMENT' | 'SELECT_ELEMENT' | 'UNDO' | 'REDO' | 'LOAD_TEMPLATE' | 'CLEAR_CANVAS'
    payload?: any
}

export interface AssetManagerProps {
    event: 'open' | 'close'
    open: boolean
    select: (asset: any) => void
    close: () => void
}
