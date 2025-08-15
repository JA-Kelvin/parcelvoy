// Droppable Element Component for Enhanced MJML Editor
import React, { useState, useRef } from 'react'
import { useDrag, useDrop } from 'react-dnd'
import { EditorElement } from '../types'
import './DroppableElement.css'
import RichTextEditor from './RichTextEditor'

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
    onCopyElement?: (elementId: string) => void
    onDuplicateElement?: (elementId: string) => void
    parentId?: string
    index?: number
    siblingsCount?: number
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
    onCopyElement,
    onDuplicateElement,
    parentId,
    index,
    siblingsCount,
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
    const safeOnCopyElement = onCopyElement ?? (() => {})
    const safeOnDuplicateElement = onDuplicateElement ?? (() => {})

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
        canDrag: !isPreviewMode && !(isEditing && element.tagName === 'mj-text'),
    })

    // Drop functionality for accepting other elements
    const [{ isOver, canDrop }, drop] = useDrop({
        accept: ['element', 'component'],
        drop: (item: any, monitor) => {
            if (monitor.didDrop()) return
            // Disable dropping into this element while editing mj-text
            if (isEditing && element.tagName === 'mj-text') return

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
            // Disable dropping while this element is editing mj-text
            if (isEditing && element.tagName === 'mj-text') return false
            // Define drop rules based on MJML structure
            const allowedChildren = getElementAllowedChildren(element.tagName)
            return allowedChildren.includes(item.type || item.tagName)
        },
    })

    // Combine drag and drop refs
    const combinedRef = (node: HTMLDivElement | null) => {
        if (node) {
            (elementRef as React.MutableRefObject<HTMLDivElement | null>).current = node
            // Do not attach drag/drop handlers while editing mj-text
            if (!isPreviewMode && !(isEditing && element.tagName === 'mj-text')) {
                drag(node)
                drop(node)
            }
        }
    }

    const getElementAllowedChildren = (tagName: string): string[] => {
        const rules: Record<string, string[]> = {
            'mj-body': ['mj-section', 'enhanced-section', 'mj-wrapper', 'mj-hero'],
            'mj-section': ['mj-column', 'mj-group'],
            'enhanced-section': ['mj-column', 'mj-group'],
            'mj-column': [
                'mj-text', 'mj-image', 'mj-button', 'mj-divider', 'mj-spacer', 'mj-social', 'mj-raw', 'mj-navbar',
                'mj-table', 'mj-accordion', 'mj-carousel',
            ],
            'mj-group': ['mj-column'],
            'mj-wrapper': ['mj-section', 'enhanced-section'],
            'mj-hero': ['mj-text', 'mj-button', 'mj-image', 'mj-spacer'],
            'mj-navbar': ['mj-navbar-link'],
            'mj-social': ['mj-social-element'],
            'mj-accordion': ['mj-accordion-element'],
            'mj-accordion-element': ['mj-accordion-title', 'mj-accordion-text'],
            'mj-carousel': ['mj-carousel-image'],
        }
        return rules[tagName] || []
    }

    // Tags that support inline content editing
    const inlineEditableTags = new Set([
        'mj-text',
        'mj-button',
        'mj-raw',
        'mj-table',
        'mj-navbar-link',
        'mj-accordion-title',
        'mj-accordion-text',
    ])

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (!isPreviewMode) {
            safeOnSelect(element.id)
        }
    }

    const handleDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (isPreviewMode) return
        // Focus properties panel on double-click
        safeOnSelect(element.id)
        safeOnEditButtonClick(element.id)
        // Enable inline editing for supported tags
        if (inlineEditableTags.has(element.tagName)) {
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
            case 'enhanced-section': {
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
            case 'mj-hero': {
                if (attributes['background-url']) {
                    baseStyle.backgroundImage = `url(${attributes['background-url']})`
                }
                // Allow overriding background-* via attributes, fallback to sensible defaults
                baseStyle.backgroundRepeat = attributes['background-repeat'] || (attributes['background-url'] ? 'no-repeat' : undefined)
                baseStyle.backgroundSize = attributes['background-size'] || (attributes['background-url'] ? 'cover' : undefined)
                baseStyle.backgroundPosition = attributes['background-position'] || (attributes['background-url'] ? 'center' : undefined)
                if (attributes['background-color']) baseStyle.backgroundColor = attributes['background-color']
                baseStyle.height = attributes.height || '300px'
                baseStyle.display = 'flex'
                baseStyle.alignItems = 'center'
                baseStyle.justifyContent = 'center'
                baseStyle.textAlign = attributes['text-align'] || 'center'
                break
            }
            case 'mj-social': {
                baseStyle.display = 'flex'
                baseStyle.flexWrap = 'wrap'
                baseStyle.gap = attributes['icon-padding'] || '8px'
                const align = attributes.align || 'left'
                baseStyle.justifyContent = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start'
                break
            }
            case 'mj-navbar': {
                baseStyle.display = 'flex'
                baseStyle.flexWrap = 'wrap'
                baseStyle.gap = '8px'
                const align = attributes.align || 'left'
                baseStyle.justifyContent = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start'
                break
            }
            case 'mj-wrapper': {
                baseStyle.width = '100%'
                if (attributes['background-url']) {
                    baseStyle.backgroundImage = `url(${attributes['background-url']})`
                    baseStyle.backgroundRepeat = attributes['background-repeat'] || 'no-repeat'
                    baseStyle.backgroundSize = attributes['background-size'] || 'cover'
                    baseStyle.backgroundPosition = attributes['background-position'] || 'center'
                }
                break
            }
            case 'mj-carousel': {
                baseStyle.display = 'flex'
                baseStyle.flexWrap = 'nowrap'
                baseStyle.gap = '8px'
                baseStyle.overflowX = 'auto'
                break
            }
            case 'mj-accordion': {
                baseStyle.border = attributes.border || undefined
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
                        <RichTextEditor
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

            case 'enhanced-section':
                return (
                    <div className="mj-section-content">
                        {children}
                    </div>
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

            case 'mj-wrapper':
                return (
                    <div className="mj-wrapper-content">
                        {children}
                    </div>
                )

            case 'mj-hero':
                return (
                    <div className="mj-hero-content">
                        {children}
                    </div>
                )

            case 'mj-navbar':
                return (
                    <div className="mj-navbar-content">
                        {children}
                    </div>
                )

            case 'mj-navbar-link': {
                const href = attributes.href || '#'
                const target = attributes.target || '_blank'
                const linkColor = attributes.color || '#111827'
                const linkPadding = attributes.padding || '10px 15px'
                const fontSize = attributes['font-size']
                const fontFamily = attributes['font-family']
                return isEditing
                    ? (
                        <ContentEditor
                            content={content ?? ''}
                            onSave={handleContentEdit}
                            onCancel={() => setIsEditing(false)}
                        />
                    )
                    : (
                        <a
                            href={href}
                            target={target}
                            rel={target === '_blank' ? 'noopener noreferrer' : undefined}
                            onClick={(e) => e.preventDefault()}
                            style={{
                                color: linkColor,
                                padding: linkPadding,
                                textDecoration: 'none',
                                fontSize: fontSize,
                                fontFamily: fontFamily,
                            }}
                            dangerouslySetInnerHTML={{ __html: content ?? 'Link' }}
                        />
                    )
            }

            case 'mj-social':
                return (
                    <div className="mj-social-content">
                        {children}
                    </div>
                )

            case 'mj-social-element': {
                const name = attributes.name || 'web'
                const href = attributes.href || '#'
                const target = attributes.target || '_blank'
                const src = attributes.src as string | undefined
                const iconSize = (attributes['icon-size'] as string | undefined) ?? '24px'
                const bg = attributes['background-color'] as string | undefined
                const fg = attributes.color as string | undefined

                return (
                    <a
                        className="mj-social-element"
                        href={href}
                        target={target}
                        rel={target === '_blank' ? 'noopener noreferrer' : undefined}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: iconSize,
                            height: iconSize,
                            borderRadius: '4px',
                            backgroundColor: bg ?? 'transparent',
                            color: fg ?? '#111827',
                            textDecoration: 'none',
                            overflow: 'hidden',
                        }}
                        onClick={(e) => e.preventDefault()}
                    >
                        {
                            src
                                ? (
                                    <img
                                        src={src}
                                        alt={name}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                    />
                                )
                                : (
                                    <span style={{ fontSize: '12px', textTransform: 'capitalize' }}>{name}</span>
                                )
                        }
                    </a>
                )
            }

            case 'mj-table': {
                const align = attributes.align || 'left'
                const width = attributes.width || '100%'
                const cellpadding = attributes.cellpadding || '0'
                const cellspacing = attributes.cellspacing || '0'
                const tableHtml = content ?? '<tr><td>Cell 1</td><td>Cell 2</td></tr>'
                return isEditing
                    ? (
                        <ContentEditor
                            content={content ?? ''}
                            onSave={handleContentEdit}
                            onCancel={() => setIsEditing(false)}
                        />
                    )
                    : (
                        <div className="mj-table-content" style={{ overflowX: 'auto' }}>
                            <table style={{ width }} cellPadding={parseInt(cellpadding) || 0} cellSpacing={parseInt(cellspacing) || 0} align={align}>
                                <tbody dangerouslySetInnerHTML={{ __html: tableHtml }} />
                            </table>
                        </div>
                    )
            }

            case 'mj-accordion':
                return (
                    <div className="mj-accordion-content">
                        {children}
                    </div>
                )

            case 'mj-accordion-element':
                return (
                    <div className="mj-accordion-element">
                        {children}
                    </div>
                )

            case 'mj-accordion-title':
                return isEditing
                    ? (
                        <ContentEditor
                            content={content ?? ''}
                            onSave={handleContentEdit}
                            onCancel={() => setIsEditing(false)}
                        />
                    )
                    : (
                        <div className="mj-accordion-title" dangerouslySetInnerHTML={{ __html: content ?? 'Accordion Title' }} />
                    )

            case 'mj-accordion-text':
                return isEditing
                    ? (
                        <ContentEditor
                            content={content ?? ''}
                            onSave={handleContentEdit}
                            onCancel={() => setIsEditing(false)}
                        />
                    )
                    : (
                        <div className="mj-accordion-text" dangerouslySetInnerHTML={{ __html: content ?? 'Accordion content goes here.' }} />
                    )

            case 'mj-carousel':
                return (
                    <div className="mj-carousel-content">
                        {children}
                    </div>
                )

            case 'mj-carousel-image':
                return (
                    <img
                        src={attributes.src || 'https://via.placeholder.com/300x200'}
                        alt={attributes.alt || 'Carousel image'}
                        style={{ height: 'auto', display: 'block' }}
                    />
                )

            case 'mj-raw':
                return isEditing
                    ? (
                        <ContentEditor
                            content={content ?? ''}
                            onSave={handleContentEdit}
                            onCancel={() => setIsEditing(false)}
                        />
                    )
                    : (
                        <div className="mj-raw-content" dangerouslySetInnerHTML={{ __html: content ?? '<!-- Raw HTML here -->' }} />
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

            {!isPreviewMode && !isEditing && (isSelected || isHovered) && inlineEditableTags.has(element.tagName) && (
                <div className="inline-edit-hint">Double-click to edit</div>
            )}

            {!isPreviewMode && (isSelected || isHovered) && (
                <div className="element-controls">
                    {(element.tagName === 'mj-section' || element.tagName === 'enhanced-section') && (
                        <>
                            <button
                                className="control-button move-up"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    if (parentId != null && typeof index === 'number' && index > 0) {
                                        safeOnMove(element.id, parentId, index - 1)
                                    }
                                }}
                                disabled={!(typeof index === 'number' && index > 0)}
                                title="Move section up"
                            >
                                ⬆️
                            </button>
                            <button
                                className="control-button move-down"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    if (
                                        parentId != null
                                        && typeof index === 'number'
                                        && typeof siblingsCount === 'number'
                                        && index < siblingsCount - 1
                                    ) {
                                        safeOnMove(element.id, parentId, index + 1)
                                    }
                                }}
                                disabled={!(
                                    typeof index === 'number'
                                    && typeof siblingsCount === 'number'
                                    && index < siblingsCount - 1
                                )}
                                title="Move section down"
                            >
                                ⬇️
                            </button>
                        </>
                    )}
                    {isSelected && (
                        <>
                            <button
                                className="control-button copy"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    safeOnCopyElement(element.id)
                                }}
                                title="Copy element (Ctrl+C)"
                            >
                                📄
                            </button>
                            {element.tagName !== 'mjml' && element.tagName !== 'mj-body' && (
                                <button
                                    className="control-button duplicate"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        safeOnDuplicateElement(element.id)
                                    }}
                                    title="Duplicate element"
                                >
                                    ➕
                                </button>
                            )}
                        </>
                    )}
                    <button
                        className="control-button delete"
                        onClick={handleDelete}
                        title="Delete element"
                    >
                        ❌
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
