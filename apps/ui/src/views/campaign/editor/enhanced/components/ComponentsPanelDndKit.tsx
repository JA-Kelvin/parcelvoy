import React, { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { ComponentDefinition } from '../types'
import './ComponentsPanel.css'

// MJML Component Definitions
const structureComponents: ComponentDefinition[] = [
    {
        type: 'mj-section',
        tagName: 'mj-section',
        displayName: 'Section',
        icon: '🔳',
        category: 'structure',
        defaultAttributes: {
            'background-color': '#ffffff',
            padding: '10px 0',
        },
        allowedParents: ['mj-body', 'mj-wrapper'],
    },
    {
        type: 'mj-column',
        tagName: 'mj-column',
        displayName: 'Column',
        icon: '🔲',
        category: 'structure',
        defaultAttributes: {
            width: '100%',
            padding: '0',
        },
        allowedParents: ['mj-section', 'mj-group'],
    },
    {
        type: 'mj-wrapper',
        tagName: 'mj-wrapper',
        displayName: 'Wrapper',
        icon: '📦',
        category: 'structure',
        defaultAttributes: {
            padding: '10px 0',
        },
        allowedParents: ['mj-body'],
    },
    {
        type: 'mj-group',
        tagName: 'mj-group',
        displayName: 'Group',
        icon: '🔣',
        category: 'structure',
        defaultAttributes: {
            width: '100%',
        },
        allowedParents: ['mj-section'],
    },
]

const contentComponents: ComponentDefinition[] = [
    {
        type: 'mj-text',
        tagName: 'mj-text',
        displayName: 'Text',
        icon: '📝',
        category: 'content',
        defaultAttributes: {
            'font-size': '14px',
            color: '#000000',
            'line-height': '1.5',
            padding: '10px 25px',
        },
        allowedParents: ['mj-column', 'mj-hero'],
    },
    {
        type: 'mj-button',
        tagName: 'mj-button',
        displayName: 'Button',
        icon: '🔘',
        category: 'content',
        defaultAttributes: {
            'background-color': '#0078D4',
            color: '#ffffff',
            'font-size': '14px',
            padding: '10px 25px',
            'border-radius': '3px',
            href: '#',
        },
        allowedParents: ['mj-column', 'mj-hero'],
    },
    {
        type: 'mj-image',
        tagName: 'mj-image',
        displayName: 'Image',
        icon: '🖼️',
        category: 'content',
        defaultAttributes: {
            padding: '10px 25px',
            src: 'https://via.placeholder.com/600x300',
            alt: 'Image',
            width: '100%',
        },
        allowedParents: ['mj-column', 'mj-hero'],
    },
    {
        type: 'mj-divider',
        tagName: 'mj-divider',
        displayName: 'Divider',
        icon: '➖',
        category: 'content',
        defaultAttributes: {
            'border-color': '#e0e0e0',
            'border-width': '1px',
            padding: '10px 25px',
        },
        allowedParents: ['mj-column', 'mj-hero'],
    },
    {
        type: 'mj-spacer',
        tagName: 'mj-spacer',
        displayName: 'Spacer',
        icon: '↕️',
        category: 'content',
        defaultAttributes: {
            height: '20px',
        },
        allowedParents: ['mj-column', 'mj-hero'],
    },
]

const advancedComponents: ComponentDefinition[] = [
    {
        type: 'mj-hero',
        tagName: 'mj-hero',
        displayName: 'Hero',
        icon: '🦸',
        category: 'advanced',
        defaultAttributes: {
            'background-color': '#ffffff',
            'background-url': 'https://via.placeholder.com/600x300',
            'background-position': 'center center',
            padding: '100px 0px',
            'vertical-align': 'middle',
        },
        allowedParents: ['mj-body'],
    },
    {
        type: 'mj-navbar',
        tagName: 'mj-navbar',
        displayName: 'Navbar',
        icon: '🧭',
        category: 'advanced',
        defaultAttributes: {
            'base-url': 'https://example.com',
            hamburger: 'hamburger',
        },
        allowedParents: ['mj-column'],
    },
    {
        type: 'mj-social',
        tagName: 'mj-social',
        displayName: 'Social',
        icon: '👥',
        category: 'advanced',
        defaultAttributes: {
            'font-size': '14px',
            'icon-size': '30px',
            mode: 'horizontal',
        },
        allowedParents: ['mj-column', 'mj-hero'],
    },
    {
        type: 'mj-carousel',
        tagName: 'mj-carousel',
        displayName: 'Carousel',
        icon: '🎠',
        category: 'advanced',
        defaultAttributes: {
            'icon-width': '44px',
            thumbnails: 'visible',
        },
        allowedParents: ['mj-column'],
    },
    {
        type: 'mj-accordion',
        tagName: 'mj-accordion',
        displayName: 'Accordion',
        icon: '🪗',
        category: 'advanced',
        defaultAttributes: {
            padding: '10px',
        },
        allowedParents: ['mj-column'],
    },
]

interface DraggableComponentProps {
    component: ComponentDefinition
    onComponentDrag?: (component: ComponentDefinition) => void
}

const DraggableComponent: React.FC<DraggableComponentProps> = ({ component, onComponentDrag }) => {
    // Use dnd-kit's useDraggable hook
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `component-${component.type}`,
        data: {
            component,
            type: 'component',
        },
    })

    const style = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
    }

    const handleDragStart = () => {
        if (onComponentDrag) {
            onComponentDrag(component)
        }
    }

    return (
        <div
            className={`component-item ${isDragging ? 'dragging' : ''}`}
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            onDragStart={handleDragStart}
        >
            <div className="component-icon">{component.icon}</div>
            <div className="component-name">{component.displayName}</div>
        </div>
    )
}

interface ComponentsPanelProps {
    onComponentDrag?: (component: ComponentDefinition) => void
    isCollapsed?: boolean
    onToggleCollapse?: () => void
}

const ComponentsPanelDndKit: React.FC<ComponentsPanelProps> = ({
    onComponentDrag,
    isCollapsed = false,
}) => {
    const [activeCategory, setActiveCategory] = useState<'structure' | 'content' | 'advanced'>('structure')

    return (
        <div className={`components-panel ${isCollapsed ? 'collapsed' : ''}`}>
            <div className="components-panel-header">
                <div className="category-tabs">
                    <button
                        className={`category-tab ${activeCategory === 'structure' ? 'active' : ''}`}
                        onClick={() => setActiveCategory('structure')}
                    >
                        Structure
                    </button>
                    <button
                        className={`category-tab ${activeCategory === 'content' ? 'active' : ''}`}
                        onClick={() => setActiveCategory('content')}
                    >
                        Content
                    </button>
                    <button
                        className={`category-tab ${activeCategory === 'advanced' ? 'active' : ''}`}
                        onClick={() => setActiveCategory('advanced')}
                    >
                        Advanced
                    </button>
                </div>
            </div>

            <div className="components-list">
                {activeCategory === 'structure' && structureComponents.map((component) => (
                    <DraggableComponent
                        key={component.type}
                        component={component}
                        onComponentDrag={onComponentDrag}
                    />
                ))}
                {activeCategory === 'content' && contentComponents.map((component) => (
                    <DraggableComponent
                        key={component.type}
                        component={component}
                        onComponentDrag={onComponentDrag}
                    />
                ))}
                {activeCategory === 'advanced' && advancedComponents.map((component) => (
                    <DraggableComponent
                        key={component.type}
                        component={component}
                        onComponentDrag={onComponentDrag}
                    />
                ))}
            </div>
        </div>
    )
}

export default ComponentsPanelDndKit
