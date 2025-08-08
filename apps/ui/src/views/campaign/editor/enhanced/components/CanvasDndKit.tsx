import React, { MouseEvent } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { EditorElement } from '../types'
import { DroppableElementDndKit } from './index'
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

const CanvasDndKit: React.FC<CanvasProps> = ({
    elements,
    selectedElementId,
    onElementAdd,
    onElementSelect,
    onElementUpdate,
    onElementDelete,
    onElementMove,
    isPreviewMode = false,
}) => {
    // Comprehensive safety checks
    const safeElements = !elements || !Array.isArray(elements) ? [] : elements

    // Safety checks for callback functions
    const safeOnElementAdd = onElementAdd || (() => {})
    const safeOnElementSelect = onElementSelect || (() => {})
    const safeOnElementUpdate = onElementUpdate || (() => {})
    const safeOnElementDelete = onElementDelete || (() => {})
    const safeOnElementMove = onElementMove || (() => {})

    // Find MJML structure for rendering
    const mjmlRoot = safeElements.find((el: EditorElement) => el.tagName === 'mjml')
    const mjmlBody = mjmlRoot?.children?.find((el: EditorElement) => el.tagName === 'mj-body')

    // Use dnd-kit's useDroppable hook for the canvas
    const { setNodeRef, isOver, active } = useDroppable({
        id: 'canvas-drop-area',
        data: {
            type: 'canvas',
            accepts: ['component', 'element'],
            elementId: mjmlBody?.id,
        },
    })

    // Use separate refs and combine them in the JSX
    const setRefs = (node: HTMLDivElement | null) => {
        if (node) {
            setNodeRef(node)
        }
    }

    // Handle canvas click (deselect when clicking empty space)
    const handleCanvasClick = (e: MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) {
            safeOnElementSelect(null)
        }
    }

    return (
        <div className="canvas-container">
            <div
                ref={setRefs}
                className={`canvas ${isOver && !active ? 'drag-over' : ''} ${isPreviewMode ? 'preview-mode' : ''}`}
                onClick={handleCanvasClick}
            >
                {mjmlBody
                    ? (
                        <div className="mjml-body-wrapper">
                            {mjmlBody?.children.map((element: EditorElement) => (
                                <DroppableElementDndKit
                                    key={element.id}
                                    element={element}
                                    isSelected={element.id === selectedElementId ? element.id : null}
                                    onElementSelect={safeOnElementSelect}
                                    onElementUpdate={safeOnElementUpdate}
                                    onElementDelete={safeOnElementDelete}
                                    onElementAdd={safeOnElementAdd}
                                    onElementMove={safeOnElementMove}
                                    isPreviewMode={isPreviewMode}
                                />
                            ))}
                        </div>
                    )
                    : (
                        <div className="canvas-empty">
                            <div className="empty-state">
                                <div className="empty-icon">📧</div>
                                <h3>Start Building Your Email</h3>
                                <p>Drag components from the Components panel to begin creating your email template.</p>
                            </div>
                        </div>
                    )
                }

                {isOver && !active && (
                    <div className="drop-indicator">
                        <div className="drop-message">Drop component here</div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default CanvasDndKit
