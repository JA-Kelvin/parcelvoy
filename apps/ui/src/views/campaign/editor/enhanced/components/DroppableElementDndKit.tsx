import React, { useState, useRef } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { EditorElement } from '../types'
import './DroppableElement.css'

interface DroppableElementProps {
    element: EditorElement
    isSelected: string | null
    onElementSelect: (elementId: string | null) => void
    onElementUpdate: (elementId: string, attributes: Record<string, any>, content?: string) => void
    onElementDelete: (elementId: string) => void
    onElementAdd: (element: EditorElement, parentId?: string, index?: number) => void
    onElementMove: (elementId: string, newParentId: string, newIndex: number) => void
    isPreviewMode?: boolean
}

// Helper function to check if a child type is allowed in a parent
const isChildAllowedInParent = (childType: string, parentType: string): boolean => {
    // Define allowed parent-child relationships based on MJML rules
    const allowedRelationships: Record<string, string[]> = {
        'mj-body': ['mj-section', 'mj-wrapper', 'mj-hero', 'mj-raw'],
        'mj-wrapper': ['mj-section', 'mj-raw'],
        'mj-section': ['mj-column', 'mj-group', 'mj-raw'],
        'mj-group': ['mj-column', 'mj-raw'],
        'mj-column': [
            'mj-text', 'mj-button', 'mj-image', 'mj-divider', 'mj-spacer',
            'mj-navbar', 'mj-social', 'mj-carousel', 'mj-accordion', 'mj-raw',
        ],
        'mj-hero': ['mj-text', 'mj-button', 'mj-image', 'mj-divider', 'mj-spacer', 'mj-social', 'mj-raw'],
    }

    return allowedRelationships[parentType]?.includes(childType) || false
}

