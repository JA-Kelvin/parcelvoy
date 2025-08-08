// Enhanced MJML Editor for Parcelvoy
import React, { useCallback, useEffect, useReducer, useState } from 'react'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { EditorElement, HistoryState, EnhancedTemplate, EditorAction, TemplateBlock } from './types'
import {
    parseMJMLString,
    editorElementsToMjmlString,
    mjmlToHtml,
    createDefaultMjmlStructure,
    generateId,
    serializeElementToMjml,
} from './utils/mjmlParser'
import ComponentsPanel from './components/ComponentsPanel'
import Canvas from './components/Canvas'
import PropertiesPanel from './components/PropertiesPanel'
import EnhancedPreviewModal from './components/EnhancedPreviewModal'
import ImportMjmlModal from './components/ImportMjmlModal'
import ErrorBoundary from './components/ErrorBoundary'
import LayersPanel from './components/LayersPanel'
import { CUSTOM_TEMPLATES } from './templates/customTemplates'
import './EnhancedMjmlEditor.css'
import { toast } from 'react-hot-toast/headless'

interface EnhancedMjmlEditorProps {
    template: EnhancedTemplate
    onTemplateChange: (template: EnhancedTemplate) => void
    onTemplateSave?: (template: EnhancedTemplate) => Promise<void>
    _resources?: any[]
    isPreviewMode?: boolean
    isSaving?: boolean
}

// --- Clipboard & structure helpers ---
const ALLOWED_CHILDREN: Record<string, string[]> = {
    'mj-body': ['mj-section', 'mj-wrapper'],
    'mj-section': ['mj-column', 'mj-group'],
    'mj-column': ['mj-text', 'mj-image', 'mj-button', 'mj-divider', 'mj-spacer', 'mj-social', 'mj-raw', 'mj-navbar', 'mj-hero'],
    'mj-group': ['mj-column'],
    'mj-wrapper': ['mj-section'],
    'mj-hero': ['mj-text', 'mj-button'],
    'mj-navbar': ['mj-navbar-link'],
    'mj-social': ['mj-social-element'],
}

const getAllowedChildren = (tagName: string): string[] => {
    return ALLOWED_CHILDREN[tagName] || []
}

const findParentInfo = (
    elements: EditorElement[],
    childId: string,
    parentId: string | null = null,
): { parentId: string | null, parentTag: string | null, index: number | null } => {
    for (let i = 0; i < elements.length; i++) {
        const el = elements[i]
        if (el.id === childId) {
            return { parentId, parentTag: null, index: i }
        }
        if (el.children?.length) {
            const res = findParentInfo(el.children, childId, el.id)
            if (res.parentId !== null || res.index !== null) {
                return { parentId: res.parentId ?? el.id, parentTag: el.tagName, index: res.index }
            }
        }
    }
    return { parentId: null, parentTag: null, index: null }
}

// Reducer for managing editor state with history
const editorReducer = (state: HistoryState, action: EditorAction): HistoryState => {
    const { type, payload } = action

    switch (type) {
        case 'ADD_ELEMENT': {
            const { element, parentId, index } = payload
            const newElements = addElementRecursive(state.present, element, parentId, index)
            return {
                present: newElements,
                history: [...state.history.slice(-49), state.present],
                future: [],
                selectedElementId: element.id,
                templateId: state.templateId,
            }
        }

        case 'UPDATE_ELEMENT': {
            const { elementId, attributes, content } = payload
            const newElements = updateElementRecursive(state.present, elementId, attributes, content)
            return {
                present: newElements,
                history: [...state.history.slice(-49), state.present],
                future: [],
                selectedElementId: state.selectedElementId,
                templateId: state.templateId,
            }
        }

        case 'MOVE_ELEMENT': {
            const { elementId, newParentId, newIndex } = payload
            const { next, moved } = moveElementRecursive(state.present, elementId, newParentId, newIndex)
            if (!moved) return state
            return {
                present: next,
                history: [...state.history.slice(-49), state.present],
                future: [],
                selectedElementId: elementId,
                templateId: state.templateId,
            }
        }

        case 'DELETE_ELEMENT': {
            const { elementId } = payload
            const newElements = deleteElementRecursive(state.present, elementId)
            return {
                present: newElements,
                history: [...state.history.slice(-49), state.present],
                future: [],
                selectedElementId: state.selectedElementId === elementId ? null : state.selectedElementId,
                templateId: state.templateId,
            }
        }

        case 'SELECT_ELEMENT': {
            return {
                ...state,
                selectedElementId: payload.elementId,
            }
        }

        case 'UNDO': {
            if (state.history.length === 0) return state
            const previous = state.history[state.history.length - 1]
            return {
                present: previous,
                history: state.history.slice(0, -1),
                future: [state.present, ...state.future.slice(0, 49)],
                selectedElementId: null,
                templateId: state.templateId,
            }
        }

        case 'REDO': {
            if (state.future.length === 0) return state
            const next = state.future[0]
            return {
                present: next,
                history: [...state.history.slice(-49), state.present],
                future: state.future.slice(1),
                selectedElementId: null,
                templateId: state.templateId,
            }
        }

        case 'LOAD_TEMPLATE': {
            const { elements, templateId } = payload
            return {
                present: elements,
                history: [],
                future: [],
                selectedElementId: null,
                templateId,
            }
        }

        case 'CLEAR_CANVAS': {
            const defaultElements = createDefaultMjmlStructure()
            return {
                present: defaultElements,
                history: [...state.history.slice(-49), state.present],
                future: [],
                selectedElementId: null,
                templateId: state.templateId,
            }
        }

        case 'REPLACE_PRESENT': {
            const { elements, selectId } = payload || {}
            return {
                present: elements,
                history: [...state.history.slice(-49), state.present],
                future: [],
                selectedElementId: selectId ?? state.selectedElementId ?? null,
                templateId: state.templateId,
            }
        }

        default:
            return state
    }
}

