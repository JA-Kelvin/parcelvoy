// Droppable Element Component for Enhanced MJML Editor
import React, { useState, useRef } from 'react'
import { useDrag, useDrop, useDragLayer } from 'react-dnd'
import { EditorElement, TemplateBlock } from '../types'
import './DroppableElement.css'
import RichTextEditor from './RichTextEditor'
import { generateId } from '../utils/mjmlParser'
import { getAllowedChildren } from '../utils/mjmlRules'
import {
    parseAllStyles,
    applyGlobalAttributes,
    findMatchingCssRules,
    cssPropertiesToReact,
    ParsedStyles,
} from '../utils/styleParser'

// Narrow unknown drag items to those carrying type/tagName without assertions
const isTypeOrTag = (value: unknown): value is { type?: string, tagName?: string } => {
    return typeof value === 'object' && value !== null && ('type' in value || 'tagName' in value)
}

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
    onTemplateDrop?: (payload: TemplateBlock | { block: TemplateBlock, insertionMode?: 'append' | 'above' | 'below', anchorId?: string }) => void
    parentId?: string
    index?: number
    siblingsCount?: number
    children?: React.ReactNode
    // Global editing lock props
    globalEditingLock?: boolean
    onInlineEditStart?: () => void
    onInlineEditEnd?: () => void
    // Centralized hover tracking from Canvas: when provided, overrides local hover state
    hoveredElementId?: string | null
    // All elements for style parsing
    allElements?: EditorElement[]
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
    onTemplateDrop,
    parentId,
    index,
    siblingsCount,
    children,
    globalEditingLock,
    onInlineEditStart,
    onInlineEditEnd,
    hoveredElementId,
    allElements,
}) => {
    // Safety checks for props
    if (!element) {
        console.warn('DroppableElement: element prop is null/undefined')
        return null
    }

    // Safety checks for callback functions
    const safeOnSelect = onSelect ?? (() => {})
    const safeOnUpdate = onUpdate ?? (() => {})
    const safeOnDelete = onDelete ?? (() => {})
    const safeOnMove = onMove ?? (() => {})
    const safeOnElementAdd = onElementAdd ?? (() => {})
    const safeOnEditButtonClick = onEditButtonClick ?? (() => {})
    const safeOnCopyElement = onCopyElement ?? (() => {})
    const safeOnDuplicateElement = onDuplicateElement ?? (() => {})
    const safeOnTemplateDrop = onTemplateDrop ?? (() => {})
    const isGlobalLock = !!globalEditingLock
    const safeOnInlineEditStart = onInlineEditStart ?? (() => {})
    const safeOnInlineEditEnd = onInlineEditEnd ?? (() => {})

    const [isHovered, setIsHovered] = useState(false)
    const [isEditing, setIsEditing] = useState(false)

    // If the parent Canvas is controlling hover, derive from it; otherwise fall back to local state
    const hoveredActive = hoveredElementId != null ? hoveredElementId === element.id : isHovered

    // Tags that support inline content editing (must be declared before usage)
    const inlineEditableTags = new Set([
        'mj-text',
        'mj-button',
        'mj-raw',
        'mj-table',
        'mj-navbar-link',
        'mj-accordion-title',
        'mj-accordion-text',
    ])

    // Safely wrap URLs for use in CSS background-image to handle spaces, quotes, etc.
    const cssUrl = (u: any): string | undefined => {
        if (u == null) return undefined
        const s = String(u)
        if (/^\s*url\(/i.test(s)) return s
        const escaped = s.replace(/["\\]/g, '\\$&')
        return `url("${escaped}")`
    }

    // Drag functionality for moving elements
    const [{ isDragging }, drag] = useDrag({
        type: 'element',
        item: { id: element.id, type: element.type },
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
        canDrag: !isPreviewMode && !isGlobalLock && !(isEditing && inlineEditableTags.has(element.tagName)),
    })

    // Show enlarged section drop zones only when a section is being dragged
    const { isDraggingSectionLike, isDraggingTemplate } = useDragLayer((monitor) => {
        const dragging = monitor.isDragging()
        const item = monitor.getItem()
        const itemType = isTypeOrTag(item) ? (item.type ?? item.tagName) : undefined
        const isSection = itemType === 'mj-section' || itemType === 'enhanced-section'
        const isTemplate = itemType === 'template'
        return { isDraggingSectionLike: !!(dragging && isSection), isDraggingTemplate: !!(dragging && isTemplate) }
    })

    // Drop functionality for accepting other elements
    const [{ isOver, canDrop }, drop] = useDrop({
        accept: ['element', 'component'],
        drop: (item: any, monitor) => {
            if (monitor.didDrop()) return
            if (isPreviewMode || isGlobalLock) return
            // Disable dropping into this element while editing mj-text
            if (isEditing && inlineEditableTags.has(element.tagName)) return

            const targetIndex = Array.isArray(element.children) ? element.children.length : 0

            if (item.id && item.id !== element.id) {
                // Moving existing element - append to end by default
                safeOnMove(item.id, element.id, targetIndex)
            } else if (item.type && !item.id) {
                // Adding new component
                const newElement: EditorElement = {
                    id: generateId(),
                    type: item.type,
                    tagName: item.tagName ?? item.type,
                    attributes: { ...item.defaultAttributes },
                    children: [],
                    content: item.type === 'mj-text'
                        ? 'Your text here'
                        : item.type === 'mj-button'
                            ? 'Click me'
                            : undefined,
                }
                safeOnElementAdd(newElement, element.id, targetIndex)
            }
        },
        collect: (monitor) => ({
            isOver: monitor.isOver({ shallow: true }),
            canDrop: monitor.canDrop(),
        }),
        canDrop: (item) => {
            if (isPreviewMode || isGlobalLock) return false
            // Disable dropping while this element is editing mj-text
            if (isEditing && inlineEditableTags.has(element.tagName)) return false
            // Define drop rules based on MJML structure
            const allowedChildren = getAllowedChildren(element.tagName)
            return allowedChildren.includes(item.type ?? item.tagName)
        },
    })

    // Reordering drop zones for sections: top/bottom insertion indicators
    const isSectionElement = element.tagName === 'mj-section' || element.tagName === 'enhanced-section'

    const [{ isOver: isOverTop, canDrop: canDropTop }, dropTop] = useDrop({
        accept: ['element', 'component', 'template'],
        drop: (item: any) => {
            if (isPreviewMode || isGlobalLock) return
            if (!isSectionElement) return
            if (typeof index !== 'number' || !parentId) return
            const itemType = item.type ?? item.tagName
            if (item.id) {
                // Move existing section before this one
                if (itemType === 'mj-section' || itemType === 'enhanced-section') {
                    safeOnMove(item.id, parentId, index)
                }
            } else if (itemType === 'template') {
                const block: TemplateBlock | null = item?.block ?? (item && Array.isArray(item.elements) ? (item as TemplateBlock) : null)
                if (block) {
                    // Select this section as anchor and insert above
                    safeOnSelect(element.id)
                    safeOnTemplateDrop({ block, insertionMode: 'above', anchorId: element.id })
                }
            } else if (item.type && !item.id) {
                if (itemType === 'mj-section' || itemType === 'enhanced-section') {
                    const newSection: EditorElement = {
                        id: generateId(),
                        type: item.type,
                        tagName: item.tagName ?? item.type,
                        attributes: { 'background-color': '#ffffff', padding: '10px 25px' },
                        children: [],
                    }
                    safeOnElementAdd(newSection, parentId, index)
                }
            }
        },
        collect: (monitor) => ({
            isOver: monitor.isOver({ shallow: true }),
            canDrop: monitor.canDrop(),
        }),
        canDrop: (item) => {
            if (isPreviewMode || isGlobalLock) return false
            if (!isSectionElement) return false
            if (typeof index !== 'number' || !parentId) return false
            const itemType = item.type ?? item.tagName
            return itemType === 'template' || itemType === 'mj-section' || itemType === 'enhanced-section'
        },
    })

    const [{ isOver: isOverBottom, canDrop: canDropBottom }, dropBottom] = useDrop({
        accept: ['element', 'component', 'template'],
        drop: (item: any) => {
            if (isPreviewMode || isGlobalLock) return
            if (!isSectionElement) return
            if (typeof index !== 'number' || !parentId) return
            const insertIndex = (typeof index === 'number') ? index + 1 : 0
            const itemType = item.type ?? item.tagName
            if (item.id) {
                if (itemType === 'mj-section' || itemType === 'enhanced-section') {
                    safeOnMove(item.id, parentId, insertIndex)
                }
            } else if (itemType === 'template') {
                const block: TemplateBlock | null = item?.block ?? (item && Array.isArray(item.elements) ? (item as TemplateBlock) : null)
                if (block) {
                    // Select this section as anchor and insert below
                    safeOnSelect(element.id)
                    safeOnTemplateDrop({ block, insertionMode: 'below', anchorId: element.id })
                }
            } else if (item.type && !item.id) {
                if (itemType === 'mj-section' || itemType === 'enhanced-section') {
                    const newSection: EditorElement = {
                        id: generateId(),
                        type: item.type,
                        tagName: item.tagName ?? item.type,
                        attributes: { 'background-color': '#ffffff', padding: '10px 25px' },
                        children: [],
                    }
                    safeOnElementAdd(newSection, parentId, insertIndex)
                }
            }
        },
        collect: (monitor) => ({
            isOver: monitor.isOver({ shallow: true }),
            canDrop: monitor.canDrop(),
        }),
        canDrop: (item) => {
            if (isPreviewMode || isGlobalLock) return false
            if (!isSectionElement) return false
            if (typeof index !== 'number' || !parentId) return false
            const itemType = item.type ?? item.tagName
            return itemType === 'template' || itemType === 'mj-section' || itemType === 'enhanced-section'
        },
    })

    // Combine drag and drop refs
    const combinedRef = (node: HTMLDivElement | null) => {
        if (node) {
            // Do not attach drag/drop handlers while editing mj-text
            if (!isPreviewMode && !isGlobalLock && !(isEditing && inlineEditableTags.has(element.tagName))) {
                drag(node)
                drop(node)
            }
        }
    }

    // Allowed-children rules are centralized in utils/mjmlRules.ts

    // inlineEditableTags declared above

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (!isPreviewMode) {
            safeOnSelect(element.id)
        }
    }

    const handleDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (isPreviewMode || isGlobalLock) return
        // Enable inline editing for supported tags first
        const supportsInline = inlineEditableTags.has(element.tagName)
        if (supportsInline) {
            setIsEditing(true)
            safeOnInlineEditStart()
        }
        // Defer selection/panel focus to avoid interrupting editor mount/focus
        // Still run for non-inline tags to open Properties as before
        setTimeout(() => {
            safeOnSelect(element.id)
            safeOnEditButtonClick(element.id)
        }, 0)
    }

    const handleContentEdit = (newContent: string) => {
        safeOnUpdate(element.id, element.attributes, newContent)
        setIsEditing(false)
        safeOnInlineEditEnd()
    }

    const handleCancelEdit = () => {
        setIsEditing(false)
        safeOnInlineEditEnd()
    }

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation()
        safeOnDelete(element.id)
    }

    const handleQuickAdd = (componentType: string) => {
        if (isPreviewMode || isGlobalLock) return

        const newElement: EditorElement = {
            id: generateId(),
            type: componentType,
            tagName: componentType,
            attributes: {},
            children: [],
            content: componentType === 'mj-text'
                ? 'Your text here'
                : componentType === 'mj-button'
                    ? 'Click me'
                    : undefined,
        }

        // Add default attributes based on component type
        switch (componentType) {
            case 'mj-text':
                newElement.attributes = {
                    'font-size': '14px',
                    'line-height': '1.5',
                    color: '#000000',
                }
                break
            case 'mj-image':
                newElement.attributes = {
                    src: 'https://placehold.co/600x200?text=Image',
                    alt: 'Image',
                    width: '100%',
                }
                break
            case 'mj-spacer':
                newElement.attributes = {
                    height: '20px',
                }
                break
        }

        // Add the element to this column
        safeOnElementAdd(newElement, element.id, 0)

        // Select the newly added element
        setTimeout(() => {
            safeOnSelect(newElement.id)
        }, 0)
    }

    const handleColumnInsert = (position: 'left' | 'right') => {
        if (isPreviewMode || isGlobalLock || !parentId || typeof index !== 'number') return

        // Create a new empty column
        const newColumn: EditorElement = {
            id: generateId(),
            type: 'mj-column',
            tagName: 'mj-column',
            attributes: {
                padding: '10px 25px',
            },
            children: [],
        }

        // Calculate insertion index based on position
        const insertIndex = position === 'left' ? index : index + 1

        // Add the new column to the parent section
        safeOnElementAdd(newColumn, parentId, insertIndex)

        // Select the new column
        setTimeout(() => {
            safeOnSelect(newColumn.id)
        }, 0)
    }

    const handleSectionLayout = (columnCount: number) => {
        if (isPreviewMode || isGlobalLock) return

        // Create columns based on the selected layout
        const columns: EditorElement[] = []
        const columnWidth = columnCount === 1 ? '100%' : columnCount === 2 ? '50%' : '33.33%'

        for (let i = 0; i < columnCount; i++) {
            const column: EditorElement = {
                id: generateId(),
                type: 'mj-column',
                tagName: 'mj-column',
                attributes: {
                    width: columnWidth,
                },
                children: [],
            }
            columns.push(column)
        }

        // Add all columns to this section
        columns.forEach((column, index) => {
            safeOnElementAdd(column, element.id, index)
        })

        // Select the first column
        setTimeout(() => {
            if (columns.length > 0) {
                safeOnSelect(columns[0].id)
            }
        }, 0)
    }

    const getElementStyle = (): React.CSSProperties => {
        const baseStyle: React.CSSProperties = {
            opacity: isDragging ? 0.5 : 1,
            position: 'relative',
            boxSizing: 'border-box',
        }

        // Parse global styles and attributes if available
        let parsedStyles: ParsedStyles | null = null
        let enhancedAttributes = element.attributes

        if (allElements && allElements.length > 0) {
            try {
                parsedStyles = parseAllStyles(allElements)
                // Apply global attributes to element attributes
                enhancedAttributes = applyGlobalAttributes(
                    element.tagName,
                    element.attributes,
                    parsedStyles.globalAttributes,
                )
            } catch (error) {
                console.warn('Error parsing global styles:', error)
            }
        }

        // Apply MJML attributes as CSS styles (now using enhanced attributes)
        const { attributes } = { attributes: enhancedAttributes }

        // Colors
        // Important: do NOT apply mj-button colors to the container, they belong to the inner button only.
        if (element.tagName !== 'mj-button') {
            if (attributes['background-color']) baseStyle.backgroundColor = attributes['background-color']
            if (attributes.color) baseStyle.color = attributes.color
        }

        // Typography
        if (attributes['font-family']) baseStyle.fontFamily = attributes['font-family']
        if (attributes['font-size']) baseStyle.fontSize = attributes['font-size']
        if (attributes['line-height']) baseStyle.lineHeight = attributes['line-height']
        if (attributes['font-weight']) baseStyle.fontWeight = attributes['font-weight']
        if (attributes['font-style']) baseStyle.fontStyle = attributes['font-style']

        // Alignment
        if (attributes['text-align']) baseStyle.textAlign = attributes['text-align']
        // MJML often uses `align` attribute (e.g., mj-text align="center"). Mirror it to CSS text-align.
        if (!baseStyle.textAlign && attributes.align) baseStyle.textAlign = attributes.align

        // Spacing - padding (only apply to text elements, not images)
        if (element.tagName !== 'mj-image') {
            const hasSidePadding = ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'].some((k) => attributes[k] !== undefined)
            if (hasSidePadding) {
                if (attributes['padding-top']) baseStyle.paddingTop = attributes['padding-top']
                if (attributes['padding-right']) baseStyle.paddingRight = attributes['padding-right']
                if (attributes['padding-bottom']) baseStyle.paddingBottom = attributes['padding-bottom']
                if (attributes['padding-left']) baseStyle.paddingLeft = attributes['padding-left']
            } else if (attributes.padding !== undefined) {
                baseStyle.padding = attributes.padding
            }
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
                    const bg = cssUrl(attributes['background-url'])
                    if (bg) baseStyle.backgroundImage = bg
                    baseStyle.backgroundRepeat = attributes['background-repeat'] ?? 'no-repeat'
                    baseStyle.backgroundSize = attributes['background-size'] ?? 'cover'
                    baseStyle.backgroundPosition = attributes['background-position'] ?? 'center'
                }
                baseStyle.width = '100%'
                break
            }
            case 'enhanced-section': {
                if (attributes['background-url']) {
                    const bg = cssUrl(attributes['background-url'])
                    if (bg) baseStyle.backgroundImage = bg
                    baseStyle.backgroundRepeat = attributes['background-repeat'] ?? 'no-repeat'
                    baseStyle.backgroundSize = attributes['background-size'] ?? 'cover'
                    baseStyle.backgroundPosition = attributes['background-position'] ?? 'center'
                }
                baseStyle.width = '100%'
                break
            }
            case 'mj-column': {
                const width = attributes.width
                if (width && width.trim() !== '') {
                    // Explicit width set
                    baseStyle.flex = `0 0 ${width}`
                    baseStyle.width = width
                    baseStyle.maxWidth = width
                } else {
                    // No width or empty width - use equal distribution
                    // This matches MJML behavior where columns without width get equal shares
                    baseStyle.flex = '1 1 0'
                    baseStyle.minWidth = '0'
                }
                if (attributes['vertical-align']) {
                    const v = String(attributes['vertical-align']).toLowerCase()
                    baseStyle.alignSelf = v === 'top' ? 'flex-start' : v === 'middle' ? 'center' : v === 'bottom' ? 'flex-end' : undefined
                }
                break
            }
            case 'mj-hero': {
                if (attributes['background-url']) {
                    const bg = cssUrl(attributes['background-url'])
                    if (bg) baseStyle.backgroundImage = bg
                }
                // Allow overriding background-* via attributes, fallback to sensible defaults
                baseStyle.backgroundRepeat = attributes['background-repeat'] ?? (attributes['background-url'] ? 'no-repeat' : undefined)
                baseStyle.backgroundSize = attributes['background-size'] ?? (attributes['background-url'] ? 'cover' : undefined)
                baseStyle.backgroundPosition = attributes['background-position'] ?? (attributes['background-url'] ? 'center' : undefined)
                if (attributes['background-color']) baseStyle.backgroundColor = attributes['background-color']
                baseStyle.height = attributes.height ?? '300px'
                baseStyle.display = 'flex'
                baseStyle.alignItems = 'center'
                baseStyle.justifyContent = 'center'
                baseStyle.textAlign = attributes['text-align'] ?? 'center'
                break
            }
            case 'mj-social': {
                baseStyle.display = 'flex'
                baseStyle.flexWrap = 'wrap'
                baseStyle.gap = attributes['icon-padding'] ?? '8px'
                const align = attributes.align ?? 'left'
                baseStyle.justifyContent = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start'
                break
            }
            case 'mj-navbar': {
                baseStyle.display = 'flex'
                baseStyle.flexWrap = 'wrap'
                baseStyle.gap = '8px'
                const align = attributes.align ?? 'left'
                baseStyle.justifyContent = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start'
                break
            }
            case 'mj-wrapper': {
                baseStyle.width = '100%'
                if (attributes['background-url']) {
                    const bg = cssUrl(attributes['background-url'])
                    if (bg) baseStyle.backgroundImage = bg
                    baseStyle.backgroundRepeat = attributes['background-repeat'] ?? 'no-repeat'
                    baseStyle.backgroundSize = attributes['background-size'] ?? 'cover'
                    baseStyle.backgroundPosition = attributes['background-position'] ?? 'center'
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
                baseStyle.border = attributes.border ?? undefined
                break
            }
        }

        // Apply CSS rules from mj-style if available
        if (parsedStyles?.cssRules && parsedStyles.cssRules.length > 0) {
            try {
                // Extract classes from element attributes (if any)
                const elementClasses = attributes.class ? attributes.class.split(' ') : []
                const elementId = attributes.id

                // Find matching CSS rules
                const matchingRules = findMatchingCssRules(
                    element.tagName,
                    elementClasses,
                    elementId,
                    parsedStyles.cssRules,
                )

                // Apply matching CSS rules (in order of specificity)
                matchingRules.forEach(rule => {
                    const cssProps = cssPropertiesToReact(rule.properties)
                    Object.assign(baseStyle, cssProps)
                })
            } catch (error) {
                console.warn('Error applying CSS rules:', error)
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
                            onCancel={handleCancelEdit}
                        />
                    )
                    : (
                        <div
                            className="mj-text-content"
                            style={{ textAlign: attributes['text-align'] ?? attributes.align }}
                            dangerouslySetInnerHTML={{ __html: content ?? 'Your text here' }}
                        />
                    )

            case 'mj-button': {
                // MJML button alignment and width handling to match preview
                const widthAttr = attributes.width as string | undefined
                const btnWidth = widthAttr
                    ? (/[%px]$/i.test(widthAttr) ? widthAttr : `${parseInt(String(widthAttr), 10)}px`)
                    : undefined

                // MJML button alignment - use align attribute or inherit from container
                const buttonAlign = attributes.align || 'left'

                // Container styles to match MJML behavior
                const containerStyle: React.CSSProperties = {
                    textAlign: buttonAlign,
                    width: '100%',
                }

                // Button styles that match MJML rendering
                const buttonStyle: React.CSSProperties = {
                    ...(!content?.includes('img') && { backgroundColor: attributes['background-color'] ?? '#414141' }),
                    color: attributes.color ?? '#ffffff',
                    borderRadius: attributes['border-radius'] ?? '3px',
                    border: attributes.border ?? 'none',
                    cursor: 'pointer',
                    fontSize: attributes['font-size'] ?? '13px',
                    fontFamily: attributes['font-family'] ?? 'Ubuntu, Helvetica, Arial, sans-serif',
                    fontWeight: attributes['font-weight'] ?? '400',
                    textDecoration: 'none',
                    textTransform: attributes['text-transform'] ?? 'none',
                    margin: '0px',
                    // Apply padding only if not an image context
                    ...(!content?.includes('img') && { padding: attributes['inner-padding'] ?? '10px 25px' }),
                    // Apply width if specified
                    ...(btnWidth && { width: btnWidth }),
                    // Handle height if specified
                    ...(attributes.height && { height: attributes.height }),
                    // Handle vertical alignment
                    ...(attributes['vertical-align'] && { verticalAlign: attributes['vertical-align'] }),
                }

                return isEditing
                    ? (
                        <RichTextEditor
                            content={content ?? ''}
                            onSave={handleContentEdit}
                            onCancel={handleCancelEdit}
                        />
                    )
                    : (
                        <div style={containerStyle}>
                            <button
                                className="mj-button-content"
                                style={buttonStyle}
                                dangerouslySetInnerHTML={{ __html: content ?? 'Click me' }}
                            />
                        </div>
                    )
            }

            case 'mj-image':
                return (
                    <img
                        src={attributes.src ?? 'https://placehold.co/600x200?text=Image'}
                        alt={attributes.alt ?? 'Image'}
                        style={{
                            width: attributes.width
                                ? (attributes.width.toLowerCase() === 'auto'
                                    ? 'auto'
                                    : attributes.width.endsWith('%')
                                        ? attributes.width
                                        : `${parseInt(attributes.width)}px`)
                                : '100%',
                            height: 'auto',
                            display: 'block',
                            borderRadius: attributes['border-radius'],
                            // Constrain image to parent column width (matches MJML behavior)
                            maxWidth: '100%',
                            // Let the parent column's text-align handle the alignment
                            // This matches how MJML renders images in the preview
                            margin: attributes.align === 'center'
                                ? '0 auto'
                                : attributes.align === 'right'
                                    ? '0 0 0 auto'
                                    : '0',
                        }}
                    />
                )

            case 'mj-divider':
                return (
                    <hr
                        style={{
                            borderColor: attributes['border-color'] ?? 'var(--color-grey-hard)',
                            borderWidth: attributes['border-width'] ?? '1px',
                            borderStyle: 'solid',
                            margin: '10px 0',
                        }}
                    />
                )

            case 'mj-spacer':
                return (
                    <div
                        style={{
                            height: attributes.height ?? '20px',
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

            case 'mj-section': {
                // Check both the element's children data AND the React children prop
                const hasDataChildren = element.children && element.children.length > 0
                const hasReactChildren = children && React.Children.count(children) > 0

                // Debug: Check if section is empty
                const isEmpty = !hasDataChildren && !hasReactChildren

                return (
                    <div className="mj-section-content">
                        {isEmpty && !isPreviewMode && (
                            <>
                                <div className="empty-section-placeholder">
                                    Choose a layout to get started
                                </div>
                                <div className="empty-section-actions">
                                    <div className="section-actions-title">Select Layout</div>
                                    <div className="section-actions-row">
                                        <button
                                            className="section-layout-button"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                handleSectionLayout(1)
                                            }}
                                            title="Single column layout"
                                        >
                                            <div className="section-layout-preview">
                                                <div className="layout-col"></div>
                                            </div>
                                            <span>1 Column</span>
                                        </button>
                                        <button
                                            className="section-layout-button"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                handleSectionLayout(2)
                                            }}
                                            title="Two column layout"
                                        >
                                            <div className="section-layout-preview">
                                                <div className="layout-col"></div>
                                                <div className="layout-col"></div>
                                            </div>
                                            <span>2 Columns</span>
                                        </button>
                                        <button
                                            className="section-layout-button"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                handleSectionLayout(3)
                                            }}
                                            title="Three column layout"
                                        >
                                            <div className="section-layout-preview">
                                                <div className="layout-col"></div>
                                                <div className="layout-col"></div>
                                                <div className="layout-col"></div>
                                            </div>
                                            <span>3 Columns</span>
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                        {children}
                    </div>
                )
            }

            case 'mj-column': {
                const isEmpty = !element.children || element.children.length === 0
                return (
                    <div className="mj-column-content" style={{ textAlign: attributes['text-align'] ?? attributes.align }}>
                        {isEmpty && !isPreviewMode && (
                            <>
                                <div className="empty-column-placeholder">
                                    Drop your content here
                                </div>
                                <div className="empty-column-actions">
                                    <button
                                        className="quick-action-button"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            handleQuickAdd('mj-text')
                                        }}
                                        title="Add text"
                                    >
                                        <span className="icon">📝</span>
                                        Text
                                    </button>
                                    <button
                                        className="quick-action-button"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            handleQuickAdd('mj-image')
                                        }}
                                        title="Add image"
                                    >
                                        <span className="icon">🖼️</span>
                                        Image
                                    </button>
                                    <button
                                        className="quick-action-button"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            handleQuickAdd('mj-spacer')
                                        }}
                                        title="Add spacer"
                                    >
                                        <span className="icon">📏</span>
                                        Spacer
                                    </button>
                                </div>
                            </>
                        )}
                        {/* Column insertion icons for selected columns with content */}
                        {!isEmpty && !isPreviewMode && isSelected && parentId && typeof index === 'number' && (
                            <>
                                <div className="column-insert-icons column-insert-left">
                                    <button
                                        className="column-insert-button"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            handleColumnInsert('left')
                                        }}
                                        title="Insert column to the left"
                                    >
                                        +
                                    </button>
                                </div>
                                <div className="column-insert-icons column-insert-right">
                                    <button
                                        className="column-insert-button"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            handleColumnInsert('right')
                                        }}
                                        title="Insert column to the right"
                                    >
                                        +
                                    </button>
                                </div>
                            </>
                        )}
                        {children}
                    </div>
                )
            }

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
                const href = attributes.href ?? '#'
                const target = attributes.target ?? '_blank'
                const linkColor = attributes.color ?? 'var(--color-on-background)'
                const linkPadding = attributes.padding ?? '10px 15px'
                const fontSize = attributes['font-size']
                const fontFamily = attributes['font-family']
                return isEditing
                    ? (
                        <ContentEditor
                            content={content ?? ''}
                            onSave={handleContentEdit}
                            onCancel={handleCancelEdit}
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
                                fontSize,
                                fontFamily,
                            }}
                            dangerouslySetInnerHTML={{ __html: content ?? 'Link' }}
                        />
                    )
            }

            case 'mj-social':
                return (
                    <div
                        className="mj-social-content"
                        style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: attributes['icon-padding'] ?? '8px',
                            width: '100%',
                            justifyContent:
                                (attributes.align === 'center')
                                    ? 'center'
                                    : (attributes.align === 'right')
                                        ? 'flex-end'
                                        : 'flex-start',
                        }}
                    >
                        {children}
                    </div>
                )

            case 'mj-social-element': {
                const name = attributes.name ?? 'web'
                const href = attributes.href ?? '#'
                const target = attributes.target ?? '_blank'
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
                            color: fg ?? 'var(--color-on-background)',
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
                const align = attributes.align ?? 'left'
                const width = attributes.width ?? '100%'
                const cellpadding = attributes.cellpadding ?? '0'
                const cellspacing = attributes.cellspacing ?? '0'
                return (
                    <table
                        style={{ width, textAlign: align, borderCollapse: 'collapse' }}
                        cellPadding={parseInt(String(cellpadding), 10)}
                        cellSpacing={parseInt(String(cellspacing), 10)}
                    >
                        <tbody>
                            <tr>
                                <td dangerouslySetInnerHTML={{ __html: content ?? '' }} />
                            </tr>
                        </tbody>
                    </table>
                )
            }
            default:
                return content
                    ? (
                        <div
                            className={`${tagName}-content`}
                            dangerouslySetInnerHTML={{ __html: content }}
                        />
                    )
                    : (
                        <>{children}</>
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
        if (hoveredActive) classes.push('hovered')
        if (isDragging) classes.push('dragging')
        if (isOver && canDrop) classes.push('drop-target')
        if (isPreviewMode) classes.push('preview-mode')

        // Add empty-column class for empty mj-column elements
        if (element.tagName === 'mj-column' && (!element.children || element.children.length === 0)) {
            classes.push('empty-column')
        }

        // Add empty-section class for empty mj-section elements
        if (element.tagName === 'mj-section' && (!element.children || element.children.length === 0)) {
            classes.push('empty-section')
        }

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

            {!isPreviewMode && (isDraggingSectionLike || isDraggingTemplate) && isSectionElement && typeof index === 'number' && parentId && (
                <>
                    <div
                        ref={dropTop}
                        className={`section-drop-zone section-drop-zone--top ${isOverTop && canDropTop ? 'over' : ''}`}
                        data-label="Drop above"
                    >
                        <div className="drop-line"></div>
                    </div>
                    <div
                        ref={dropBottom}
                        className={`section-drop-zone section-drop-zone--bottom ${isOverBottom && canDropBottom ? 'over' : ''}`}
                        data-label="Drop below"
                    >
                        <div className="drop-line"></div>
                    </div>
                </>
            )}

            {!isPreviewMode && !isEditing && (isSelected || hoveredActive) && inlineEditableTags.has(element.tagName) && (
                <div className="inline-edit-hint">Double-click to edit</div>
            )}

            {!isPreviewMode && isSelected && (
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
                                disabled={!(typeof index === 'number' && index > 0) || isGlobalLock}
                                title="Move section up"
                            >
                                ↑
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
                                ) || isGlobalLock}
                                title="Move section down"
                            >
                                ↓
                            </button>
                        </>
                    )}
                    <button
                        className="control-button copy"
                        onClick={(e) => {
                            e.stopPropagation()
                            safeOnCopyElement(element.id)
                        }}
                        title="Copy element (Ctrl+C)"
                        disabled={isGlobalLock}
                    >
                        📋
                    </button>
                    {element.tagName !== 'mjml' && element.tagName !== 'mj-body' && (
                        <button
                            className="control-button duplicate"
                            onClick={(e) => {
                                e.stopPropagation()
                                safeOnDuplicateElement(element.id)
                            }}
                            title="Duplicate element"
                            disabled={isGlobalLock}
                        >
                            📝
                        </button>
                    )}
                    <button
                        className="control-button delete"
                        onClick={handleDelete}
                        title="Delete element"
                        disabled={isGlobalLock}
                    >
                        ✕
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
