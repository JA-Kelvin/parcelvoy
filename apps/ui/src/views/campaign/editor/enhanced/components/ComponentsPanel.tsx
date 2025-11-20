// Enhanced Components Panel for Parcelvoy MJML Editor
import React from 'react'
import { useDrag } from 'react-dnd'
import { ComponentDefinition, TemplateBlock } from '../types'
import './ComponentsPanel.css'
import { CUSTOM_TEMPLATES } from '../templates/customTemplates'
import { editorElementsToMjmlString, mjmlToHtml } from '../utils/mjmlParser'

interface ComponentsPanelProps {
    onComponentDrag: (component: ComponentDefinition) => void
    onTemplateInsert?: (templateId: string, insertionMode?: 'append' | 'above' | 'below') => void
    onOpenCustomTemplates?: () => void
    isCollapsed?: boolean
    onToggleCollapse?: () => void
    customTemplates?: TemplateBlock[]
    savedTemplates?: TemplateBlock[]
    presetTemplates?: TemplateBlock[]
    onSwitchToLayers?: () => void
    onToggleRightPanel?: () => void
    rightPanelCollapsed?: boolean
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
            padding: '20px 0',
        },
        allowedChildren: ['mj-column', 'mj-group'],
    },
    {
        type: 'enhanced-section',
        tagName: 'enhanced-section',
        displayName: 'Enhanced Section',
        category: 'layout',
        icon: '✨',
        defaultAttributes: {
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
            padding: '10px 25px',
        },
        allowedChildren: ['mj-text', 'mj-image', 'mj-button', 'mj-divider', 'mj-spacer', 'mj-social', 'mj-raw', 'mj-navbar', 'mj-table', 'mj-accordion', 'mj-carousel'],
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
    {
        type: 'mj-wrapper',
        tagName: 'mj-wrapper',
        displayName: 'Wrapper',
        category: 'layout',
        icon: '🧳',
        defaultAttributes: {
            padding: '0',
        },
        allowedChildren: ['mj-section', 'enhanced-section'],
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
    {
        type: 'mj-navbar-link',
        tagName: 'mj-navbar-link',
        displayName: 'Navbar Link',
        category: 'content',
        icon: '🔗',
        defaultAttributes: {
            href: '#',
            target: '_blank',
            color: '#111827',
            padding: '10px 15px',
        },
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
            padding: '0px 0px',
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
            'background-url': 'https://placehold.co/1200x400?text=Hero',
            height: '300px',
            'background-width': '600px',
            'background-height': '300px',
        },
        allowedChildren: ['mj-text', 'mj-button', 'mj-image', 'mj-spacer'],
    },

    // Carousel Components
    {
        type: 'mj-carousel',
        tagName: 'mj-carousel',
        displayName: 'Carousel',
        category: 'media',
        icon: '🎠',
        defaultAttributes: {
            align: 'center',
        },
        allowedChildren: ['mj-carousel-image'],
    },
    {
        type: 'mj-carousel-image',
        tagName: 'mj-carousel-image',
        displayName: 'Carousel Image',
        category: 'media',
        icon: '🖼️',
        defaultAttributes: {
            src: 'https://placehold.co/300x200',
            alt: 'Carousel image',
        },
        isVoid: true,
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
            'icon-size': '24px',
            'icon-padding': '50px',
            align: 'center',
        },
        allowedChildren: ['mj-social-element'],
    },
    {
        type: 'mj-social-element',
        tagName: 'mj-social-element',
        displayName: 'Social Item',
        category: 'social',
        icon: '🔗',
        defaultAttributes: {
            name: 'facebook',
            href: 'https://facebook.com/',
            src: 'https://placehold.co/24x24',
            target: '_blank',
            'background-color': 'transparent',
            color: '#111827',
        },
        // Can only be dropped inside mj-social per Droppable rules
    },

    // Accordion Components
    {
        type: 'mj-accordion',
        tagName: 'mj-accordion',
        displayName: 'Accordion',
        category: 'content',
        icon: '🗂️',
        defaultAttributes: {
            border: 'none',
            padding: '1px',
        },
        allowedChildren: ['mj-accordion-element'],
    },
    {
        type: 'mj-accordion-element',
        tagName: 'mj-accordion-element',
        displayName: 'Accordion Item',
        category: 'content',
        icon: '📑',
        defaultAttributes: {
            'icon-wrapped-url': 'https://i.imgur.com/Xvw0vjq.png',
            'icon-unwrapped-url': 'https://i.imgur.com/KKHenWa.png',
            'icon-height': '24px',
            'icon-width': '24px',
        },
        allowedChildren: ['mj-accordion-title', 'mj-accordion-text'],
    },
    {
        type: 'mj-accordion-title',
        tagName: 'mj-accordion-title',
        displayName: 'Accordion Title',
        category: 'content',
        icon: '🔼',
        defaultAttributes: {
            'background-color': '#ffffff',
            color: '#031017',
            padding: '15px',
            'font-size': '18px',
            'font-family': 'Arial, sans-serif',
        },
    },
    {
        type: 'mj-accordion-text',
        tagName: 'mj-accordion-text',
        displayName: 'Accordion Text',
        category: 'content',
        icon: '🔽',
        defaultAttributes: {
            'background-color': '#fafafa',
            color: '#505050',
            padding: '15px',
            'font-size': '14px',
            'font-family': 'Arial, sans-serif',
        },
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
            padding: '10px 0',
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
            height: '24px',
        },
        isVoid: true,
    },
    {
        type: 'mj-table',
        tagName: 'mj-table',
        displayName: 'Table',
        category: 'content',
        icon: '📊',
        defaultAttributes: {
            align: 'left',
            width: '100%',
            cellpadding: '0',
            cellspacing: '0',
        },
    },
    {
        type: 'mj-raw',
        tagName: 'mj-raw',
        displayName: 'Raw HTML',
        category: 'content',
        icon: '🔧',
        defaultAttributes: {},
    },
]

