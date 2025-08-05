// Enhanced MJML Editor for Parcelvoy
import React, { useCallback, useEffect, useReducer, useState } from 'react'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { EditorElement, HistoryState, EnhancedTemplate, EditorAction } from './types'
import {
    parseMJMLString,
    editorElementsToMjmlString,
    mjmlToHtml,
    createDefaultMjmlStructure,
} from './utils/mjmlParser'
import ComponentsPanel from './components/ComponentsPanel'
import Canvas from './components/Canvas'
import PropertiesPanel from './components/PropertiesPanel'
import PreviewModal from './components/PreviewModal'
import './EnhancedMjmlEditor.css'

interface EnhancedMjmlEditorProps {
    template: EnhancedTemplate
    onTemplateChange: (template: EnhancedTemplate) => void
    _resources?: any[]
    isPreviewMode?: boolean
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
            }
        }

        case 'LOAD_TEMPLATE': {
            const { elements } = payload
            return {
                present: elements,
                history: [],
                future: [],
                selectedElementId: null,
            }
        }

        case 'CLEAR_CANVAS': {
            const defaultElements = createDefaultMjmlStructure()
            return {
                present: defaultElements,
                history: [...state.history.slice(-49), state.present],
                future: [],
                selectedElementId: null,
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
    const element = elements.find(el => el.id === elementId) ?? null
    if (element) {
        return elements.filter(el => el.id !== elementId).map(el => {
            if (el.children && el.children.length > 0) {
                return { ...el, children: deleteElementRecursive(el.children, elementId) }
            }
            return el
        })
    }
    return elements
}

const EnhancedMjmlEditor: React.FC<EnhancedMjmlEditorProps> = ({
    template,
    onTemplateChange,
    _resources = [],
    isPreviewMode = false,
}) => {
    const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false)
    const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false)
    const [showPreview, setShowPreview] = useState(false)

    // Initialize editor state
    const initialElements = template.data.elements
        ?? (template.data.mjml ? parseMJMLString(template.data.mjml) : createDefaultMjmlStructure())

    const initialState: HistoryState = {
        present: initialElements,
        history: [],
        future: [],
        selectedElementId: null,
    }

    const [editorState, dispatch] = useReducer(editorReducer, initialState)

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
    }, [editorState.present, template, onTemplateChange])

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
        dispatch({ type: 'SELECT_ELEMENT', payload: { elementId } })
    }, [])

    const handleElementMove = useCallback((elementId: string, _newParentId: string, _newIndex: number): void => {
        // First remove the element
        dispatch({ type: 'DELETE_ELEMENT', payload: { elementId } })
        // Then add it to the new location
        // Implementation needed
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
            } else if (e.key === 'Delete' && selectedElement) {
                e.preventDefault()
                handleElementDelete(selectedElement.id)
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [isPreviewMode, handleUndo, handleRedo, selectedElement, handleElementDelete])

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
                            <button
                                className="toolbar-button"
                                onClick={() => setShowPreview(true)}
                                title="Preview Email"
                            >
                                👁️
                            </button>
                            <div className="toolbar-divider" />
                            <button
                                className={`toolbar-button ${leftPanelCollapsed ? 'active' : ''}`}
                                onClick={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
                                title="Toggle Components Panel"
                            >
                                📦
                            </button>
                            <button
                                className={`toolbar-button ${rightPanelCollapsed ? 'active' : ''}`}
                                onClick={() => setRightPanelCollapsed(!rightPanelCollapsed)}
                                title="Toggle Properties Panel"
                            >
                                ⚙️
                            </button>
                        </div>
                    </div>
                )}

                <div className="editor-content">
                    {!isPreviewMode && (
                        <ComponentsPanel
                            onComponentDrag={() => { /* Handle component drag */ }}
                            isCollapsed={leftPanelCollapsed}
                            onToggleCollapse={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
                        />
                    )}

                    <Canvas
                        elements={editorState.present}
                        selectedElementId={editorState.selectedElementId}
                        onElementAdd={handleElementAdd}
                        onElementSelect={handleElementSelect}
                        onElementUpdate={handleElementUpdate}
                        onElementDelete={handleElementDelete}
                        onElementMove={handleElementMove}
                        isPreviewMode={isPreviewMode}
                    />

                    {!isPreviewMode && (
                        <PropertiesPanel
                            selectedElement={selectedElement}
                            onElementUpdate={handleElementUpdate}
                            isCollapsed={rightPanelCollapsed}
                            onToggleCollapse={() => setRightPanelCollapsed(!rightPanelCollapsed)}
                        />
                    )}
                </div>

                <PreviewModal
                    isOpen={showPreview}
                    onClose={() => setShowPreview(false)}
                    elements={editorState.present}
                    templateName={template.data.metadata?.name ?? 'Email Template'}
                />
            </div>
        </DndProvider>
    )
}

export default EnhancedMjmlEditor
