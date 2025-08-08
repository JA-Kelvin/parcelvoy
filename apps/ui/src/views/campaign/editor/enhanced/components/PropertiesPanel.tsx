// Enhanced Properties Panel for Parcelvoy MJML Editor
import React, { useState } from 'react'
import { EditorElement } from '../types'
import './PropertiesPanel.css'

interface PropertiesPanelProps {
    selectedElement: EditorElement | null
    onElementUpdate: (elementId: string, attributes: Record<string, any>, content?: string) => void
    isCollapsed?: boolean
    onToggleCollapse?: () => void
}

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
    selectedElement,
    onElementUpdate,
    isCollapsed = false,
    onToggleCollapse,
}) => {
    const [activeTab, setActiveTab] = useState<'attributes' | 'content' | 'style'>('attributes')

    if (isCollapsed) {
        return (
            <div className="properties-panel collapsed">
                <button
                    className="toggle-button"
                    onClick={onToggleCollapse}
                    title="Expand Properties Panel"
                >
                    ⚙️
                </button>
            </div>
        )
    }

    if (!selectedElement) {
        return (
            <div className="properties-panel">
                <div className="panel-header">
                    <h3>Properties</h3>
                    <button
                        className="toggle-button"
                        onClick={onToggleCollapse}
                        title="Collapse Properties Panel"
                    >
                    </button>
                </div>
                <div className="panel-content">
                    <div className="no-selection">
                        <div className="no-selection-icon">🎯</div>
                        <p>Select an element to edit its properties</p>
                    </div>
                </div>
            </div>
        )
    }

    const handleAttributeChange = (key: string, value: string) => {
        const updatedAttributes = { ...selectedElement.attributes }
        if (value === '') {
            updatedAttributes[key] = undefined
        } else {
            updatedAttributes[key] = value
        }
        onElementUpdate(selectedElement.id, updatedAttributes)
    }

    const handleContentChange = (content: string) => {
        onElementUpdate(selectedElement.id, selectedElement.attributes, content)
    }

    const getElementProperties = () => {
        const { tagName } = selectedElement
        switch (tagName) {
            case 'mj-text':
                return {
                    attributes: [
                        { key: 'color', label: 'Text Color', type: 'color' },
                        { key: 'font-size', label: 'Font Size', type: 'text', placeholder: '16px' },
                        { key: 'font-family', label: 'Font Family', type: 'select', options: ['Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Verdana'] },
                        { key: 'font-weight', label: 'Font Weight', type: 'select', options: ['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900'] },
                        { key: 'text-align', label: 'Text Align', type: 'select', options: ['left', 'center', 'right', 'justify'] },
                        { key: 'line-height', label: 'Line Height', type: 'text', placeholder: '1.5' },
                        { key: 'padding', label: 'Padding', type: 'text', placeholder: '10px' },
                        { key: 'margin', label: 'Margin', type: 'text', placeholder: '0px' },
                    ],
                    hasContent: true,
                }
            case 'mj-button':
                return {
                    attributes: [
                        { key: 'background-color', label: 'Background Color', type: 'color' },
                        { key: 'color', label: 'Text Color', type: 'color' },
                        { key: 'font-size', label: 'Font Size', type: 'text', placeholder: '16px' },
                        { key: 'font-weight', label: 'Font Weight', type: 'select', options: ['normal', 'bold'] },
                        { key: 'border-radius', label: 'Border Radius', type: 'text', placeholder: '4px' },
                        { key: 'padding', label: 'Padding', type: 'text', placeholder: '12px 24px' },
                        { key: 'href', label: 'Link URL', type: 'url', placeholder: 'https://example.com' },
                        { key: 'target', label: 'Link Target', type: 'select', options: ['_self', '_blank'] },
                    ],
                    hasContent: true,
                }
            case 'mj-image':
                return {
                    attributes: [
                        { key: 'src', label: 'Image URL', type: 'url', placeholder: 'https://example.com/image.jpg' },
                        { key: 'alt', label: 'Alt Text', type: 'text', placeholder: 'Image description' },
                        { key: 'width', label: 'Width', type: 'text', placeholder: '100%' },
                        { key: 'height', label: 'Height', type: 'text', placeholder: 'auto' },
                        { key: 'align', label: 'Alignment', type: 'select', options: ['left', 'center', 'right'] },
                        { key: 'href', label: 'Link URL', type: 'url', placeholder: 'https://example.com' },
                        { key: 'target', label: 'Link Target', type: 'select', options: ['_self', '_blank'] },
                    ],
                    hasContent: false,
                }
            case 'mj-section':
                return {
                    attributes: [
                        { key: 'background-color', label: 'Background Color', type: 'color' },
                        { key: 'background-url', label: 'Background Image', type: 'url', placeholder: 'https://example.com/bg.jpg' },
                        { key: 'background-repeat', label: 'Background Repeat', type: 'select', options: ['no-repeat', 'repeat', 'repeat-x', 'repeat-y'] },
                        { key: 'background-size', label: 'Background Size', type: 'select', options: ['cover', 'contain', 'auto'] },
                        { key: 'background-position', label: 'Background Position', type: 'text', placeholder: 'center' },
                        { key: 'padding', label: 'Padding', type: 'text', placeholder: '20px 0' },
                        { key: 'text-align', label: 'Text Align', type: 'select', options: ['left', 'center', 'right'] },
                        { key: 'full-width', label: 'Full Width', type: 'select', options: ['full-width', ''] },
                    ],
                    hasContent: false,
                }
            case 'mj-hero':
                return {
                    attributes: [
                        { key: 'background-color', label: 'Background Color', type: 'color' },
                        { key: 'background-url', label: 'Background Image', type: 'url', placeholder: 'https://example.com/hero.jpg' },
                        { key: 'background-repeat', label: 'Background Repeat', type: 'select', options: ['no-repeat', 'repeat', 'repeat-x', 'repeat-y'] },
                        { key: 'background-size', label: 'Background Size', type: 'select', options: ['cover', 'contain', 'auto'] },
                        { key: 'background-position', label: 'Background Position', type: 'text', placeholder: 'center' },
                        { key: 'background-width', label: 'Background Width', type: 'text', placeholder: '600px' },
                        { key: 'background-height', label: 'Background Height', type: 'text', placeholder: '300px' },
                        { key: 'height', label: 'Height', type: 'text', placeholder: '300px' },
                        { key: 'padding', label: 'Padding', type: 'text', placeholder: '40px 0' },
                        { key: 'text-align', label: 'Text Align', type: 'select', options: ['left', 'center', 'right'] },
                        { key: 'mode', label: 'Mode', type: 'select', options: ['fluid-height', 'fixed-height'] },
                    ],
                    hasContent: false,
                }
            case 'mj-column':
                return {
                    attributes: [
                        { key: 'width', label: 'Width', type: 'text', placeholder: '100%' },
                        { key: 'background-color', label: 'Background Color', type: 'color' },
                        { key: 'padding', label: 'Padding', type: 'text', placeholder: '10px' },
                        { key: 'border', label: 'Border', type: 'text', placeholder: '1px solid #ccc' },
                        { key: 'border-radius', label: 'Border Radius', type: 'text', placeholder: '4px' },
                    ],
                    hasContent: false,
                }
            case 'mj-social':
                return {
                    attributes: [
                        { key: 'mode', label: 'Mode', type: 'select', options: ['horizontal', 'vertical'] },
                        { key: 'align', label: 'Alignment', type: 'select', options: ['left', 'center', 'right'] },
                        { key: 'icon-size', label: 'Icon Size', type: 'text', placeholder: '20px' },
                        { key: 'icon-padding', label: 'Icon Padding', type: 'text', placeholder: '4px' },
                        { key: 'padding', label: 'Padding', type: 'text', placeholder: '10px 0' },
                    ],
                    hasContent: false,
                }
            case 'mj-social-element':
                return {
                    attributes: [
                        { key: 'name', label: 'Network', type: 'select', options: ['facebook', 'twitter', 'instagram', 'linkedin', 'youtube', 'pinterest', 'github', 'web'] },
                        { key: 'href', label: 'Link URL', type: 'url', placeholder: 'https://example.com' },
                        { key: 'src', label: 'Custom Icon URL', type: 'url', placeholder: 'https://example.com/icon.png' },
                        { key: 'alt', label: 'Alt Text', type: 'text', placeholder: 'Follow us' },
                        { key: 'background-color', label: 'Background Color', type: 'color' },
                        { key: 'color', label: 'Icon/Text Color', type: 'color' },
                        { key: 'icon-size', label: 'Icon Size', type: 'text', placeholder: '24px' },
                        { key: 'target', label: 'Link Target', type: 'select', options: ['_self', '_blank'] },
                    ],
                    hasContent: false,
                }
            case 'mj-divider':
                return {
                    attributes: [
                        { key: 'border-color', label: 'Border Color', type: 'color' },
                        { key: 'border-width', label: 'Border Width', type: 'text', placeholder: '1px' },
                        { key: 'border-style', label: 'Border Style', type: 'select', options: ['solid', 'dashed', 'dotted'] },
                        { key: 'width', label: 'Width', type: 'text', placeholder: '100%' },
                        { key: 'padding', label: 'Padding', type: 'text', placeholder: '10px 0' },
                    ],
                    hasContent: false,
                }
            case 'mj-spacer':
                return {
                    attributes: [
                        { key: 'height', label: 'Height', type: 'text', placeholder: '20px' },
                    ],
                    hasContent: false,
                }
            case 'mj-wrapper':
                return {
                    attributes: [
                        { key: 'background-color', label: 'Background Color', type: 'color' },
                        { key: 'background-url', label: 'Background Image', type: 'url', placeholder: 'https://example.com/bg.jpg' },
                        { key: 'background-repeat', label: 'Background Repeat', type: 'select', options: ['no-repeat', 'repeat', 'repeat-x', 'repeat-y'] },
                        { key: 'background-size', label: 'Background Size', type: 'select', options: ['cover', 'contain', 'auto'] },
                        { key: 'background-position', label: 'Background Position', type: 'text', placeholder: 'center' },
                        { key: 'padding', label: 'Padding', type: 'text', placeholder: '20px 0' },
                    ],
                    hasContent: false,
                }
            case 'mj-navbar':
                return {
                    attributes: [
                        { key: 'align', label: 'Alignment', type: 'select', options: ['left', 'center', 'right'] },
                        { key: 'padding', label: 'Padding', type: 'text', placeholder: '10px 0' },
                    ],
                    hasContent: false,
                }
            case 'mj-navbar-link':
                return {
                    attributes: [
                        { key: 'href', label: 'Link URL', type: 'url', placeholder: 'https://example.com' },
                        { key: 'target', label: 'Link Target', type: 'select', options: ['_self', '_blank'] },
                        { key: 'color', label: 'Text Color', type: 'color' },
                        { key: 'padding', label: 'Padding', type: 'text', placeholder: '10px 15px' },
                        { key: 'font-size', label: 'Font Size', type: 'text', placeholder: '14px' },
                        { key: 'font-family', label: 'Font Family', type: 'select', options: ['Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Verdana'] },
                    ],
                    hasContent: true,
                }
            case 'mj-table':
                return {
                    attributes: [
                        { key: 'align', label: 'Alignment', type: 'select', options: ['left', 'center', 'right'] },
                        { key: 'width', label: 'Width', type: 'text', placeholder: '100%' },
                        { key: 'cellpadding', label: 'Cell Padding', type: 'text', placeholder: '0' },
                        { key: 'cellspacing', label: 'Cell Spacing', type: 'text', placeholder: '0' },
                    ],
                    hasContent: true,
                }
            case 'mj-accordion':
                return {
                    attributes: [
                        { key: 'border', label: 'Border', type: 'text', placeholder: 'none' },
                        { key: 'padding', label: 'Padding', type: 'text', placeholder: '1px' },
                    ],
                    hasContent: false,
                }
            case 'mj-accordion-element':
                return {
                    attributes: [
                        { key: 'icon-wrapped-url', label: 'Icon Wrapped URL', type: 'url', placeholder: 'https://...' },
                        { key: 'icon-unwrapped-url', label: 'Icon Unwrapped URL', type: 'url', placeholder: 'https://...' },
                        { key: 'icon-height', label: 'Icon Height', type: 'text', placeholder: '24px' },
                        { key: 'icon-width', label: 'Icon Width', type: 'text', placeholder: '24px' },
                    ],
                    hasContent: false,
                }
            case 'mj-accordion-title':
                return {
                    attributes: [
                        { key: 'background-color', label: 'Background Color', type: 'color' },
                        { key: 'color', label: 'Text Color', type: 'color' },
                        { key: 'padding', label: 'Padding', type: 'text', placeholder: '15px' },
                        { key: 'font-size', label: 'Font Size', type: 'text', placeholder: '18px' },
                        { key: 'font-family', label: 'Font Family', type: 'select', options: ['Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Verdana'] },
                    ],
                    hasContent: true,
                }
            case 'mj-accordion-text':
                return {
                    attributes: [
                        { key: 'background-color', label: 'Background Color', type: 'color' },
                        { key: 'color', label: 'Text Color', type: 'color' },
                        { key: 'padding', label: 'Padding', type: 'text', placeholder: '15px' },
                        { key: 'font-size', label: 'Font Size', type: 'text', placeholder: '14px' },
                        { key: 'font-family', label: 'Font Family', type: 'select', options: ['Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Verdana'] },
                    ],
                    hasContent: true,
                }
            case 'mj-carousel':
                return {
                    attributes: [
                        { key: 'align', label: 'Alignment', type: 'select', options: ['left', 'center', 'right'] },
                    ],
                    hasContent: false,
                }
            case 'mj-carousel-image':
                return {
                    attributes: [
                        { key: 'src', label: 'Image URL', type: 'url', placeholder: 'https://example.com/image.jpg' },
                        { key: 'alt', label: 'Alt Text', type: 'text', placeholder: 'Image description' },
                        { key: 'href', label: 'Link URL', type: 'url', placeholder: 'https://example.com' },
                        { key: 'target', label: 'Link Target', type: 'select', options: ['_self', '_blank'] },
                    ],
                    hasContent: false,
                }
            case 'mj-raw':
                return {
                    attributes: [
                    ],
                    hasContent: true,
                }
            default:
                return {
                    attributes: [
                        { key: 'padding', label: 'Padding', type: 'text', placeholder: '10px' },
                        { key: 'margin', label: 'Margin', type: 'text', placeholder: '0px' },
                    ],
                    hasContent: false,
                }
        }
    }

    const properties = getElementProperties()

    const renderAttributeInput = (attr: any) => {
        const value = selectedElement.attributes[attr.key] || ''
        switch (attr.type) {
            case 'color':
                return (
                    <div className="input-group">
                        <input
                            type="color"
                            value={value || '#000000'}
                            onChange={(e) => handleAttributeChange(attr.key, e.target.value)}
                            className="color-input"
                        />
                        <input
                            type="text"
                            value={value}
                            onChange={(e) => handleAttributeChange(attr.key, e.target.value)}
                            placeholder={attr.placeholder}
                            className="text-input"
                        />
                    </div>
                )
            case 'select':
                return (
                    <select
                        value={value}
                        onChange={(e) => handleAttributeChange(attr.key, e.target.value)}
                        className="select-input"
                    >
                        <option value="">Default</option>
                        {attr.options.map((option: string) => (
                            <option key={option} value={option}>{option}</option>
                        ))}
                    </select>
                )
            case 'url':
                return (
                    <input
                        type="url"
                        value={value}
                        onChange={(e) => handleAttributeChange(attr.key, e.target.value)}
                        placeholder={attr.placeholder}
                        className="text-input"
                    />
                )

            default:
                return (
                    <input
                        type="text"
                        value={value}
                        onChange={(e) => handleAttributeChange(attr.key, e.target.value)}
                        placeholder={attr.placeholder}
                        className="text-input"
                    />
                )
        }
    }

    return (
        <div className="properties-panel">
            <div className="panel-header">
                <h3>Properties</h3>
                <button
                    className="toggle-button"
                    onClick={onToggleCollapse}
                    title="Collapse Properties Panel"
                >
                </button>
            </div>

            <div className="element-info">
                <div className="element-type">{selectedElement.tagName}</div>
                <div className="element-id">ID: {selectedElement.id.slice(-8)}</div>
            </div>

            <div className="tabs">
                <button
                    className={`tab ${activeTab === 'attributes' ? 'active' : ''}`}
                    onClick={() => setActiveTab('attributes')}
                >
                    Attributes
                </button>
                {properties.hasContent && (
                    <button
                        className={`tab ${activeTab === 'content' ? 'active' : ''}`}
                        onClick={() => setActiveTab('content')}
                    >
                        Content
                    </button>
                )}
                <button
                    className={`tab ${activeTab === 'style' ? 'active' : ''}`}
                    onClick={() => setActiveTab('style')}
                >
                    Style
                </button>
            </div>

            <div className="panel-content">
                {activeTab === 'attributes' && (
                    <div className="attributes-section">
                        {properties.attributes.map((attr) => (
                            <div key={attr.key} className="property-group">
                                <label className="property-label">{attr.label}</label>
                                {renderAttributeInput(attr)}
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'content' && properties.hasContent && (
                    <div className="content-section">
                        <div className="property-group">
                            <label className="property-label">Content</label>
                            <textarea
                                value={selectedElement.content ?? ''}
                                onChange={(e) => handleContentChange(e.target.value)}
                                placeholder="Enter content..."
                                className="content-textarea"
                                rows={6}
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'style' && (
                    <div className="style-section">
                        <div className="property-group">
                            <label className="property-label">Custom CSS</label>
                            <textarea
                                value={selectedElement.attributes['css-class'] || ''}
                                onChange={(e) => handleAttributeChange('css-class', e.target.value)}
                                placeholder="Enter CSS class name..."
                                className="css-textarea"
                                rows={3}
                            />
                        </div>
                        <div className="property-group">
                            <label className="property-label">Inline Styles</label>
                            <textarea
                                value={selectedElement.attributes.style || ''}
                                onChange={(e) => handleAttributeChange('style', e.target.value)}
                                placeholder="color: red font-size: 16px"
                                className="css-textarea"
                                rows={4}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default PropertiesPanel