// Helper functions for element manipulation
const addElementRecursive = (elements: EditorElement[], newElement: EditorElement, parentId?: string, index?: number): EditorElement[] => {
    if (!parentId) {
        const newElements = [...elements]
        if (index === undefined || index < 0 || index > newElements.length) {
            newElements.push(newElement)
        } else {
            newElements.splice(index, 0, newElement)
        }
        return newElements
    }

    return elements.map(el => {
        if (el.id === parentId) {
            const newChildren = [...el.children]
            if (index === undefined || index < 0 || index > newChildren.length) {
                newChildren.push(newElement)
            } else {
                newChildren.splice(index, 0, newElement)
            }
            return { ...el, children: newChildren }
        }
        if (el.children && el.children.length > 0) {
            return { ...el, children: addElementRecursive(el.children, newElement, parentId, index) }
        }
        return el
    })
}

const updateElementRecursive = (elements: EditorElement[], elementId: string, updatedAttributes?: Record<string, any>, updatedContent?: string): EditorElement[] => {
    return elements.map(el => {
        if (el.id === elementId) {
            const newEl = { ...el }
            if (updatedAttributes !== undefined) {
                newEl.attributes = { ...updatedAttributes }
            }
            if (updatedContent !== undefined) {
                newEl.content = updatedContent
            }
            return newEl
        }
        if (el.children && el.children.length > 0) {
            return { ...el, children: updateElementRecursive(el.children, elementId, updatedAttributes, updatedContent) }
        }
        return el
    })
}

const deleteElementRecursive = (elements: EditorElement[], elementId: string): EditorElement[] => {
    return elements.map(element => {
        if (element.id === elementId) {
            return null // This will be filtered out
        }
        if (element.children) {
            return {
                ...element,
                children: deleteElementRecursive(element.children, elementId).filter(Boolean),
            }
        }
        return element
    }).filter(Boolean) as EditorElement[]
}

// --- Move helpers ---
const getElementByIdRecursive = (elements: EditorElement[], id: string): EditorElement | null => {
    for (const el of elements) {
        if (el.id === id) return el
        if (el?.children.length) {
            const found = getElementByIdRecursive(el.children, id)
            if (found) return found
        }
    }
    return null
}

const findAndRemoveElement = (
    elements: EditorElement[],
    elementId: string,
    parentId: string | null = null,
): {
    tree: EditorElement[]
    removed?: EditorElement
    originalParentId?: string | null
    originalIndex?: number
} => {
    const newTree: EditorElement[] = []
    let removed: EditorElement | undefined
    let originalParentId: string | null | undefined
    let originalIndex: number | undefined

    for (let i = 0; i < elements.length; i++) {
        const el = elements[i]
        if (el.id === elementId) {
            removed = el
            originalParentId = parentId
            originalIndex = i
            continue // skip adding this element
        }
        if (el.children && el.children.length > 0) {
            const childResult = findAndRemoveElement(el.children, elementId, el.id)
            if (childResult.removed) {
                removed = childResult.removed
                originalParentId = childResult.originalParentId
                originalIndex = childResult.originalIndex
                newTree.push({ ...el, children: childResult.tree })
                continue
            }
        }
        newTree.push(el)
    }

    return { tree: newTree, removed, originalParentId, originalIndex }
}

