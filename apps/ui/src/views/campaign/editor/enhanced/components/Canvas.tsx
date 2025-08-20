// Enhanced Canvas Component for Parcelvoy MJML Editor
import React, { useRef, useCallback, useEffect, useState } from 'react'
import { useDrop } from 'react-dnd'
import { EditorElement, ComponentDefinition } from '../types'
import { generateId } from '../utils/mjmlParser'
// Import directly to avoid circular dependencies
import DroppableElement from './DroppableElement'
import './Canvas.css'
import { toArray } from '../utils/arrayUtils'

interface CanvasProps {
    elements: EditorElement[]
    selectedElementId: string | null
    onElementAdd: (element: EditorElement, parentId?: string, index?: number) => void
    onElementSelect: (elementId: string | null) => void
    onElementUpdate: (elementId: string, attributes: Record<string, any>, content?: string) => void
    onElementDelete: (elementId: string) => void
    onElementMove: (elementId: string, newParentId: string, newIndex: number) => void
    onEditButtonClick?: (elementId: string) => void
    onCopyElement?: (elementId: string) => void
    onDuplicateElement?: (elementId: string) => void
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
    onEditButtonClick,
    onCopyElement,
    onDuplicateElement,
    isPreviewMode = false,
}) => {
    // Comprehensive safety checks
    const safeElements = !elements || !Array.isArray(elements) ? [] : elements

    // Global editing lock: when true, disable ALL drag/drop operations
    const [isEditingAny, setIsEditingAny] = useState(false)

    // Safety checks for callback functions
    const safeOnElementAdd = onElementAdd || (() => {})
    const safeOnElementSelect = onElementSelect || (() => {})
    const safeOnElementUpdate = onElementUpdate || (() => {})
    const safeOnElementDelete = onElementDelete || (() => {})
    const safeOnElementMove = onElementMove || (() => {})
    const safeOnCopyElement = onCopyElement ?? (() => {})
    const safeOnDuplicateElement = onDuplicateElement ?? (() => {})
    const canvasRef = useRef<HTMLDivElement | null>(null)

    // toArray imported from shared utils to normalize children arrays consistently

    // Handle component drop from components panel
    const [{ isOver, canDrop }, drop] = useDrop({
        accept: 'component',
        drop: (item: ComponentDefinition, monitor) => {
            if (monitor.didDrop()) return // Prevent duplicate drops
            if (isPreviewMode || isEditingAny) return // Disable drop while preview or editing inline

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
            console.log('Drop handler - elements:', safeElements.length)

            const mjmlRoot = safeElements.find((el: EditorElement) => el.tagName === 'mjml')
            if (!mjmlRoot) {
                console.error('No mjml root found in elements')
                return
            }
            const rootChildren = toArray(mjmlRoot?.children)
            const mjmlBody = rootChildren.find((el: EditorElement) => el.tagName === 'mj-body')
            if (!mjmlBody) {
                console.error('No mj-body found in mjml root')
                return
            }

            // If it's a layout component (section), add to mj-body
            if (item.type === 'mj-section' || item.type === 'enhanced-section') {
                safeOnElementAdd(newElement, mjmlBody.id)
                return
            }

            // Groups must be direct children of sections
            if (item.type === 'mj-group') {
                const sections = toArray(mjmlBody.children).filter((el: EditorElement) => el.tagName === 'mj-section' || el.tagName === 'enhanced-section')
                const lastSection = sections[sections.length - 1]
                if (lastSection) {
                    safeOnElementAdd(newElement, lastSection.id)
                } else {
                    const newSection: EditorElement = {
                        id: generateId(),
                        type: 'mj-section',
                        tagName: 'mj-section',
                        attributes: { 'background-color': '#ffffff', padding: '20px 0' },
                        children: [],
                    }
                    safeOnElementAdd(newSection, mjmlBody.id)
                    safeOnElementAdd(newElement, newSection.id)
                }
                // Add a default column inside the group for usability
                const defaultColumn: EditorElement = {
                    id: generateId(),
                    type: 'mj-column',
                    tagName: 'mj-column',
                    attributes: { width: '100%' },
                    children: [],
                }
                safeOnElementAdd(defaultColumn, newElement.id)
                return
            }

            // Wrapper and Hero live directly under mj-body
            if (item.type === 'mj-wrapper' || item.type === 'mj-hero') {
                safeOnElementAdd(newElement, mjmlBody.id)
                return
            }

            // Handle subcomponents that require a specific parent container
            if (
                item.type === 'mj-navbar-link'
                || item.type === 'mj-social-element'
                || item.type === 'mj-carousel-image'
                || item.type === 'mj-accordion-element'
                || item.type === 'mj-accordion-title'
                || item.type === 'mj-accordion-text'
            ) {
                const sections = toArray(mjmlBody.children).filter((el: EditorElement) => el.tagName === 'mj-section' || el.tagName === 'enhanced-section')
                let section = sections[sections.length - 1]
                if (!section) {
                    section = {
                        id: generateId(),
                        type: 'mj-section',
                        tagName: 'mj-section',
                        attributes: { 'background-color': '#ffffff', padding: '20px 0' },
                        children: [],
                    }
                    safeOnElementAdd(section, mjmlBody.id)
                }
                const columns = section.children?.filter((el: EditorElement) => el.tagName === 'mj-column') || []
                let column = columns[columns.length - 1]
                if (!column) {
                    column = {
                        id: generateId(),
                        type: 'mj-column',
                        tagName: 'mj-column',
                        attributes: { width: '100%' },
                        children: [],
                    }
                    safeOnElementAdd(column, section.id)
                }

                if (item.type === 'mj-navbar-link') {
                    const navbar: EditorElement = { id: generateId(), type: 'mj-navbar', tagName: 'mj-navbar', attributes: {}, children: [] }
                    safeOnElementAdd(navbar, column.id)
                    safeOnElementAdd(newElement, navbar.id)
                    return
                }
                if (item.type === 'mj-social-element') {
                    const social: EditorElement = { id: generateId(), type: 'mj-social', tagName: 'mj-social', attributes: {}, children: [] }
                    safeOnElementAdd(social, column.id)
                    safeOnElementAdd(newElement, social.id)
                    return
                }
                if (item.type === 'mj-carousel-image') {
                    const carousel: EditorElement = { id: generateId(), type: 'mj-carousel', tagName: 'mj-carousel', attributes: {}, children: [] }
                    safeOnElementAdd(carousel, column.id)
                    safeOnElementAdd(newElement, carousel.id)
                    return
                }
                if (item.type === 'mj-accordion-element') {
                    const accordion: EditorElement = { id: generateId(), type: 'mj-accordion', tagName: 'mj-accordion', attributes: {}, children: [] }
                    safeOnElementAdd(accordion, column.id)
                    safeOnElementAdd(newElement, accordion.id)
                    return
                }
                if (item.type === 'mj-accordion-title' || item.type === 'mj-accordion-text') {
                    const accordion: EditorElement = { id: generateId(), type: 'mj-accordion', tagName: 'mj-accordion', attributes: {}, children: [] }
                    safeOnElementAdd(accordion, column.id)
                    const accEl: EditorElement = { id: generateId(), type: 'mj-accordion-element', tagName: 'mj-accordion-element', attributes: {}, children: [] }
                    safeOnElementAdd(accEl, accordion.id)
                    safeOnElementAdd(newElement, accEl.id)
                    return
                }
            }

            // If it's a column, add to the last section or create a new section
            if (item.type === 'mj-column') {
                const sections = mjmlBody.children?.filter((el: EditorElement) => el.tagName === 'mj-section' || el.tagName === 'enhanced-section') || []
                const lastSection = sections[sections.length - 1]
                if (lastSection) {
                    safeOnElementAdd(newElement, lastSection.id)
                } else {
                    // Create a new section first
                    const newSection: EditorElement = {
                        id: generateId(),
                        type: 'mj-section',
                        tagName: 'mj-section',
                        attributes: { 'background-color': '#ffffff', padding: '20px 0' },
                        children: [],
                    }
                    safeOnElementAdd(newSection, mjmlBody.id)
                    safeOnElementAdd(newElement, newSection.id)
                }
                return
            }

            // For content components, add to the last column or create structure
            const sections = toArray(mjmlBody.children).filter((el: EditorElement) => el.tagName === 'mj-section' || el.tagName === 'enhanced-section')
            const lastSection = sections[sections.length - 1]
            if (lastSection) {
                const columns = toArray(lastSection.children).filter((el: EditorElement) => el.tagName === 'mj-column')
                const lastColumn = columns[columns.length - 1]
                if (lastColumn) {
                    safeOnElementAdd(newElement, lastColumn.id)
                } else {
                    // Create a new column in the section
                    const newColumn: EditorElement = {
                        id: generateId(),
                        type: 'mj-column',
                        tagName: 'mj-column',
                        attributes: { width: '100%' },
                        children: [],
                    }
                    safeOnElementAdd(newColumn, lastSection.id)
                    safeOnElementAdd(newElement, newColumn.id)
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

                safeOnElementAdd(newSection, mjmlBody.id)
                safeOnElementAdd(newColumn, newSection.id)
                safeOnElementAdd(newElement, newColumn.id)
            }
        },
        collect: (monitor) => ({
            isOver: monitor.isOver({ shallow: true }),
            canDrop: monitor.canDrop(),
        }),
        canDrop: () => !isPreviewMode && !isEditingAny,
    })

    // Combine refs for drop functionality
    const combinedRef = useCallback((node: HTMLDivElement | null) => {
        if (node) {
            canvasRef.current = node
            drop(node)
        }
    }, [drop])

    const handleCanvasClick = (e: React.MouseEvent) => {
        // Only deselect if clicking directly on canvas background
        if (e.target === e.currentTarget) {
            safeOnElementSelect(null)
        }
    }

    const renderElements = (elements: EditorElement[] | any, parentId?: string): React.ReactNode => {
        const list = Array.isArray(elements) ? elements : []
        const siblingsCount = list.length
        return list.map((element, index) => (
            <DroppableElement
                key={element.id}
                element={element}
                isSelected={selectedElementId === element.id}
                isPreviewMode={isPreviewMode}
                onSelect={safeOnElementSelect}
                onUpdate={safeOnElementUpdate}
                onDelete={safeOnElementDelete}
                onMove={safeOnElementMove}
                onElementAdd={safeOnElementAdd}
                onEditButtonClick={onEditButtonClick}
                onCopyElement={safeOnCopyElement}
                onDuplicateElement={safeOnDuplicateElement}
                parentId={parentId}
                index={index}
                siblingsCount={siblingsCount}
                globalEditingLock={isEditingAny}
                onInlineEditStart={() => setIsEditingAny(true)}
                onInlineEditEnd={() => setIsEditingAny(false)}
            >
                {toArray(element.children).length > 0
                    && renderElements(toArray(element.children), element.id)}
            </DroppableElement>
        ))
    }

    // Canvas should not create default structure - that's handled by parent component
    // Just log for debugging purposes
    useEffect(() => {
        if (safeElements.length === 0) {
            console.log('Canvas: No elements provided - parent should handle default structure creation')
        } else {
            console.log('Canvas: Received', safeElements.length, 'elements from parent')
        }
    }, [safeElements.length])

    // Find MJML structure for rendering
    const mjmlRoot = safeElements.find((el: EditorElement) => el.tagName === 'mjml')
    const mjmlBody = toArray(mjmlRoot?.children).find((el: EditorElement) => el.tagName === 'mj-body')

    // Detailed debug logging
    console.log('Canvas: Detailed Debug Info:')
    console.log('- Elements received:', safeElements.length)
    console.log('- Elements structure:', safeElements.map(el => ({ id: el.id, tagName: el.tagName, childrenCount: Array.isArray(el.children) ? el.children.length : toArray(el.children).length })))
    console.log('- MJML Root found:', !!mjmlRoot)
    if (mjmlRoot) {
        const rc = toArray(mjmlRoot.children)
        console.log('- MJML Root children:', rc.map(child => ({ id: child.id, tagName: child.tagName, childrenCount: Array.isArray(child.children) ? child.children.length : toArray(child.children).length })))
    }
    console.log('- MJML Body found:', !!mjmlBody)
    if (mjmlBody) {
        const bc = toArray(mjmlBody.children)
        console.log('- MJML Body children:', bc.length)
        console.log('- MJML Body structure:', bc.map(child => ({ id: child.id, tagName: child.tagName, childrenCount: Array.isArray(child.children) ? child.children.length : toArray(child.children).length })))
    }
    console.log('- Will show empty state:', !mjmlBody)

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
                            {renderElements(toArray(mjmlBody.children), mjmlBody.id)}
                        </div>
                    )
                    : (
                        <div className="canvas-empty">
                            <div className="empty-state">
                                <div className="empty-icon">📧</div>
                                <h3>Start Building Your Email</h3>
                                <p>Drag components from the left panel to begin creating your email template.</p>
                                <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--color-primary-soft)' }}>
                                    Debug: {safeElements.length} elements, mjmlRoot: {mjmlRoot ? 'found' : 'missing'}, mjmlBody: {mjmlBody ? 'found' : 'missing'}
                                </div>
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
