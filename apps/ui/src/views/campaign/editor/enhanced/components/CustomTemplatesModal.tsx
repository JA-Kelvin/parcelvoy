// Custom Templates Modal for Enhanced MJML Editor
import React, { useEffect, useMemo, useState } from 'react'
import { TemplateBlock, EditorElement } from '../types'
import { editorElementsToMjmlString, mjmlToHtml } from '../utils/mjmlParser'
import './CustomTemplatesModal.css'

interface CustomTemplatesModalProps {
    isOpen: boolean
    onClose: () => void
    templates: TemplateBlock[]
    onConfirm: (template: TemplateBlock) => void
    onDelete?: (id: string) => void
    deletableIds?: string[]
}

const CustomTemplatesModal: React.FC<CustomTemplatesModalProps> = ({
    isOpen,
    onClose,
    templates,
    onConfirm,
    onDelete,
    deletableIds = [],
}) => {
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [htmlPreview, setHtmlPreview] = useState<string>('')
    const [isLoading, setIsLoading] = useState<boolean>(false)
    const [error, setError] = useState<string | null>(null)

    const selectedTemplate = useMemo(() => templates.find(t => t.id === selectedId) ?? null, [templates, selectedId])
    const deletableSet = useMemo(() => new Set(deletableIds), [deletableIds])

    // Default select first template when opened
    useEffect(() => {
        if (isOpen) {
            setError(null)
            setIsLoading(false)
            setHtmlPreview('')
            if (templates.length > 0) setSelectedId(templates[0].id)
        } else {
            setSelectedId(null)
        }
    }, [isOpen, templates])

    // Generate lightweight visual preview (HTML) when selection changes
    useEffect(() => {
        const gen = async () => {
            if (!selectedTemplate) {
                setHtmlPreview('')
                return
            }
            setIsLoading(true)
            setError(null)
            try {
                const elements: EditorElement[] = selectedTemplate.elements || []
                const mjml = editorElementsToMjmlString(elements)
                const html = await mjmlToHtml(mjml)
                setHtmlPreview(html)
            } catch (e) {
                console.error('Preview generation failed:', e)
                setError('Failed to generate preview')
            } finally {
                setIsLoading(false)
            }
        }
        void gen()
    }, [selectedTemplate])

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') onClose()
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && selectedTemplate) {
            e.preventDefault()
            onConfirm(selectedTemplate)
        }
    }

    if (!isOpen) return null

    return (
        <div className="custom-templates-modal-overlay" onClick={onClose} onKeyDown={handleKeyDown} tabIndex={-1}>
            <div className="custom-templates-modal" onClick={(e) => e.stopPropagation()}>
                <div className="ctm-header">
                    <div className="ctm-title">
                        <h2>🧩 Custom Templates</h2>
                        <p>Select a template to preview and insert into your email</p>
                    </div>
                    <button className="ctm-close" onClick={onClose} title="Close">
                        ✕
                    </button>
                </div>

                <div className="ctm-content">
                    <div className="ctm-list">
                        <div className="ctm-list-header">
                            <span>Templates</span>
                            <span className="ctm-count">{templates.length}</span>
                        </div>
                        <div className="ctm-items">
                            {templates.map(tpl => (
                                <div
                                    key={tpl.id}
                                    className={`ctm-item ${tpl.id === selectedId ? 'active' : ''}`}
                                    onClick={() => setSelectedId(tpl.id)}
                                    title={tpl.description ?? tpl.name}
                                >
                                    <span className="ctm-item-icon">📦</span>
                                    <span className="ctm-item-info">
                                        <span className="ctm-item-name">{tpl.name}</span>
                                        {tpl.description && (
                                            <span className="ctm-item-desc">{tpl.description}</span>
                                        )}
                                    </span>
                                    {onDelete && deletableSet.has(tpl.id) && (
                                        <button
                                            className="ctm-item-delete"
                                            title="Delete this template"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                const confirmed = window.confirm(`Delete '${tpl.name}'? This cannot be undone.`)
                                                if (confirmed) onDelete(tpl.id)
                                            }}
                                        >
                                            🗑️
                                        </button>
                                    )}
                                </div>
                            ))}
                            {templates.length === 0 && (
                                <div className="ctm-empty">No custom templates available</div>
                            )}
                        </div>
                    </div>

                    <div className="ctm-preview">
                        {!selectedTemplate && <div className="ctm-placeholder">Select a template to preview</div>}
                        {selectedTemplate && (
                            <div className="ctm-preview-inner">
                                <div className="ctm-preview-header">
                                    <div className="ctm-preview-title">
                                        <strong>{selectedTemplate.name}</strong>
                                        {selectedTemplate.description && (
                                            <span className="ctm-preview-sub">{selectedTemplate.description}</span>
                                        )}
                                    </div>
                                    <div className="ctm-preview-actions">
                                        {isLoading && <span className="ctm-loading">Generating preview…</span>}
                                        {error && <span className="ctm-error">{error}</span>}
                                    </div>
                                </div>
                                <div className="ctm-preview-canvas">
                                    {/* Render generated HTML */}
                                    <div
                                        className="ctm-preview-frame"
                                        dangerouslySetInnerHTML={{ __html: htmlPreview }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="ctm-footer">
                    <div className="ctm-actions">
                        <button
                            onClick={() => selectedTemplate && onConfirm(selectedTemplate)}
                            className="primary-button"
                            disabled={!selectedTemplate}
                        >
                            Insert Template
                        </button>
                        <button onClick={onClose} className="secondary-button">Cancel</button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CustomTemplatesModal
