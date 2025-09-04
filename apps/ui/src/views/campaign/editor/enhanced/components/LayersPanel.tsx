// Layers Panel for Enhanced MJML Editor
import React, { useMemo, useState, useRef } from 'react'
import { useDrag, useDrop } from 'react-dnd'
import { EditorElement } from '../types'
import './LayersPanel.css'
import { getAllowedChildren } from '../utils/mjmlRules'

interface LayersPanelProps {
    elements: EditorElement[]
    selectedElementId: string | null
    onSelect: (elementId: string | null) => void
    onDelete: (elementId: string) => void
    onMove: (elementId: string, newParentId: string, newIndex: number) => void
}

const iconForTag = (tag: string): string => {
    const map: Record<string, string> = {
        mjml: '🧩',
        'mj-body': '📄',
        'mj-wrapper': '🧺',
        'mj-section': '🧱',
        'mj-group': '🗂️',
        'mj-column': '📦',
        'mj-text': '🔤',
        'mj-button': '🔘',
        'mj-image': '🖼️',
        'mj-divider': '➖',
        'mj-spacer': '⬜',
        'mj-navbar': '🧭',
        'mj-navbar-link': '🔗',
        'mj-social': '🌐',
        'mj-social-element': '🔗',
        'mj-hero': '🦸',
        'mj-raw': '🧾',
    }
    return map[tag] || '🔹'
}

// Allowed-children rules are centralized in '../utils/mjmlRules'

// Recursive Layer item
interface LayerItemProps {
    element: EditorElement
    indexInParent: number
    parentId: string | null
    parentTagName: string | null
    selectedId: string | null
    onSelect: (id: string) => void
    onDelete: (id: string) => void
    onMove: (id: string, newParentId: string, newIndex: number) => void
}

const LayerItem: React.FC<LayerItemProps> = ({
    element,
    indexInParent,
    parentId,
    parentTagName,
    selectedId,
    onSelect,
    onDelete,
    onMove,
}) => {
    const [expanded, setExpanded] = useState(true)
    const ref = useRef<HTMLDivElement>(null)

    const hasChildren = element.children && element.children.length > 0

    // Drag existing element from the layers tree
    const [{ isDragging }, drag] = useDrag({
        type: 'element',
        item: { id: element.id, type: element.tagName, tagName: element.tagName },
        collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    })

    // Compute drop permission based on pointer position (before/inside/after)
    const canDropFrom = (draggedTag: string, dropMode: 'before' | 'inside' | 'after'): boolean => {
        if (dropMode === 'inside') {
            const allowed = getAllowedChildren(element.tagName)
            return allowed.includes(draggedTag)
        }
        // For before/after, validate against the parent
        if (!parentTagName || !parentId) return false
        const allowed = getAllowedChildren(parentTagName)
        return allowed.includes(draggedTag)
    }

    const [{ isOver, dropMode }, drop] = useDrop({
        accept: ['element'],
        hover: (item: any, monitor) => {
            if (!ref.current) return
            const clientOffset = monitor.getClientOffset()
            if (!clientOffset) return
            const rect = ref.current.getBoundingClientRect()
            const y = clientOffset.y - rect.top
            const ratio = y / Math.max(rect.height, 1)
            const mode: 'before' | 'inside' | 'after' = ratio < 0.33 ? 'before' : ratio > 0.67 ? 'after' : 'inside'
            // Auto-expand on inside hover for easier dropping
            if (mode === 'inside' && hasChildren && !expanded) {
                setExpanded(true)
            }
        },
        drop: (item: any, monitor) => {
            if (!ref.current) return
            const clientOffset = monitor.getClientOffset()
            const rect = ref.current.getBoundingClientRect()
            const y = clientOffset ? clientOffset.y - rect.top : 0
            const ratio = y / Math.max(rect.height, 1)
            const mode: 'before' | 'inside' | 'after' = ratio < 0.33 ? 'before' : ratio > 0.67 ? 'after' : 'inside'

            const draggedTag = item.type || item.tagName
            if (!draggedTag) return

            if (!canDropFrom(draggedTag, mode)) return

            if (mode === 'inside') {
                const newIndex = element.children?.length ?? 0
                onMove(item.id, element.id, newIndex)
            } else if (mode === 'before') {
                if (!parentId) return
                onMove(item.id, parentId, indexInParent)
            } else {
                if (!parentId) return
                onMove(item.id, parentId, indexInParent + 1)
            }
        },
        collect: (monitor) => {
            let mode: 'before' | 'inside' | 'after' | null = null
            if (ref.current && monitor.isOver({ shallow: true })) {
                const clientOffset = monitor.getClientOffset()
                const rect = ref.current.getBoundingClientRect()
                const y = clientOffset ? clientOffset.y - rect.top : 0
                const ratio = y / Math.max(rect.height, 1)
                mode = ratio < 0.33 ? 'before' : ratio > 0.67 ? 'after' : 'inside'
            }
            return {
                isOver: monitor.isOver({ shallow: true }),
                dropMode: mode,
            }
        },
    }) as any

    drag(drop(ref))

    const isSelected = selectedId === element.id

    return (
        <div
            ref={ref}
            className={[
                'layer-item',
                isSelected ? 'selected' : '',
                isDragging ? 'dragging' : '',
                isOver && dropMode ? `dropping-${dropMode}` : '',
            ].filter(Boolean).join(' ')}
            onClick={(e) => { e.stopPropagation(); onSelect(element.id) }}
        >
            <div className="layer-row">
                {hasChildren
                    ? (
                        <button className="expander" onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}>
                            {expanded ? '▾' : '▸'}
                        </button>
                    )
                    : <span className="expander-placeholder" />
                }
                <span className="icon" title={element.tagName}>{iconForTag(element.tagName)}</span>
                <span className="label">{element.tagName}</span>
                <div className="spacer" />
                <button
                    className="delete-btn"
                    title="Delete element"
                    onClick={(e) => { e.stopPropagation(); onDelete(element.id) }}
                >
                    ✖
                </button>
            </div>

            {expanded && hasChildren && (
                <div className="children">
                    {element.children.map((child, idx) => (
                        <LayerItem
                            key={child.id}
                            element={child}
                            indexInParent={idx}
                            parentId={element.id}
                            parentTagName={element.tagName}
                            selectedId={selectedId}
                            onSelect={onSelect}
                            onDelete={onDelete}
                            onMove={onMove}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

const LayersPanel: React.FC<LayersPanelProps> = ({ elements, selectedElementId, onSelect, onDelete, onMove }) => {
    // Build a root container if elements are multiple roots; expect one root 'mjml'
    const rootElements = useMemo(() => elements || [], [elements])

    return (
        <div className="layers-panel" onClick={() => onSelect(null)}>
            <div className="panel-header">
                <h3>Layers</h3>
            </div>
            <div className="layers-tree">
                {rootElements.map((el, idx) => (
                    <LayerItem
                        key={el.id}
                        element={el}
                        indexInParent={idx}
                        parentId={null}
                        parentTagName={null}
                        selectedId={selectedElementId}
                        onSelect={(id) => onSelect(id)}
                        onDelete={onDelete}
                        onMove={onMove}
                    />
                ))}
            </div>
        </div>
    )
}

export default LayersPanel