const DroppableElementDndKit: React.FC<DroppableElementProps> = ({
    element,
    isSelected,
    onElementSelect,
    onElementUpdate,
    onElementDelete,
    onElementAdd,
    onElementMove,
    isPreviewMode = false,
}) => {
    const [isEditing, setIsEditing] = useState(false)
    const [editContent, setEditContent] = useState(element.content ?? '')
    const editRef = useRef<HTMLDivElement>(null)
    const [isHovered, setIsHovered] = useState(false)

    // Use dnd-kit's useDraggable hook for dragging this element
    const {
        attributes,
        listeners,
        setNodeRef: setDragNodeRef,
        transform,
        isDragging,
    } = useDraggable({
        id: element.id,
        data: {
            type: 'element',
            element,
        },
        disabled: isPreviewMode ?? isEditing,
    })

    // Use dnd-kit's useDroppable hook for dropping onto this element
    const {
        setNodeRef: setDropNodeRef,
        isOver,
        active,
    } = useDroppable({
        id: element.id,
        data: {
            type: 'droppable',
            element: element,
            accepts: ['component', 'element'],
        },
    })

    // Combine the drag and drop refs
    const setNodeRef = (node: HTMLElement | null) => {
        setDragNodeRef(node)
        setDropNodeRef(node)
    }

    // Determine if the active item can be dropped on this element
    const canDrop = active ? isValidDrop(active.data.current) : false

    function isValidDrop(dragData: any): boolean {
        if (!dragData) return false

        // Check if it's a component being dragged
        if (dragData.component) {
            return isChildAllowedInParent(dragData.component.type, element.type)
        }

        // Check if it's an element being dragged
        if (dragData.element) {
            // Prevent dropping an element onto itself or its descendants
            if (dragData.element.id === element.id) return false

            // Check if element is a descendant of the dragged element
            const isDescendant = (parent: EditorElement, childId: string): boolean => {
                if (parent.id === childId) return true
                return (parent.children || []).some(child => isDescendant(child, childId))
            }

            if (isDescendant(dragData.element, element.id)) return false

            // Check MJML structure rules
            return isChildAllowedInParent(dragData.element.type, element.type)
        }

        return false
    }

    // Handle double-click to edit content (for text and button elements)
    const handleDoubleClick = (e: React.MouseEvent) => {
        if (isPreviewMode) return
        if (element.type === 'mj-text' || element.type === 'mj-button') {
            e.stopPropagation()
            setIsEditing(true)
            setEditContent(element.content ?? '')
        }
    }

    // Handle content edit save
    const handleEditSave = () => {
        onElementUpdate(element.id, {}, editContent)
        setIsEditing(false)
    }

    // Handle click to select element
    const handleClick = (e: React.MouseEvent) => {
        if (isPreviewMode) return
        e.stopPropagation()
        onElementSelect(element.id)
    }

    // Handle delete button click
    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (window.confirm(`Are you sure you want to delete this ${element.type} element?`)) {
            onElementDelete(element.id)
        }
    }

    // Determine element style based on state
    const style: React.CSSProperties = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
    }

    // Determine element class based on state
    const elementClass = `
        droppable-element 
        element-${element.type} 
        ${isSelected ? 'selected' : ''} 
        ${isOver && canDrop ? 'drop-active' : ''} 
        ${isOver && !canDrop ? 'drop-invalid' : ''} 
        ${isDragging ? 'dragging' : ''} 
        ${isHovered ? 'hovered' : ''}
        ${isPreviewMode ? 'preview-mode' : ''}
    `

    // Render element content based on type
    const renderElementContent = () => {
        if (isEditing && (element.type === 'mj-text' || element.type === 'mj-button')) {
            return (
                <div className="element-edit-container">
                    <div
                        ref={editRef}
                        className="element-edit-content"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={handleEditSave}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                e.preventDefault()
                                handleEditSave()
                            } else if (e.key === 'Escape') {
                                e.preventDefault()
                                setIsEditing(false)
                            }
                        }}
                        dangerouslySetInnerHTML={{ __html: editContent || '' }}
                    />
                    <div className="element-edit-instructions">
                        Press Ctrl+Enter to save, Esc to cancel
                    </div>
                </div>
            )
        }

        // Render children elements recursively
        if (element.children && element.children.length > 0) {
            return (
                <div className="element-children">
                    {element.children.map((child) => (
                        <DroppableElementDndKit
                            key={child.id}
                            element={child}
                            isSelected={isSelected === child.id ? child.id : null}
                            onElementSelect={onElementSelect}
                            onElementUpdate={onElementUpdate}
                            onElementDelete={onElementDelete}
                            onElementAdd={onElementAdd}
                            onElementMove={onElementMove}
                            isPreviewMode={isPreviewMode}
                        />
                    ))}
                </div>
            )
        }

        // Render content based on element type
        switch (element.type) {
            case 'mj-text':
                return <div className="element-content" dangerouslySetInnerHTML={{ __html: element.content ?? '' }} />
            case 'mj-button':
                return <div className="element-content button-content">{element.content ?? 'Button'}</div>
            case 'mj-image':
                return (
                    <div className="element-content image-content">
                        <img
                            src={element.attributes?.src ?? 'https://via.placeholder.com/600x300'}
                            alt={element.attributes?.alt ?? 'Image'}
                            style={{ maxWidth: '100%' }}
                        />
                    </div>
                )
            case 'mj-divider':
                return <div className="element-content divider-content"><hr /></div>
            case 'mj-spacer':
                return <div className="element-content spacer-content" style={{ height: element.attributes?.height || '20px' }} />
            default:
                return (
                    <div className="element-content empty-content">
                        {element.type}
                    </div>
                )
        }
    }

    // Render element label for UI
    const renderElementLabel = () => {
        if (isPreviewMode) return null

        return (
            <div className="element-label">
                {element.type}
                <div className="element-actions">
                    <button
                        className="element-action delete-button"
                        onClick={handleDelete}
                        title="Delete element"
                    >
                        🗑️
                    </button>
                </div>
            </div>
        )
    }

    // Render empty placeholder for elements that can contain children
    const renderEmptyPlaceholder = () => {
        if (isPreviewMode) return null

        const canHaveChildren = ['mj-body', 'mj-wrapper', 'mj-section', 'mj-column', 'mj-group', 'mj-hero'].includes(element.type)

        if (canHaveChildren && (!element.children || element.children.length === 0)) {
            return (
                <div className="empty-placeholder">
                    <div className="empty-placeholder-text">
                        Drop components here
                    </div>
                </div>
            )
        }

        return null
    }

    return (
        <div
            ref={setNodeRef}
            className={elementClass}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={style}
            {...(!isPreviewMode && !isEditing ? { ...attributes, ...listeners } : {})}
        >
            {renderElementLabel()}
            {renderElementContent()}
            {renderEmptyPlaceholder()}
        </div>
    )
}

export default DroppableElementDndKit