const insertElementAtParent = (
    elements: EditorElement[],
    parentId: string | null | undefined,
    index: number,
    element: EditorElement,
): EditorElement[] => {
    if (parentId == null) {
        const root = [...elements]
        const insertAt = Math.max(0, Math.min(index ?? root.length, root.length))
        root.splice(insertAt, 0, element)
        return root
    }

    return elements.map(el => {
        if (el.id === parentId) {
            const children = [...(el.children || [])]
            const insertAt = Math.max(0, Math.min(index ?? children.length, children.length))
            children.splice(insertAt, 0, element)
            return { ...el, children }
        }
        if (el.children && el.children.length > 0) {
            return { ...el, children: insertElementAtParent(el.children, parentId, index, element) }
        }
        return el
    })
}

const isDescendant = (elements: EditorElement[], ancestorId: string, candidateId: string): boolean => {
    const ancestor = getElementByIdRecursive(elements, ancestorId)
    if (!ancestor) return false
    const contains = (nodes: EditorElement[]): boolean => {
        for (const n of nodes) {
            if (n.id === candidateId) return true
            if (n.children?.length && contains(n.children)) return true
        }
        return false
    }
    return contains(ancestor.children || [])
}

const moveElementRecursive = (
    elements: EditorElement[],
    elementId: string,
    newParentId: string,
    newIndex: number,
): {
    next: EditorElement[]
    moved?: EditorElement
} => {
    // Guard: cannot move into itself or its descendant
    if (elementId === newParentId) {
        console.warn('MOVE_ELEMENT aborted: target parent equals element')
        return { next: elements }
    }
    if (isDescendant(elements, elementId, newParentId)) {
        console.warn('MOVE_ELEMENT aborted: target parent is a descendant of the element')
        return { next: elements }
    }

    const removal = findAndRemoveElement(elements, elementId, null)
    if (!removal.removed) {
        console.warn('MOVE_ELEMENT: element to move not found', elementId)
        return { next: elements }
    }

    // Use newIndex as the intended position relative to the pre-removal order.
    // This avoids off-by-one issues when moving elements within the same parent.
    const targetIndex = newIndex ?? 0

    // Ensure parent exists; if not, revert to original parent
    const parentExists = !!getElementByIdRecursive(removal.tree, newParentId)
    const treeToUse = parentExists ? removal.tree : removal.tree
    const parentForInsert = parentExists ? newParentId : removal.originalParentId
    const indexForInsert = parentExists ? targetIndex : (removal.originalIndex ?? 0)

    const inserted = insertElementAtParent(treeToUse, parentForInsert ?? null, indexForInsert, removal.removed)
    return { next: inserted, moved: removal.removed }
}

// ---- Template insertion helpers ----
const cloneWithNewIds = (element: EditorElement): EditorElement => {
    const newEl: EditorElement = {
        id: generateId(),
        type: element.type,
        tagName: element.tagName,
        attributes: { ...(element.attributes || {}) },
        content: element.content,
        children: [],
    }
    if (element.children?.length) {
        newEl.children = element.children.map(cloneWithNewIds)
    }
    return newEl
}

const findFirstByTagName = (elements: EditorElement[], tag: string): EditorElement | null => {
    for (const el of elements) {
        if (el.tagName === tag) return el
        if (el.children?.length) {
            const found = findFirstByTagName(el.children, tag)
            if (found) return found
        }
    }
    return null
}

const insertManyUnderParent = (elements: EditorElement[], parentId: string, items: EditorElement[]): EditorElement[] => {
    return elements.map(el => {
        if (el.id === parentId) {
            const children = [...(el.children || []), ...items]
            return { ...el, children }
        }
        if (el.children?.length) {
            return { ...el, children: insertManyUnderParent(el.children, parentId, items) }
        }
        return el
    })
}