// Remove Not often used components
const notOftenUsedComponents = [
    'enhanced-section',
    'mj-group', 'mj-wrapper',
    'mj-carousel', 'mj-carousel-image',
    'mj-accordion', 'mj-accordion-element', 'mj-accordion-title', 'mj-accordion-text',
]

const FILTERED_MJML_COMPONENTS = MJML_COMPONENTS.filter(component =>
    !notOftenUsedComponents.includes(component.type),
)

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

// Draggable Template Item using react-dnd (type 'template')
interface DraggableTemplateProps {
    block: TemplateBlock
    insertionMode?: 'append' | 'above' | 'below'
    onInsert?: (block: TemplateBlock, insertionMode?: 'append' | 'above' | 'below') => void
}

const DraggableTemplate: React.FC<DraggableTemplateProps> = ({ block, insertionMode, onInsert }) => {
    const [{ isDragging }, drag] = useDrag<{ type: 'template', block: TemplateBlock, insertionMode?: 'append' | 'above' | 'below' }, unknown, { isDragging: boolean }>({
        type: 'template',
        item: { type: 'template', block, insertionMode },
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
    })

    // Inline preview (scaled iframe) similar to PreviewImage
    const [html, setHtml] = React.useState<string>('')
    const [loaded, setLoaded] = React.useState<boolean>(false)
    // Wider preview to better convey template details
    const width = 360 // tile preview width (px)
    const height = 240 // tile preview height (px)
    const iframeWidth = 600
    const iframeHeight = height * (iframeWidth / width)

    React.useEffect(() => {
        let active = true
        const gen = async () => {
            try {
                const mjml = editorElementsToMjmlString(block.elements || [])
                const htmlOut = await mjmlToHtml(mjml)
                if (active) {
                    setHtml(htmlOut)
                    if (htmlOut && htmlOut.trim().length > 0) setLoaded(true)
                }
            } catch {
                if (active) setHtml('')
            }
        }
        void gen()
        return () => { active = false }
    }, [block])

    return (
        <div
            ref={drag}
            className={`component-item template ${isDragging ? 'dragging' : ''}`}
            title={block.description ? `${block.name} — ${block.description}` : block.name}
            style={{ opacity: isDragging ? 0.5 : 1, cursor: 'pointer' }}
            role="button"
            tabIndex={0}
            onClick={() => onInsert?.(block, insertionMode)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onInsert?.(block, insertionMode)
                }
            }}
        >
            <div className="template-drag-handle" aria-hidden="true" />
            <div className="template-preview" style={{ width, height }}>
                <iframe
                    frameBorder="0"
                    scrolling="no"
                    srcDoc={html}
                    sandbox="allow-scripts allow-same-origin"
                    width={iframeWidth}
                    height={iframeHeight}
                    style={{
                        transform: `scale(${width / iframeWidth})`,
                        transformOrigin: 'top left',
                        display: loaded ? 'block' : 'none',
                        pointerEvents: 'none',
                    }}
                    onLoad={() => setLoaded((html ?? '').trim().length > 0)}
                />
                {!loaded && (
                    <div className="component-icon">📦</div>
                )}
            </div>
            <div className="template-footer">
                <div className="component-name">{block.name}</div>
            </div>
        </div>
    )
}

