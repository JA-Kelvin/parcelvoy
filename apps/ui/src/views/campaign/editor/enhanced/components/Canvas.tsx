// Enhanced Canvas Component for Parcelvoy MJML Editor
import React, { useRef, useCallback } from 'react'
import { useDrop } from 'react-dnd'
import { EditorElement, ComponentDefinition } from '../types'
import { generateId } from '../utils/mjmlParser'
// Import from barrel file instead of direct import
import { DroppableElement } from '.'
import './Canvas.css'

interface CanvasProps {
    elements: EditorElement[]
    selectedElementId: string | null
    onElementAdd: (element: EditorElement, parentId?: string, index?: number) => void
    onElementSelect: (elementId: string | null) => void
    onElementUpdate: (elementId: string, attributes: Record<string, any>, content?: string) => void
    onElementDelete: (elementId: string) => void
    onElementMove: (elementId: string, newParentId: string, newIndex: number) => void
    isPreviewMode?: boolean
}

const Canvas: React.FC<CanvasProps> = ({
    elements,
    selectedElementId,
    onElementAdd,
    onElementSelect,
    onElementUpdate,
    onElementDelete,
    onElementMove,
    isPreviewMode = false,
}) => {
    const canvasRef = useRef<HTMLDivElement>(null)

    // Handle component drop from components panel
    const [{ isOver, canDrop }, drop] = useDrop({
        accept: 'component',
        drop: (item: ComponentDefinition, monitor) => {
            if (monitor.didDrop()) return // Prevent duplicate drops

            // Create new element from component definition
            const newElement: EditorElement = {
                id: generateId(),
                type: item.type,
                tagName: item.tagName,
                attributes: { ...item.defaultAttributes },
                children: [],
                content: item.type === 'mj-text'
                    ? 'Your text here'
                    : item.type === 'mj-button'
                        ? 'Click me'
                        : undefined,
            }

            // Find the appropriate parent (mj-body or mj-column)
            const mjmlRoot = elements.find(el => el.tagName === 'mjml')
            if (!mjmlRoot) return

            const mjBody = mjmlRoot.children?.find(el => el.tagName === 'mj-body')
            if (!mjBody) return

            // If it's a layout component (section), add to mj-body
            if (item.type === 'mj-section') {
                onElementAdd(newElement, mjBody.id)
                return
            }

            // If it's a column, add to the last section or create a new section
            if (item.type === 'mj-column') {
                const sections = mjBody.children?.filter((el: EditorElement) => el.tagName === 'mj-section') || []
                const lastSection = sections[sections.length - 1]
                if (lastSection) {
                    onElementAdd(newElement, lastSection.id)
                } else {
                    // Create a new section first
                    const newSection: EditorElement = {
                        id: generateId(),
                        type: 'mj-section',
                        tagName: 'mj-section',
                        attributes: { 'background-color': '#ffffff', padding: '20px 0' },
                        children: [],
                    }
                    onElementAdd(newSection, mjBody.id)
                    onElementAdd(newElement, newSection.id)
                }
                return
            }

            // For content components, add to the last column or create structure
            const sections = mjBody.children?.filter((el: EditorElement) => el.tagName === 'mj-section') || []
            const lastSection = sections[sections.length - 1]
            if (lastSection) {
                const columns = lastSection.children?.filter((el: EditorElement) => el.tagName === 'mj-column') || []
                const lastColumn = columns[columns.length - 1]
                if (lastColumn) {
                    onElementAdd(newElement, lastColumn.id)
                } else {
                    // Create a new column in the section
                    const newColumn: EditorElement = {
                        id: generateId(),
                        type: 'mj-column',
                        tagName: 'mj-column',
                        attributes: { width: '100%' },
                        children: [],
                    }
                    onElementAdd(newColumn, lastSection.id)
                    onElementAdd(newElement, newColumn.id)
                }
            } else {
                // Create complete structure: section -> column -> element
                const newSection: EditorElement = {
                    id: generateId(),
                    type: 'mj-section',
                    tagName: 'mj-section',
                    attributes: { 'background-color': '#ffffff', padding: '20px 0' },
                    children: [],
                }
                const newColumn: EditorElement = {
                    id: generateId(),
                    type: 'mj-column',
                    tagName: 'mj-column',
                    attributes: { width: '100%' },
                    children: [],
                }

                onElementAdd(newSection, mjBody.id)
                onElementAdd(newColumn, newSection.id)
                onElementAdd(newElement, newColumn.id)
            }
        },
        collect: (monitor) => ({
            isOver: monitor.isOver({ shallow: true }),
            canDrop: monitor.canDrop(),
        }),
    })

    // Combine refs for drop functionality
    const combinedRef = useCallback((node: HTMLDivElement | null) => {
        if (node) {
            (canvasRef as React.MutableRefObject<HTMLDivElement | null>).current = node
            drop(node)
        }
    }, [drop])

    const handleCanvasClick = (e: React.MouseEvent) => {
        // Only deselect if clicking directly on canvas background
        if (e.target === e.currentTarget) {
            onElementSelect(null)
        }
    }

    const renderElements = (elements: EditorElement[], _parentId?: string): React.ReactNode => {
        return elements.map((element) => (
            <DroppableElement
                key={element.id}
                element={element}
                isSelected={selectedElementId === element.id}
                isPreviewMode={isPreviewMode}
                onSelect={onElementSelect}
                onUpdate={onElementUpdate}
                onDelete={onElementDelete}
                onMove={onElementMove}
                onElementAdd={onElementAdd}
            >
                {element.children && element.children.length > 0
                    && renderElements(element.children, element.id)
                }
            </DroppableElement>
        ))
    }

    // Find the MJML body for rendering
    const mjmlRoot = elements.find(el => el.tagName === 'mjml')
    const mjmlBody = mjmlRoot?.children?.find(el => el.tagName === 'mj-body')

    return (
        <div className="canvas-container">
            <div
                ref={combinedRef}
                className={`canvas ${isOver && canDrop ? 'drag-over' : ''} ${isPreviewMode ? 'preview-mode' : ''}`}
                onClick={handleCanvasClick}
            >
                {mjmlBody
                    ? (
                        <div className="mjml-body-wrapper">
                            {renderElements(mjmlBody.children || [])}
                        </div>
                    )
                    : (
                        <div className="canvas-empty">
                            <div className="empty-state">
                                <div className="empty-icon">📧</div>
                                <h3>Start Building Your Email</h3>
                                <p>Drag components from the left panel to begin creating your email template.</p>
                            </div>
                        </div>
                    )
                }

                {isOver && canDrop && (
                    <div className="drop-indicator">
                        <div className="drop-message">Drop component here</div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default Canvas
