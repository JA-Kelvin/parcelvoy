// Enhanced Components Panel for Parcelvoy MJML Editor
import React from 'react'
import { useDrag } from 'react-dnd'
import { ComponentDefinition } from '../types'
import './ComponentsPanel.css'
import { CUSTOM_TEMPLATES } from '../templates/customTemplates'

interface ComponentsPanelProps {
    onComponentDrag: (component: ComponentDefinition) => void
    onTemplateInsert?: (templateId: string) => void
    isCollapsed?: boolean
    onToggleCollapse?: () => void
}

// MJML Component definitions
const MJML_COMPONENTS: ComponentDefinition[] = [
    // Layout Components
    {
        type: 'mj-section',
        tagName: 'mj-section',
        displayName: 'Section',
        category: 'layout',
        icon: '📐',
        defaultAttributes: {
            'background-color': '#ffffff',
            padding: '20px 0',
        },
        allowedChildren: ['mj-column', 'mj-group'],
    },
    {
        type: 'mj-column',
        tagName: 'mj-column',
        displayName: 'Column',
        category: 'layout',
        icon: '📏',
        defaultAttributes: {
            width: '100%',
        },
        allowedChildren: ['mj-text', 'mj-image', 'mj-button', 'mj-divider', 'mj-spacer', 'mj-social', 'mj-raw'],
    },
    {
        type: 'mj-group',
        tagName: 'mj-group',
        displayName: 'Group',
        category: 'layout',
        icon: '🗂️',
        defaultAttributes: {},
        allowedChildren: ['mj-column'],
    },

    // Content Components
    {
        type: 'mj-text',
        tagName: 'mj-text',
        displayName: 'Text',
        category: 'content',
        icon: '📝',
        defaultAttributes: {
            'font-size': '16px',
            color: '#333333',
            'line-height': '1.5',
        },
    },
    {
        type: 'mj-button',
        tagName: 'mj-button',
        displayName: 'Button',
        category: 'content',
        icon: '🔘',
        defaultAttributes: {
            'background-color': '#007bff',
            color: '#ffffff',
            'border-radius': '4px',
            padding: '12px 24px',
            'font-size': '16px',
        },
    },
    {
        type: 'mj-navbar',
        tagName: 'mj-navbar',
        displayName: 'Navigation',
        category: 'content',
        icon: '🧭',
        defaultAttributes: {
            'container-background-color': '#ffffff',
            'base-url': '',
            'ico-color': '#000000',
            'ico-font-family': 'Arial, sans-serif',
            'ico-font-size': '16px',
        },
        allowedChildren: ['mj-navbar-link'],
    },

    // Media Components
    {
        type: 'mj-image',
        tagName: 'mj-image',
        displayName: 'Image',
        category: 'media',
        icon: '🖼️',
        defaultAttributes: {
            width: '100%',
            alt: 'Image',
        },
        isVoid: true,
    },
    {
        type: 'mj-hero',
        tagName: 'mj-hero',
        displayName: 'Hero',
        category: 'media',
        icon: '🎭',
        defaultAttributes: {
            mode: 'fluid-height',
            'background-color': '#f0f0f0',
            padding: '40px 0',
        },
        allowedChildren: ['mj-text', 'mj-button'],
    },

    // Social Components
    {
        type: 'mj-social',
        tagName: 'mj-social',
        displayName: 'Social',
        category: 'social',
        icon: '📱',
        defaultAttributes: {
            mode: 'horizontal',
        },
        allowedChildren: ['mj-social-element'],
    },

    // Utility Components
    {
        type: 'mj-divider',
        tagName: 'mj-divider',
        displayName: 'Divider',
        category: 'content',
        icon: '➖',
        defaultAttributes: {
            'border-color': '#cccccc',
            'border-width': '1px',
        },
        isVoid: true,
    },
    {
        type: 'mj-spacer',
        tagName: 'mj-spacer',
        displayName: 'Spacer',
        category: 'content',
        icon: '⬜',
        defaultAttributes: {
            height: '20px',
        },
        isVoid: true,
    },
    {
        type: 'mj-raw',
        tagName: 'mj-raw',
        displayName: 'Raw HTML',
        category: 'content',
        icon: '🔧',
        defaultAttributes: {},
        isVoid: true,
    },
]

// Draggable Component Item using react-dnd
interface DraggableComponentProps {
    component: ComponentDefinition
    onComponentDrag?: (component: ComponentDefinition) => void
}

const DraggableComponent: React.FC<DraggableComponentProps> = ({ component, onComponentDrag }) => {
    const [{ isDragging }, drag] = useDrag<ComponentDefinition, unknown, { isDragging: boolean }>({
        type: 'component',
        item: component,
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
    })

    // Handle drag start callback
    React.useEffect(() => {
        if (isDragging && onComponentDrag) {
            onComponentDrag(component)
        }
    }, [isDragging, component, onComponentDrag])

    return (
        <div
            ref={drag}
            className={`component-item ${isDragging ? 'dragging' : ''}`}
            title={component.displayName}
            style={{ opacity: isDragging ? 0.5 : 1 }}
        >
            <div className="component-icon">
                {component.icon}
            </div>
            <div className="component-name">
                {component.displayName}
            </div>
        </div>
    )
}

const ComponentsPanel: React.FC<ComponentsPanelProps> = ({
    onComponentDrag,
    onTemplateInsert,
    isCollapsed = false,
    onToggleCollapse,
}) => {
    // Safety check for callback function
    const safeOnComponentDrag = onComponentDrag || (() => {})
    const safeOnTemplateInsert = onTemplateInsert ?? (() => {})

    const categories = ['layout', 'content', 'media', 'social'] as const
    const getComponentsByCategory = (category: string) => {
        return MJML_COMPONENTS.filter(comp => comp.category === category)
    }

    if (isCollapsed) {
        return (
            <div className="components-panel collapsed">
                <button
                    className="toggle-button"
                    onClick={onToggleCollapse}
                    title="Expand Components Panel"
                >
                    📦
                </button>
            </div>
        )
    }

    return (
        <div className="components-panel">
            <div className="panel-header">
                <h3>Components</h3>
                <button
                    className="toggle-button"
                    onClick={onToggleCollapse}
                    title="Collapse Components Panel"
                >
                </button>
            </div>

            <div className="panel-content">
                {categories.map(category => {
                    const components = getComponentsByCategory(category)
                    if (components.length === 0) return null

                    return (
                        <div key={category} className="component-category">
                            <h4 className="category-title">
                                {category.charAt(0).toUpperCase() + category.slice(1)}
                            </h4>

                            <div className="component-grid">
                                {components.map(component => (
                                    <DraggableComponent
                                        key={component.type}
                                        component={component}
                                        onComponentDrag={safeOnComponentDrag}
                                    />
                                ))}
                            </div>
                        </div>
                    )
                })}

                {/* Custom Templates Section */}
                {CUSTOM_TEMPLATES.length > 0 && (
                    <div className="component-category">
                        <h4 className="category-title">Custom Templates</h4>
                        <div className="component-grid">
                            {CUSTOM_TEMPLATES.map(tpl => (
                                <div
                                    key={tpl.id}
                                    className="component-item"
                                    role="button"
                                    title={`Insert: ${tpl.name}`}
                                    onClick={() => safeOnTemplateInsert(tpl.id)}
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault()
                                            safeOnTemplateInsert(tpl.id)
                                        }
                                    }}
                                >
                                    <div className="component-icon">📦</div>
                                    <div className="component-name">{tpl.name}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="panel-footer">
                <small>Drag components to canvas</small>
            </div>
        </div>
    )
}

export default ComponentsPanel