const ComponentsPanel: React.FC<ComponentsPanelProps> = ({
    onComponentDrag,
    onTemplateInsert: _onTemplateInsert,
    onOpenCustomTemplates,
    isCollapsed = false,
    onToggleCollapse,
    customTemplates,
    savedTemplates,
    presetTemplates,
    onSwitchToLayers,
    onToggleRightPanel,
    rightPanelCollapsed = false,
}) => {
    // Safety check for callback function
    const safeOnComponentDrag = onComponentDrag || (() => {})
    const safeOnOpenCustomTemplates = onOpenCustomTemplates ?? (() => {})
    const safeOnTemplateInsert = _onTemplateInsert ?? ((_id, _insertionMode) => {})
    const safeOnSwitchToLayers = onSwitchToLayers ?? (() => {})
    const safeOnToggleRightPanel = onToggleRightPanel ?? (() => {})
    // Separate preset vs saved templates (fallbacks for backward compatibility)
    const presetBlocks = (presetTemplates && presetTemplates.length > 0) ? presetTemplates : CUSTOM_TEMPLATES
    const savedBlocks = (savedTemplates && savedTemplates.length > 0)
        ? savedTemplates
        : ((customTemplates && customTemplates.length > 0) ? customTemplates : [])

    const [activeTab, setActiveTab] = React.useState<'components' | 'presets' | 'saved'>('components')
    // Default insertion mode for templates
    const insertionMode: 'append' | 'above' | 'below' = 'below'

    const categories = ['layout', 'content', 'media', 'social'] as const
    const getComponentsByCategory = (category: string) => {
        return FILTERED_MJML_COMPONENTS.filter(comp => comp.category === category)
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
            <div>
                {/* Sub-tabs: Components | Presets | Saved */}
                <div className="subtabs">
                    <button
                        className={`subtab-button ${activeTab === 'components' ? 'active' : ''}`}
                        onClick={() => setActiveTab('components')}
                        title="MJML Components"
                    >
                        Components
                    </button>
                    <button
                        className={`subtab-button ${activeTab === 'presets' ? 'active' : ''}`}
                        onClick={() => setActiveTab('presets')}
                        title="Preset Templates"
                    >
                        Presets
                    </button>
                    <button
                        className={`subtab-button ${activeTab === 'saved' ? 'active' : ''}`}
                        onClick={() => setActiveTab('saved')}
                        title="Saved Templates"
                    >
                        Saved
                    </button>
                </div>
            </div>

            <div className="panel-content">
                {/* Components Tab */}
                {activeTab === 'components' && (
                    <>
                        <div className="panel-header">
                            <h3></h3>
                            <button
                                className="toggle-button"
                                onClick={safeOnSwitchToLayers}
                                title="Show Layers Panel"
                            >
                                📂
                            </button>
                            {/* Mobile Right Panel Toggle Button */}
                            <button
                                className="toggle-button mobile-right-panel-toggle"
                                onClick={safeOnToggleRightPanel}
                                title={rightPanelCollapsed ? 'Show Right Panel' : 'Hide Right Panel'}
                                aria-label={rightPanelCollapsed ? 'Show Right Panel' : 'Hide Right Panel'}
                            >
                                {rightPanelCollapsed ? '👁️' : '✖️'}
                            </button>
                        </div>
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
                    </>
                )}

                {/* Preset Templates Tab */}
                {activeTab === 'presets' && (
                    <div className="component-category">
                        <h4 className="category-title">Preset Templates</h4>
                        {/* Insertion mode buttons removed. Default behavior: insert 'below' on drop/click. */}
                        <div className="component-grid templates-grid">
                            {presetBlocks.map(block => (
                                <DraggableTemplate key={block.id} block={block} insertionMode={insertionMode} onInsert={(b) => safeOnTemplateInsert(b.id, insertionMode)} />
                            ))}
                        </div>
                    </div>
                )}

                {/* Saved Templates Tab */}
                {activeTab === 'saved' && (
                    <div className="component-category">
                        <h4 className="category-title">Saved Templates</h4>
                        {savedBlocks.length > 0
                            ? (
                                <div className="component-grid templates-grid">
                                    <div
                                        className="component-item custom"
                                        role="button"
                                        title={`Open Custom Templates (${savedBlocks.length})`}
                                        onClick={safeOnOpenCustomTemplates}
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault()
                                                safeOnOpenCustomTemplates()
                                            }
                                        }}
                                    >
                                        <div className="component-icon">🧩</div>
                                        <div className="component-name">Open Custom Templates</div>
                                    </div>
                                    {savedBlocks.map(block => (
                                        <DraggableTemplate key={block.id} block={block} insertionMode={insertionMode} onInsert={(b) => safeOnTemplateInsert(b.id, insertionMode)} />
                                    ))}
                                </div>
                            )
                            : (
                                <>
                                    <div className="empty-state">No saved templates yet.</div>
                                    <div className="component-grid">
                                        <div
                                            className="component-item custom"
                                            role="button"
                                            title="Open Custom Templates"
                                            onClick={safeOnOpenCustomTemplates}
                                            tabIndex={0}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault()
                                                    safeOnOpenCustomTemplates()
                                                }
                                            }}
                                        >
                                            <div className="component-icon">🧩</div>
                                            <div className="component-name">Open Custom Templates</div>
                                        </div>
                                    </div>
                                </>
                            )}
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
