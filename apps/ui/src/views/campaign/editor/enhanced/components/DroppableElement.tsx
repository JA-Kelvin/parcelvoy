// Droppable Element Component for Enhanced MJML Editor
import React, { useState, useRef } from 'react'
import { useDrag, useDrop } from 'react-dnd'
import { EditorElement } from '../types'
import './DroppableElement.css'

interface DroppableElementProps {
    element: EditorElement
    isSelected: boolean
    isPreviewMode: boolean
    onSelect: (elementId: string | null) => void
    onUpdate: (elementId: string, attributes: Record<string, any>, content?: string) => void
    onDelete: (elementId: string) => void
    onMove: (elementId: string, newParentId: string, newIndex: number) => void
    onElementAdd: (element: EditorElement, parentId?: string, index?: number) => void
    onEditButtonClick?: (elementId: string) => void
    children?: React.ReactNode
}

const DroppableElement: React.FC<DroppableElementProps> = ({
    element,
    isSelected,
    isPreviewMode,
    onSelect,
    onUpdate,
    onDelete,
    onMove,
    onElementAdd,
    onEditButtonClick,
    children,
}) => {
    // Safety checks for props
    if (!element) {
        console.warn('DroppableElement: element prop is null/undefined')
        return null
    }

    // Safety checks for callback functions
    const safeOnSelect = onSelect || (() => {})
    const safeOnUpdate = onUpdate || (() => {})
    const safeOnDelete = onDelete || (() => {})
    const safeOnMove = onMove || (() => {})
    const safeOnElementAdd = onElementAdd || (() => {})
    const safeOnEditButtonClick = onEditButtonClick ?? (() => {})

    const [isHovered, setIsHovered] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const elementRef = useRef<HTMLDivElement>(null)

    // Drag functionality for moving elements
    const [{ isDragging }, drag] = useDrag({
        type: 'element',
        item: { id: element.id, type: element.type },
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
        canDrag: !isPreviewMode,
    })

    // Drop functionality for accepting other elements
    const [{ isOver, canDrop }, drop] = useDrop({
        accept: ['element', 'component'],
        drop: (item: any, monitor) => {
            if (monitor.didDrop()) return

            if (item.id && item.id !== element.id) {
                // Moving existing element
                safeOnMove(item.id, element.id, 0)
            } else if (item.type && !item.id) {
                // Adding new component
                const newElement: EditorElement = {
                    id: `element_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    type: item.type,
                    tagName: item.tagName || item.type,
                    attributes: { ...item.defaultAttributes },
                    children: [],
                    content: item.type === 'mj-text'
                        ? 'Your text here'
                        : item.type === 'mj-button'
                            ? 'Click me'
                            : undefined,
                }
                safeOnElementAdd(newElement, element.id)
            }
        },
        collect: (monitor) => ({
            isOver: monitor.isOver({ shallow: true }),
            canDrop: monitor.canDrop(),
        }),
        canDrop: (item) => {
            // Define drop rules based on MJML structure
            const allowedChildren = getElementAllowedChildren(element.tagName)
            return allowedChildren.includes(item.type || item.tagName)
        },
    })

    // Combine drag and drop refs
    const combinedRef = (node: HTMLDivElement | null) => {
        if (node) {
            (elementRef as React.MutableRefObject<HTMLDivElement | null>).current = node
            if (!isPreviewMode) {
                drag(node)
                drop(node)
            }
        }
    }

    const getElementAllowedChildren = (tagName: string): string[] => {
        const rules: Record<string, string[]> = {
            'mj-body': ['mj-section', 'mj-wrapper'],
            'mj-section': ['mj-column', 'mj-group'],
            'mj-column': ['mj-text', 'mj-image', 'mj-button', 'mj-divider', 'mj-spacer', 'mj-social', 'mj-raw', 'mj-navbar', 'mj-hero'],
            'mj-group': ['mj-column'],
            'mj-wrapper': ['mj-section'],
            'mj-hero': ['mj-text', 'mj-button'],
            'mj-navbar': ['mj-navbar-link'],
            'mj-social': ['mj-social-element'],
        }
        return rules[tagName] || []
    }

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (!isPreviewMode) {
            safeOnSelect(element.id)
        }
    }

    const handleDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (!isPreviewMode && (element.tagName === 'mj-text' || element.tagName === 'mj-button')) {
            setIsEditing(true)
        }
    }

    const handleContentEdit = (newContent: string) => {
        safeOnUpdate(element.id, element.attributes, newContent)
        setIsEditing(false)
    }

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation()
        safeOnDelete(element.id)
    }

    const getElementStyle = (): React.CSSProperties => {
        const baseStyle: React.CSSProperties = {
            opacity: isDragging ? 0.5 : 1,
            position: 'relative',
            boxSizing: 'border-box',
        }

        // Apply MJML attributes as CSS styles
        const { attributes } = element

        // Colors
        if (attributes['background-color']) baseStyle.backgroundColor = attributes['background-color']
        if (attributes.color) baseStyle.color = attributes.color

        // Typography
        if (attributes['font-family']) baseStyle.fontFamily = attributes['font-family']
        if (attributes['font-size']) baseStyle.fontSize = attributes['font-size']
        if (attributes['line-height']) baseStyle.lineHeight = attributes['line-height']
        if (attributes['font-weight']) baseStyle.fontWeight = attributes['font-weight']
        if (attributes['font-style']) baseStyle.fontStyle = attributes['font-style']

        // Alignment
        if (attributes['text-align']) baseStyle.textAlign = attributes['text-align']

        // Spacing - padding
        const hasSidePadding = ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'].some((k) => attributes[k] !== undefined)
        if (hasSidePadding) {
            if (attributes['padding-top']) baseStyle.paddingTop = attributes['padding-top']
            if (attributes['padding-right']) baseStyle.paddingRight = attributes['padding-right']
            if (attributes['padding-bottom']) baseStyle.paddingBottom = attributes['padding-bottom']
            if (attributes['padding-left']) baseStyle.paddingLeft = attributes['padding-left']
        } else if (attributes.padding !== undefined) {
            baseStyle.padding = attributes.padding
        }

        // Spacing - margin
        const hasSideMargin = ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'].some((k) => attributes[k] !== undefined)
        if (hasSideMargin) {
            if (attributes['margin-top']) baseStyle.marginTop = attributes['margin-top']
            if (attributes['margin-right']) baseStyle.marginRight = attributes['margin-right']
            if (attributes['margin-bottom']) baseStyle.marginBottom = attributes['margin-bottom']
            if (attributes['margin-left']) baseStyle.marginLeft = attributes['margin-left']
        } else if (attributes.margin !== undefined) {
            baseStyle.margin = attributes.margin
        }

        // Per-tag specifics
        switch (element.tagName) {
            case 'mj-section': {
                if (attributes['background-url']) {
                    baseStyle.backgroundImage = `url(${attributes['background-url']})`
                    baseStyle.backgroundRepeat = attributes['background-repeat'] || 'no-repeat'
                    baseStyle.backgroundSize = attributes['background-size'] || 'cover'
                    baseStyle.backgroundPosition = attributes['background-position'] || 'center'
                }
                baseStyle.width = '100%'
                break
            }
            case 'mj-column': {
                const width = attributes.width
                if (width) {
                    baseStyle.flex = `0 0 ${width}`
                    baseStyle.width = width
                    baseStyle.maxWidth = width
                } else {
                    baseStyle.flex = '1 1 0'
                }
                if (attributes['vertical-align']) {
                    const v = String(attributes['vertical-align']).toLowerCase()
                    baseStyle.alignSelf = v === 'top' ? 'flex-start' : v === 'middle' ? 'center' : v === 'bottom' ? 'flex-end' : undefined
                }
                break
            }
        }

        return baseStyle
    }

    const renderElementContent = () => {
        const { tagName, content, attributes } = element

        switch (tagName) {
            case 'mj-text':
                return isEditing
                    ? (
                        <ContentEditor
                            content={content ?? ''}
                            onSave={handleContentEdit}
                            onCancel={() => setIsEditing(false)}
                        />
                    )
                    : (
                        <div
                            className="mj-text-content"
                            dangerouslySetInnerHTML={{ __html: content ?? 'Your text here' }}
                        />
                    )

            case 'mj-button':
                return isEditing
                    ? (
                        <ContentEditor
                            content={content ?? ''}
                            onSave={handleContentEdit}
                            onCancel={() => setIsEditing(false)}
                        />
                    )
                    : (
                        <button
                            className="mj-button-content"
                            style={{
                                backgroundColor: attributes['background-color'] || '#007bff',
                                color: attributes.color || '#ffffff',
                                borderRadius: attributes['border-radius'] || '4px',
                                padding: attributes['inner-padding'] || attributes.padding || '10px 25px',
                                border: attributes.border || 'none',
                                cursor: 'pointer',
                                fontSize: attributes['font-size'] || '14px',
                                fontFamily: attributes['font-family'],
                                textDecoration: 'none',
                                display: attributes.align ? 'block' : 'inline-block',
                                marginLeft: attributes.align === 'right' ? 'auto' : undefined,
                                marginRight: attributes.align === 'left' ? undefined : attributes.align ? 'auto' : undefined,
                            }}
                        >
                            {content ?? 'Click me'}
                        </button>
                    )

            case 'mj-image':
                return (
                    <img
                        src={attributes.src || 'https://via.placeholder.com/600x200?text=Image'}
                        alt={attributes.alt || 'Image'}
                        style={{
                            width: attributes.width || '100%',
                            height: 'auto',
                            display: 'block',
                            borderRadius: attributes['border-radius'],
                            ...(attributes.align === 'center'
                                ? { marginLeft: 'auto', marginRight: 'auto' }
                                : attributes.align === 'right'
                                    ? { marginLeft: 'auto' }
                                    : {}),
                        }}
                    />
                )

            case 'mj-divider':
                return (
                    <hr
                        style={{
                            borderColor: attributes['border-color'] || '#cccccc',
                            borderWidth: attributes['border-width'] || '1px',
                            borderStyle: 'solid',
                            margin: '10px 0',
                        }}
                    />
                )

            case 'mj-spacer':
                return (
                    <div
                        style={{
                            height: attributes.height || '20px',
                            backgroundColor: 'transparent',
                        }}
                    />
                )

            case 'mj-section':
                return (
                    <div className="mj-section-content">
                        {children}
                    </div>
                )

            case 'mj-column':
                return (
                    <div className="mj-column-content">
                        {children}
                    </div>
                )

            default:
                return (
                    <div className={`${tagName}-content`}>
                        {children ?? content ?? `${tagName} element`}
                    </div>
                )
        }
    }

    const getElementClasses = () => {
        const classes = [
            'droppable-element',
            `element-${element.tagName}`,
            element.tagName,
        ]

        if (isSelected) classes.push('selected')
        if (isHovered) classes.push('hovered')
        if (isDragging) classes.push('dragging')
        if (isOver && canDrop) classes.push('drop-target')
        if (isPreviewMode) classes.push('preview-mode')

        return classes.join(' ')
    }

    return (
        <div
            ref={combinedRef}
            className={getElementClasses()}
            style={getElementStyle()}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            data-element-id={element.id}
            data-element-type={element.tagName}
        >
            {renderElementContent()}

            {!isPreviewMode && (isSelected || isHovered) && (
                <div className="element-controls">
                    <button
                        className="control-button edit"
                        onClick={(e) => {
                            e.stopPropagation()
                            // Call the edit button click handler to focus properties panel
                            safeOnEditButtonClick(element.id)

                            // For text and button elements, also enable inline editing
                            if (element.tagName === 'mj-text' || element.tagName === 'mj-button') {
                                setIsEditing(true)
                            }
                        }}
                        title="Edit properties"
                    >
                        ✏️
                    </button>
                    <button
                        className="control-button delete"
                        onClick={handleDelete}
                        title="Delete element"
                    >
                        🗑️
                    </button>
                </div>
            )}

            {isOver && canDrop && (
                <div className="drop-indicator">
                    Drop here
                </div>
            )}
        </div>
    )
}

// Content Editor Component for inline editing
interface ContentEditorProps {
    content: string
    onSave: (content: string) => void
    onCancel: () => void
}

const ContentEditor: React.FC<ContentEditorProps> = ({ content, onSave, onCancel }) => {
    const [editContent, setEditContent] = useState(content)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    React.useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.focus()
            textareaRef.current.select()
        }
    }, [])

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            onSave(editContent)
        } else if (e.key === 'Escape') {
            e.preventDefault()
            onCancel()
        }
    }

    return (
        <div className="content-editor">
            <textarea
                ref={textareaRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => onSave(editContent)}
                className="content-textarea"
                rows={3}
            />
            <div className="editor-hint">
                Press Enter to save, Escape to cancel
            </div>
        </div>
    )
}

export default DroppableElement