const EnhancedMjmlEditor: React.FC<EnhancedMjmlEditorProps> = ({
    template,
    onTemplateChange,
    onTemplateSave,
    isPreviewMode = false,
    isSaving = false,
}) => {
    const [showEnhancedPreview, setShowEnhancedPreview] = useState(false)
    const [showImportModal, setShowImportModal] = useState(false)
    const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false)
    const [activeRightTab, setActiveRightTab] = useState<'components' | 'properties' | 'layers'>('components')
    const [clipboardElement, setClipboardElement] = useState<EditorElement | null>(null)
    const [selectedTemplateBlock, setSelectedTemplateBlock] = useState<TemplateBlock | null>(null)
    const [showTemplatePreview, setShowTemplatePreview] = useState(false)

    // Function to focus on properties panel when edit button is clicked
    const handleEditButtonClick = useCallback((elementId: string) => {
        // Select the element
        dispatch({ type: 'SELECT_ELEMENT', payload: { elementId } })
        // Switch to properties tab
        setActiveRightTab('properties')
        // Ensure panel is expanded
        setRightPanelCollapsed(false)
    }, [])

    // Initialize editor state with a function to ensure proper initialization
    const getInitialState = (): HistoryState => {
        // Try to use elements from template data first
        if (template.data.elements && Array.isArray(template.data.elements) && template.data.elements.length > 0) {
            console.log('Using saved elements from template data:', template.data.elements.length)
            return {
                present: template.data.elements,
                history: [],
                future: [],
                selectedElementId: null,
                templateId: template.id,
            }
        }

        // If no elements, try to parse from MJML string
        if (template.data.mjml) {
            try {
                console.log('Parsing MJML string for initial state')
                const parsedElements = parseMJMLString(template.data.mjml)
                if (Array.isArray(parsedElements) && parsedElements.length > 0) {
                    console.log('Using parsed elements for initial state:', parsedElements.length)
                    return {
                        present: parsedElements,
                        history: [],
                        future: [],
                        selectedElementId: null,
                        templateId: template.id,
                    }
                }
            } catch (error) {
                console.error('Error parsing MJML for initial state:', error)
            }
        }

        // Fallback to default structure
        console.log('Using default MJML structure for initial state')
        return {
            present: createDefaultMjmlStructure(),
            history: [],
            future: [],
            selectedElementId: null,
            templateId: template.id,
        }
    }

    const [editorState, dispatch] = useReducer(editorReducer, getInitialState())

    // Load template data when template prop changes (for saved template restoration)
    useEffect(() => {
        // Always reload template data when template changes
        console.log('Template changed, loading data:', template.id)

        if (template.data.elements && Array.isArray(template.data.elements) && template.data.elements.length > 0) {
            // Template has saved elements, load them into editor
            console.log('Loading saved elements:', template.data.elements.length)
            console.log('Saved elements structure:', template.data.elements.map(el => ({ id: el.id, type: el.type, tagName: el.tagName, childrenCount: el.children?.length || 0 })))
            dispatch({ type: 'LOAD_TEMPLATE', payload: { elements: template.data.elements, templateId: template.id } })
        } else if (template.data.mjml && template.data.mjml.trim() !== '' && template.data.mjml !== '<mjml><mj-body></mj-body></mjml>') {
            // Template has meaningful MJML string (not just the minimal default), parse it and load
            try {
                console.log('Parsing MJML string:', template.data.mjml.substring(0, 100) + '...')
                const parsedElements = parseMJMLString(template.data.mjml)
                if (Array.isArray(parsedElements) && parsedElements.length > 0) {
                    console.log('Loaded parsed elements:', parsedElements.length)
                    dispatch({ type: 'LOAD_TEMPLATE', payload: { elements: parsedElements, templateId: template.id } })
                    return // Successfully loaded, don't create default structure
                }
            } catch (error) {
                console.error('Error parsing saved MJML:', error)
            }
        }

        // If we reach here, template has no meaningful content, create default structure
        console.log('Template has no meaningful content, creating default structure')
        const defaultElements = createDefaultMjmlStructure()
        dispatch({ type: 'LOAD_TEMPLATE', payload: { elements: defaultElements, templateId: template.id } })
    }, [template.id, template.data.elements, template.data.mjml]) // Watch for changes in template ID and content

    // Update template when editor state changes
    useEffect(() => {
        const mjmlString = editorElementsToMjmlString(editorState.present)

        // Convert MJML to HTML
        mjmlToHtml(mjmlString).then(html => {
            const updatedTemplate: EnhancedTemplate = {
                ...template,
                data: {
                    ...template.data,
                    editor: 'enhanced-visual',
                    mjml: mjmlString,
                    html,
                    elements: editorState.present,
                },
            }
            onTemplateChange(updatedTemplate)
        }).catch(error => {
            console.error('Error converting MJML to HTML:', error)
        })
    }, [editorState.present]) // Removed template and onTemplateChange to prevent infinite loops

    // Action handlers
    const handleElementAdd = useCallback((element: EditorElement, parentId?: string, index?: number) => {
        dispatch({ type: 'ADD_ELEMENT', payload: { element, parentId, index } })
    }, [])

    const handleElementUpdate = useCallback((elementId: string, attributes: Record<string, any>, content?: string) => {
        dispatch({ type: 'UPDATE_ELEMENT', payload: { elementId, attributes, content } })
    }, [])

    const handleElementDelete = useCallback((elementId: string) => {
        dispatch({ type: 'DELETE_ELEMENT', payload: { elementId } })
    }, [])

    const handleElementSelect = useCallback((elementId: string | null) => {
        // Prevent rapid selection changes that could cause hanging
        requestAnimationFrame(() => {
            dispatch({ type: 'SELECT_ELEMENT', payload: { elementId } })
        })
    }, [])

    const handleElementMove = useCallback((elementId: string, newParentId: string, newIndex: number): void => {
        dispatch({ type: 'MOVE_ELEMENT', payload: { elementId, newParentId, newIndex } })
    }, [])

    const handleUndo = useCallback(() => {
        dispatch({ type: 'UNDO' })
    }, [])

    const handleRedo = useCallback(() => {
        dispatch({ type: 'REDO' })
    }, [])

    const handleClearCanvas = useCallback(() => {
        dispatch({ type: 'CLEAR_CANVAS' })
    }, [])

    // Open preview for a predefined or saved custom template before insertion
    const handleInsertTemplate = useCallback((templateId: string) => {
        try {
            const combined: TemplateBlock[] = [
                ...(template.data.customTemplates || []),
                ...CUSTOM_TEMPLATES,
            ]
            const block = combined.find(t => t.id === templateId)
            if (!block) {
                toast.error('Template not found')
                return
            }
            setSelectedTemplateBlock(block)
            setShowTemplatePreview(true)
        } catch (e) {
            console.error('Error opening template preview:', e)
            toast.error('Failed to open template preview')
        }
    }, [template.data.customTemplates])

    // Confirm insertion: clone elements with new IDs and insert under <mj-body>
    const handleConfirmInsertTemplate = useCallback(() => {
        try {
            if (!selectedTemplateBlock) {
                toast.error('No template selected')
                return
            }

            const clones = (selectedTemplateBlock.elements || []).map(cloneWithNewIds)
            if (clones.length === 0) {
                toast('Nothing to insert from template')
                setShowTemplatePreview(false)
                setSelectedTemplateBlock(null)
                return
            }

            // Ensure we have a structure with mj-body
            const hasMjml = editorState.present.some(el => el.tagName === 'mjml')
            const base = hasMjml ? editorState.present : createDefaultMjmlStructure()
            const mjBody = findFirstByTagName(base, 'mj-body')
            if (!mjBody) {
                // As a last resort, wrap in default structure
                const fallback = createDefaultMjmlStructure()
                const fbBody = findFirstByTagName(fallback, 'mj-body')
                if (!fbBody) {
                    toast.error('Failed to prepare editor structure')
                    return
                }
                const insertedFallback = insertManyUnderParent(fallback, fbBody.id, clones)
                dispatch({ type: 'REPLACE_PRESENT', payload: { elements: insertedFallback, selectId: clones[0].id } })
            } else {
                const inserted = insertManyUnderParent(base, mjBody.id, clones)
                dispatch({ type: 'REPLACE_PRESENT', payload: { elements: inserted, selectId: clones[0].id } })
            }

            setActiveRightTab('layers')
            toast.success(`Inserted '${selectedTemplateBlock.name}'`)
        } catch (e) {
            console.error('Error inserting template:', e)
            toast.error('Failed to insert template')
        } finally {
            setShowTemplatePreview(false)
            setSelectedTemplateBlock(null)
        }
    }, [selectedTemplateBlock, editorState.present])

    // Clipboard: copy selected or given element to system clipboard and store internally
    const handleCopyElement = useCallback(async (elementId?: string) => {
        try {
            const idToUse = elementId ?? editorState.selectedElementId ?? null
            const target = idToUse ? getElementByIdRecursive(editorState.present, idToUse) : null
            if (!target) {
                toast.error('No element selected to copy')
                return
            }

            // Deep clone without changing IDs for internal clipboard storage
            const internalClone: EditorElement = JSON.parse(JSON.stringify(target))
            setClipboardElement(internalClone)

            // Serialize subtree to MJML and copy to system clipboard
            const mjmlSubtree = serializeElementToMjml(target)
            const copyFallback = () => {
                const textarea = document.createElement('textarea')
                textarea.value = mjmlSubtree
                textarea.style.position = 'fixed'
                textarea.style.opacity = '0'
                document.body.appendChild(textarea)
                textarea.select()
                try {
                    document.execCommand('copy')
                    toast.success(`Copied ${target.tagName} to clipboard`)
                } catch (err) {
                    console.error('Clipboard copy failed:', err)
                    toast.error('Copy failed')
                } finally {
                    document.body.removeChild(textarea)
                }
            }

            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(mjmlSubtree)
                toast.success(`Copied ${target.tagName} to clipboard`)
            } else {
                copyFallback()
            }
        } catch (e) {
            console.error('Error copying element:', e)
            toast.error('Copy failed')
        }
    }, [editorState.present, editorState.selectedElementId])

    // Helper to pick reasonable paste target when same-parent insertion invalid
    const resolvePasteTarget = useCallback((rootTag: string): { parentId: string | null, index: number } | null => {
        // Try mj-body first
        const mjBody = findFirstByTagName(editorState.present, 'mj-body')
        if (!mjBody) return null

        // If mj-body allows it, append at end
        if (getAllowedChildren('mj-body').includes(rootTag)) {
            return { parentId: mjBody.id, index: (mjBody.children?.length ?? 0) }
        }

        // If column element, put into last section
        if (rootTag === 'mj-column') {
            const sections = (mjBody.children || []).filter((c) => c.tagName === 'mj-section')
            const lastSection = sections[sections.length - 1]
            if (lastSection) {
                return { parentId: lastSection.id, index: (lastSection.children?.length ?? 0) }
            }
        }

        // For content elements, try last column in last section
        const sections = (mjBody.children || []).filter((c) => c.tagName === 'mj-section')
        const lastSection = sections[sections.length - 1]
        const lastColumn = lastSection?.children?.filter((c) => c.tagName === 'mj-column').slice(-1)[0]
        if (lastColumn && getAllowedChildren('mj-column').includes(rootTag)) {
            return { parentId: lastColumn.id, index: (lastColumn.children?.length ?? 0) }
        }

        return null
    }, [editorState.present])

    // Paste from internal clipboard into valid location
    const handlePasteElement = useCallback(() => {
        try {
            if (!clipboardElement) {
                toast('Clipboard is empty')
                return
            }

            // Clone with new IDs on paste
            const clone = cloneWithNewIds(clipboardElement)
            const rootTag = clone.tagName

            // Determine best insertion target
            let targetParentId: string | null = null
            let targetIndex = 0

            const selectedId = editorState.selectedElementId ?? null
            if (selectedId) {
                const { parentId, parentTag, index } = findParentInfo(editorState.present, selectedId)
                // Prefer inserting as sibling after selected if allowed by parent
                if (parentId && parentTag && index != null && getAllowedChildren(parentTag).includes(rootTag)) {
                    targetParentId = parentId
                    targetIndex = index + 1
                } else {
                    const selectedNode = getElementByIdRecursive(editorState.present, selectedId)
                    if (selectedNode && getAllowedChildren(selectedNode.tagName).includes(rootTag)) {
                    // Otherwise insert as child of selected when valid
                        targetParentId = selectedId
                        targetIndex = selectedNode.children?.length ?? 0
                    }
                }
            }

            if (!targetParentId) {
                const fallback = resolvePasteTarget(rootTag)
                if (!fallback) {
                    toast.error('No valid location to paste this element')
                    return
                }
                targetParentId = fallback.parentId
                targetIndex = fallback.index
            }

            const next = insertElementAtParent(editorState.present, targetParentId, targetIndex, clone)
            dispatch({ type: 'REPLACE_PRESENT', payload: { elements: next, selectId: clone.id } })
            toast.success(`Pasted ${rootTag}`)
        } catch (e) {
            console.error('Error pasting element:', e)
            toast.error('Paste failed')
        }
    }, [clipboardElement, editorState.present, editorState.selectedElementId, resolvePasteTarget])

    // Duplicate selected (or provided) element under same parent at next index
    const handleDuplicateElement = useCallback((elementId?: string) => {
        try {
            const idToUse = elementId ?? editorState.selectedElementId ?? null
            const target = idToUse ? getElementByIdRecursive(editorState.present, idToUse) : null
            if (!target) {
                toast.error('No element selected to duplicate')
                return
            }
            // Root elements (mjml/mj-body) should not be duplicated
            if (target.tagName === 'mjml' || target.tagName === 'mj-body') {
                toast.error('Cannot duplicate root element')
                return
            }

            const { parentId, index } = findParentInfo(editorState.present, target.id)
            if (parentId == null || index == null) {
                toast.error('Cannot determine duplicate target')
                return
            }
            const clone = cloneWithNewIds(target)
            const next = insertElementAtParent(editorState.present, parentId, index + 1, clone)
            dispatch({ type: 'REPLACE_PRESENT', payload: { elements: next, selectId: clone.id } })
            toast.success(`Duplicated ${target.tagName}`)
        } catch (e) {
            console.error('Error duplicating element:', e)
            toast.error('Duplicate failed')
        }
    }, [editorState.present, editorState.selectedElementId])

    // Find selected element
    const findElementById = (elements: EditorElement[], id: string): EditorElement | null => {
        for (const element of elements) {
            if (element.id === id) return element
            if (element.children) {
                const found = findElementById(element.children, id)
                if (found) return found
            }
        }
        return null
    }

    const selectedElement = editorState.selectedElementId
        ? findElementById(editorState.present, editorState.selectedElementId)
        : null

    // Handle template save
    const handleSave = useCallback(async () => {
        if (!onTemplateSave) {
            toast.error('Save functionality not available')
            return
        }

        try {
            // Generate MJML and HTML from current editor state
            const mjmlString = editorElementsToMjmlString(editorState.present)
            const htmlString = await mjmlToHtml(mjmlString)

            // Create updated template with current data
            const updatedTemplate: EnhancedTemplate = {
                ...template,
                data: {
                    ...template.data,
                    editor: 'enhanced-visual',
                    mjml: mjmlString,
                    html: htmlString,
                    elements: editorState.present,
                    customTemplates: template.data.customTemplates ?? [],
                    metadata: {
                        ...template.data.metadata,
                        savedAt: new Date().toISOString(),
                    },
                },
            }

            // Call the save function passed from parent
            await onTemplateSave(updatedTemplate)

            // Update the template in the editor
            onTemplateChange(updatedTemplate)

            toast.success('Template saved successfully')
        } catch (error) {
            console.error('Error saving template:', error)
            toast.error('Failed to save template')
        }
    }, [onTemplateSave, template, editorState.present, onTemplateChange])

    // Handle MJML import
    const handleImportMjml = useCallback((elements: EditorElement[]) => {
        try {
            // Load the imported elements into the editor
            dispatch({ type: 'LOAD_TEMPLATE', payload: { elements, templateId: template.id } })

            // Update the template with new elements
            const updatedTemplate: EnhancedTemplate = {
                ...template,
                data: {
                    ...template.data,
                    elements,
                    metadata: {
                        ...template.data.metadata,
                        lastModified: new Date().toISOString(),
                    },
                },
            }

            onTemplateChange(updatedTemplate)
            toast.success('MJML content imported successfully')
        } catch (error) {
            console.error('Error importing MJML:', error)
            toast.error('Failed to import MJML content')
        }
    }, [template, onTemplateChange, dispatch])

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isPreviewMode) return

            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault()
                handleUndo()
            } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                e.preventDefault()
                handleRedo()
            } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault()
                void handleSave()
            } else if (e.key === 'Delete' && editorState.selectedElementId) {
                e.preventDefault()
                handleElementDelete(editorState.selectedElementId)
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [isPreviewMode, handleUndo, handleRedo, handleSave, editorState.selectedElementId, handleElementDelete, handleCopyElement, handlePasteElement])

    return (
        <DndProvider backend={HTML5Backend}>
            <div className={`enhanced-mjml-editor ${isPreviewMode ? 'preview-mode' : ''}`}>
                {!isPreviewMode && (
                    <div className="editor-toolbar">
                        <div className="toolbar-left">
                            <button
                                className="toolbar-button"
                                onClick={handleUndo}
                                disabled={editorState.history.length === 0}
                                title="Undo (Ctrl+Z)"
                            >
                                ↶
                            </button>
                            <button
                                className="toolbar-button"
                                onClick={handleRedo}
                                disabled={editorState.future.length === 0}
                                title="Redo (Ctrl+Y)"
                            >
                                ↷
                            </button>
                            <div className="toolbar-divider" />
                            <button
                                className="toolbar-button"
                                onClick={handleClearCanvas}
                                title="Clear Canvas"
                            >
                                🗑️
                            </button>
                        </div>

                        <div className="toolbar-center">
                            <span className="template-name">{template.data.metadata?.name ?? 'Untitled Template'}</span>
                        </div>

                        <div className="toolbar-right">
                            {onTemplateSave && (
                                <>
                                    {isSaving ? '⏳' : ''}
                                    <div className="toolbar-divider" />
                                </>
                            )}
                            <button
                                className="toolbar-button"
                                onClick={handlePasteElement}
                                disabled={!clipboardElement}
                                title="Paste element (Ctrl+V)"
                            >
                                📋
                            </button>
                            <button
                                className="toolbar-button"
                                onClick={() => setShowImportModal(true)}
                                title="Import MJML Content"
                            >
                                📥
                            </button>
                            <button
                                className="toolbar-button"
                                onClick={() => setShowEnhancedPreview(true)}
                                title="Preview Email with Code View"
                            >
                                👁️
                            </button>
                            <button
                                className={`toolbar-button ${rightPanelCollapsed ? 'active' : ''}`}
                                onClick={() => setRightPanelCollapsed(!rightPanelCollapsed)}
                                title="Toggle Right Panel"
                            >
                                {rightPanelCollapsed ? '➡️' : '⬅️'}
                            </button>
                        </div>
                    </div>
                )}

                <div className="editor-content">
                    {/* Main Canvas Area */}
                    <ErrorBoundary
                        resetKeys={[editorState.present.length, editorState.selectedElementId ?? 'none']}
                        onError={(error) => console.error('Canvas error:', error)}
                    >
                        <Canvas
                            elements={editorState.present}
                            selectedElementId={editorState.selectedElementId}
                            onElementAdd={handleElementAdd}
                            onElementSelect={handleElementSelect}
                            onElementUpdate={handleElementUpdate}
                            onElementDelete={handleElementDelete}
                            onElementMove={handleElementMove}
                            onEditButtonClick={handleEditButtonClick}
                            onCopyElement={handleCopyElement}
                            onDuplicateElement={handleDuplicateElement}
                            isPreviewMode={isPreviewMode}
                        />
                    </ErrorBoundary>

                    {/* Right Side Panel with Tabs */}
                    {!isPreviewMode && (
                        <div className={`right-panel ${rightPanelCollapsed ? 'collapsed' : 'expanded'}`}>
                            <div className="right-panel-header">
                                <div className="panel-tabs">
                                    <button
                                        className={`tab-button ${activeRightTab === 'components' ? 'active' : ''}`}
                                        onClick={() => setActiveRightTab('components')}
                                        title="MJML Components"
                                    >
                                        <span className="tab-icon">📦</span>
                                        <span className="tab-label">Components</span>
                                    </button>
                                    <button
                                        className={`tab-button ${activeRightTab === 'properties' ? 'active' : ''}`}
                                        onClick={() => setActiveRightTab('properties')}
                                        title="Element Properties"
                                    >
                                        <span className="tab-icon">⚙️</span>
                                        <span className="tab-label">Properties</span>
                                    </button>
                                    <button
                                        className={`tab-button ${activeRightTab === 'layers' ? 'active' : ''}`}
                                        onClick={() => setActiveRightTab('layers')}
                                        title="Element Structure"
                                    >
                                        <span className="tab-icon">🗂️</span>
                                        <span className="tab-label">Layers</span>
                                    </button>
                                </div>
                                <button
                                    className="panel-toggle-button"
                                    onClick={() => setRightPanelCollapsed(!rightPanelCollapsed)}
                                    title={rightPanelCollapsed ? 'Expand Panel' : 'Collapse Panel'}
                                >
                                    {rightPanelCollapsed ? '◀' : '▶'}
                                </button>
                            </div>

                            <div className="right-panel-content">
                                {activeRightTab === 'components' && (
                                    <ErrorBoundary
                                        resetKeys={[rightPanelCollapsed ? 'collapsed' : 'expanded']}
                                        onError={(error) => console.error('ComponentsPanel error:', error)}
                                    >
                                        <ComponentsPanel
                                            onComponentDrag={() => { /* Handle component drag */ }}
                                            onTemplateInsert={handleInsertTemplate}
                                            isCollapsed={false}
                                            onToggleCollapse={() => {}}
                                        />
                                    </ErrorBoundary>
                                )}

                                {activeRightTab === 'properties' && (
                                    <ErrorBoundary
                                        resetKeys={[selectedElement?.id ?? 'none', rightPanelCollapsed ? 'collapsed' : 'expanded']}
                                        onError={(error) => console.error('PropertiesPanel error:', error)}
                                    >
                                        <PropertiesPanel
                                            selectedElement={selectedElement}
                                            onElementUpdate={handleElementUpdate}
                                            isCollapsed={false}
                                            onToggleCollapse={() => {}}
                                        />
                                    </ErrorBoundary>
                                )}

                                {activeRightTab === 'layers' && (
                                    <ErrorBoundary
                                        resetKeys={[editorState.present.length, editorState.selectedElementId ?? 'none', rightPanelCollapsed ? 'collapsed' : 'expanded']}
                                        onError={(error) => console.error('LayersPanel error:', error)}
                                    >
                                        <LayersPanel
                                            elements={editorState.present}
                                            selectedElementId={editorState.selectedElementId}
                                            onSelect={handleElementSelect}
                                            onDelete={handleElementDelete}
                                            onMove={handleElementMove}
                                        />
                                    </ErrorBoundary>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <EnhancedPreviewModal
                    isOpen={showEnhancedPreview}
                    onClose={() => setShowEnhancedPreview(false)}
                    elements={editorState.present}
                    templateName={template.data.metadata?.name ?? 'Email Template'}
                />

                {/* Custom Template Preview Modal */}
                <EnhancedPreviewModal
                    isOpen={showTemplatePreview}
                    onClose={() => {
                        setShowTemplatePreview(false)
                        setSelectedTemplateBlock(null)
                    }}
                    elements={selectedTemplateBlock?.elements || []}
                    templateName={selectedTemplateBlock?.name || 'Template Block'}
                    onConfirm={handleConfirmInsertTemplate}
                    confirmLabel="Insert"
                />

                <ImportMjmlModal
                    isOpen={showImportModal}
                    onClose={() => setShowImportModal(false)}
                    onImport={handleImportMjml}
                />
            </div>
        </DndProvider>
    )
}

export default EnhancedMjmlEditor
