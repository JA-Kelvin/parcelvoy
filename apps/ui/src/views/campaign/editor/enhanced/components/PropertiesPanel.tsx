// Enhanced Properties Panel for Parcelvoy MJML Editor
import React, { useState, useEffect } from 'react'
import { EditorElement } from '../types'
import './PropertiesPanel.css'
import ImageGalleryModal, { ImageUpload } from '../../../editor/ImageGalleryModal'
import RichTextEditor from './RichTextEditor'

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
    const [showImageModal, setShowImageModal] = useState(false)
    const [imageAttrKey, setImageAttrKey] = useState<string | null>(null)

    const openImagePicker = (key: string) => {
        setImageAttrKey(key)
        setShowImageModal(true)
    }

    const closeImagePicker = () => {
        setShowImageModal(false)
        setImageAttrKey(null)
    }

    const handleImageInsert = (image: ImageUpload) => {
        if (!imageAttrKey || !selectedElement) return
        // Update the chosen attribute (e.g., src or background-url)
        const updatedAttributes: Record<string, any> = { ...selectedElement.attributes }
        updatedAttributes[imageAttrKey] = image.url

        // For image-like tags that support alt, populate alt if not set
        const tag = selectedElement.tagName
        const supportsAlt = imageAttrKey === 'src' && ['mj-image', 'mj-carousel-image', 'mj-social-element'].includes(tag)
        if (supportsAlt) {
            const nextAlt = image.alt || image.name || ''
            if (!updatedAttributes.alt && nextAlt) {
                updatedAttributes.alt = nextAlt
            }
        }

        onElementUpdate(selectedElement.id, updatedAttributes)
        closeImagePicker()
    }

    // Normalize existing mj-image width on selection (strip px, drop %) to avoid confusing HTML output
    useEffect(() => {
        if (!selectedElement || selectedElement.tagName !== 'mj-image') return
        const w = selectedElement.attributes?.width
        if (w == null) return
        const raw = String(w).trim()
        if (/^\d+\s*%$/.test(raw)) {
            const attrs = { ...selectedElement.attributes }
            delete attrs.width
            onElementUpdate(selectedElement.id, attrs)
        } else if (/^\d+\s*px$/i.test(raw)) {
            const px = raw.match(/\d+/)?.[0]
            if (px && px !== w) {
                onElementUpdate(selectedElement.id, { ...selectedElement.attributes, width: px })
            }
        }
    }, [selectedElement?.id])

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
                        ⏴
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

        // mj-image: width must be pixels (HTML width attr is numeric). Ignore % and strip px.
        if (selectedElement.tagName === 'mj-image' && key === 'width') {
            const raw = (value || '').trim()
            if (raw === '') {
                updatedAttributes[key] = undefined
            } else if (/^\d+\s*%$/.test(raw)) {
                // Percent not supported by mj-image width, treat as unset for fluid behavior
                updatedAttributes[key] = undefined
            } else {
                const m = raw.match(/^\s*(\d+)\s*(px)?\s*$/i)
                if (m) {
                    updatedAttributes[key] = m[1] // store numeric pixels
                } else {
                    updatedAttributes[key] = undefined
                }
            }
            onElementUpdate(selectedElement.id, updatedAttributes)
            return
        }

        // mj-button: width supports px or %. Coerce numeric to px; clear invalid.
        if (selectedElement.tagName === 'mj-button' && key === 'width') {
            const raw = (value || '').trim()
            if (raw === '') {
                updatedAttributes[key] = undefined
            } else if (/^\s*\d+\s*%\s*$/i.test(raw)) {
                const m = raw.match(/^(\s*(\d+)\s*)%\s*$/i)
                const percent = m?.[2]
                updatedAttributes[key] = percent ? `${percent}%` : undefined
            } else {
                const m = raw.match(/^\s*(\d+)\s*(px)?\s*$/i)
                const px = m?.[1]
                if (px) {
                    updatedAttributes[key] = `${px}px`
                } else {
                    updatedAttributes[key] = undefined
                }
            }
            onElementUpdate(selectedElement.id, updatedAttributes)
            return
        }

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
                        { key: 'width', label: 'Width', type: 'text', placeholder: '200px or 60%' },
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
                        { key: 'width', label: 'Width (px)', type: 'text', placeholder: '600' },
                        { key: 'height', label: 'Height', type: 'text', placeholder: 'auto' },
                        { key: 'fluid-on-mobile', label: 'Fluid on Mobile', type: 'select', options: ['true', 'false'] },
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

    // Elements that benefit from a rich text editor for content editing
    const richTextSupportedTags = new Set(['mj-text', 'mj-accordion-title', 'mj-accordion-text', 'mj-navbar-link'])
    const useRichEditor = richTextSupportedTags.has(selectedElement.tagName)

    const renderAttributeInput = (attr: any) => {
        const value = selectedElement.attributes[attr.key] || ''
        const isImageAttribute = attr.type === 'url' && (attr.key === 'src' || attr.key === 'background-url')
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
                if (isImageAttribute) {
                    return (
                        <div className="image-input">
                            <div className={`image-thumb${value ? '' : ' empty'}`} aria-label="Image preview">
                                {value
                                    ? (
                                        <img src={value} alt={selectedElement.attributes?.alt || 'Selected image'} />
                                    )
                                    : (
                                        <span className="image-thumb-placeholder">No image</span>
                                    )}
                            </div>
                            <div className="image-controls">
                                <input
                                    type="url"
                                    value={value}
                                    onChange={(e) => handleAttributeChange(attr.key, e.target.value)}
                                    placeholder={attr.placeholder}
                                    className="text-input"
                                    aria-label={`${attr.label} URL`}
                                />
                                <div className="image-actions">
                                    <button
                                        type="button"
                                        className="image-button"
                                        onClick={() => openImagePicker(attr.key)}
                                        aria-label={`Choose ${attr.label}`}>
                                        Choose…
                                    </button>
                                    {value && (
                                        <button
                                            type="button"
                                            className="unlink-button"
                                            onClick={() => handleAttributeChange(attr.key, '')}
                                            aria-label={`Remove ${attr.label}`}>
                                            Unlink
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                }
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
            {
                const inputEl = (
                    <input
                        type="text"
                        value={value}
                        onChange={(e) => handleAttributeChange(attr.key, e.target.value)}
                        placeholder={attr.placeholder}
                        className="text-input"
                    />
                )
                if (selectedElement.tagName === 'mj-image' && attr.key === 'width') {
                    return (
                        <div className="input-group">
                            {inputEl}
                            <div className="help-text">Pixels only (e.g., 600). Leave empty for fluid width; for full-bleed use section “Full Width”.</div>
                        </div>
                    )
                }
                if (selectedElement.tagName === 'mj-button' && attr.key === 'width') {
                    return (
                        <div className="input-group">
                            {inputEl}
                            <div className="help-text">Supports px (e.g., 200px) or % (e.g., 60%). Leave empty for auto.</div>
                        </div>
                    )
                }
                return inputEl
            }
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
                    ⏴
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
                            {useRichEditor
                                ? (
                                    <RichTextEditor
                                        content={selectedElement.content ?? ''}
                                        onSave={(html) => handleContentChange(html)}
                                        onCancel={() => { /* no-op cancel retains prior content */ }}
                                    />
                                )
                                : (
                                    <textarea
                                        value={selectedElement.content ?? ''}
                                        onChange={(e) => handleContentChange(e.target.value)}
                                        placeholder="Enter content..."
                                        className="content-textarea"
                                        rows={6}
                                    />
                                )
                            }
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
            <ImageGalleryModal
                open={showImageModal}
                onClose={closeImagePicker}
                onInsert={handleImageInsert}
            />
        </div>
    )
}

export default PropertiesPanel
