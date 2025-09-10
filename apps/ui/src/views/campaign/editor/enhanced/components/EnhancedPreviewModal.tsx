// Enhanced Preview Modal Component with Monaco Editor Code View
import React, { useState, useEffect, useRef } from 'react'
import Editor from '@monaco-editor/react'
import { EditorElement } from '../types'
import { editorElementsToMjmlString, mjmlToHtml } from '../utils/mjmlParser'
import './EnhancedPreviewModal.css'

interface EnhancedPreviewModalProps {
    isOpen: boolean
    onClose: () => void
    elements: EditorElement[]
    templateName?: string
    onConfirm?: () => void
    confirmLabel?: string
}

type ViewMode = 'desktop' | 'tablet' | 'mobile'
type PreviewTab = 'visual' | 'mjml' | 'html'

// Custom hook to handle editor mounting and avoid ResizeObserver errors
function useEditorMounting() {
    const [isEditorReady, setIsEditorReady] = useState(false)

    const handleEditorDidMount = () => {
        setIsEditorReady(true)
    }

    const resetEditor = () => {
        setIsEditorReady(false)
    }

    return { isEditorReady, handleEditorDidMount, resetEditor }
}

const EnhancedPreviewModal: React.FC<EnhancedPreviewModalProps> = ({
    isOpen,
    onClose,
    elements,
    templateName = 'Email Template',
    onConfirm,
    confirmLabel = 'Insert',
}) => {
    const [htmlContent, setHtmlContent] = useState<string>('')
    const [mjmlContent, setMjmlContent] = useState<string>('')
    const [isLoading, setIsLoading] = useState(false)
    const [viewMode, setViewMode] = useState<ViewMode>('desktop')
    const [activeTab, setActiveTab] = useState<PreviewTab>('visual')
    const [error, setError] = useState<string | null>(null)
    const [copySuccess, setCopySuccess] = useState<string>('')
    const containerRef = useRef<HTMLDivElement>(null)

    // Use custom hooks for each editor to handle mounting independently
    const mjmlEditor = useEditorMounting()
    const htmlEditor = useEditorMounting()

    useEffect(() => {
        if (isOpen && elements.length > 0) {
            setActiveTab('visual')
            void generatePreview()
        }
    }, [isOpen, elements])

    const handleTabChange = (tab: PreviewTab) => {
        // Reset editors when switching tabs to avoid ResizeObserver conflicts
        mjmlEditor.resetEditor()
        htmlEditor.resetEditor()

        // Small delay before switching tabs to ensure cleanup
        setTimeout(() => {
            setActiveTab(tab)
            setCopySuccess('')
        }, 50)
    }

    const generatePreview = async () => {
        setIsLoading(true)
        setError(null)

        try {
            const mjmlString = editorElementsToMjmlString(elements)
            setMjmlContent(mjmlString)

            const html = await mjmlToHtml(mjmlString)
            setHtmlContent(html)
        } catch (err) {
            console.error('Error generating preview:', err)
            setError('Failed to generate preview. Please check your email template.')
        } finally {
            setIsLoading(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose()
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && onConfirm) {
            e.preventDefault()
            onConfirm()
        }
    }

    const getViewportClass = () => {
        switch (viewMode) {
            case 'tablet':
                return 'preview-tablet'
            case 'mobile':
                return 'preview-mobile'
            default:
                return 'preview-desktop'
        }
    }

    // Ensure HTML in iframe is horizontally centered inside the preview frame (preview-only override)
    const getSrcDocWithCentering = (rawHtml: string): string => {
        if (!rawHtml) return ''

        const centerStyle = '\n<style>\n'
            + '  /* Preview-only: normalize and mirror canvas wrapper (.mjml-body-wrapper) */\n'
            + '  html, body { height: 100%; }\n'
            + '  *, *::before, *::after { box-sizing: border-box; }\n'
            + '  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #111; }\n'
            + '  /* Center common top-level wrappers output by MJML */\n'
            + '  body > div { margin-left: auto !important; margin-right: auto !important; max-width: 660px !important; padding: 0 10px 0 10px; border-radius: 0; }\n'
            + '  body > table { margin-left: auto !important; margin-right: auto !important; }\n'
            + '  body > center > table { margin-left: auto !important; margin-right: auto !important; }\n'
            + '  /* Fallback: also center the first child regardless of tag */\n'
            + '  body > *:first-child { margin-left: auto !important; margin-right: auto !important; }\n'
            + '</style>\n'

        // If document has a <head>, inject styles before </head>
        if (/(<\/head>)/i.test(rawHtml)) {
            return rawHtml.replace(/<\/head>/i, centerStyle + '</head>')
        }

        // If there's a <body>, inject styles right after <body ...>
        if (/(<body[^>]*>)/i.test(rawHtml)) {
            return rawHtml.replace(/<body[^>]*>/i, (m) => m + centerStyle)
        }

        // Fallback: wrap fragment as a full doc
        return '<!doctype html><html><head>' + centerStyle + '</head><body>' + rawHtml + '</body></html>'
    }

    const copyToClipboard = async () => {
        let contentToCopy = ''

        switch (activeTab) {
            case 'mjml':
                contentToCopy = mjmlContent
                break
            case 'html':
                contentToCopy = htmlContent
                break
            default:
                return
        }

        try {
            await navigator.clipboard.writeText(contentToCopy)
            setCopySuccess('Copied!')
            setTimeout(() => setCopySuccess(''), 2000)
        } catch (err) {
            console.error('Failed to copy:', err)
            setCopySuccess('Failed to copy')
            setTimeout(() => setCopySuccess(''), 2000)
        }
    }

    if (!isOpen) return null

    return (
        <div className="enhanced-preview-modal-overlay" onClick={onClose} onKeyDown={handleKeyDown} tabIndex={-1}>
            <div className="enhanced-preview-modal" onClick={(e) => e.stopPropagation()}>
                <div className="enhanced-preview-header">
                    <div className="preview-title">
                        <h2>🔍 Preview: {templateName}</h2>
                    </div>

                    <div className="preview-tabs">
                        <button
                            className={`tab-button ${activeTab === 'visual' ? 'active' : ''}`}
                            onClick={() => handleTabChange('visual')}
                            title="Visual Preview"
                        >
                            🔍 Visual
                        </button>
                        <button
                            className={`tab-button ${activeTab === 'mjml' ? 'active' : ''}`}
                            onClick={() => handleTabChange('mjml')}
                            title="MJML Code"
                        >
                            📝 MJML
                        </button>
                        <button
                            className={`tab-button ${activeTab === 'html' ? 'active' : ''}`}
                            onClick={() => handleTabChange('html')}
                            title="HTML Code"
                        >
                            🌐 HTML
                        </button>
                    </div>

                    <div className="preview-controls">
                        {activeTab === 'visual' && (
                            <div className="viewport-controls">
                                <button
                                    className={`viewport-button ${viewMode === 'desktop' ? 'active' : ''}`}
                                    onClick={() => setViewMode('desktop')}
                                    title="Desktop View"
                                >
                                    🖥️
                                </button>
                                <button
                                    className={`viewport-button ${viewMode === 'tablet' ? 'active' : ''}`}
                                    onClick={() => setViewMode('tablet')}
                                    title="Tablet View"
                                >
                                    📱
                                </button>
                                <button
                                    className={`viewport-button ${viewMode === 'mobile' ? 'active' : ''}`}
                                    onClick={() => setViewMode('mobile')}
                                    title="Mobile View"
                                >
                                    📱
                                </button>
                            </div>
                        )}

                        <div className="action-controls">
                            {(activeTab === 'mjml' || activeTab === 'html') && (
                                <button
                                    className="action-button"
                                    onClick={copyToClipboard}
                                    title="Copy to Clipboard"
                                >
                                    {
                                        copySuccess
                                            ? (
                                                <>✅ {copySuccess}</>
                                            )
                                            : (
                                                <>📋 Copy</>
                                            )
                                    }
                                </button>
                            )}
                            <button
                                className="action-button"
                                onClick={generatePreview}
                                disabled={isLoading}
                                title="Refresh Preview"
                            >
                                🔄 Refresh
                            </button>
                        </div>
                    </div>

                    <button className="close-button" onClick={onClose} title="Close Preview">
                        ✕
                    </button>
                </div>

                <div className="enhanced-preview-content">
                    {isLoading
                        ? (
                            <div className="preview-loading">
                                <div className="loading-spinner"></div>
                                <p>Generating preview...</p>
                            </div>
                        )
                        : error
                            ? (
                                <div className="preview-error">
                                    <div className="error-icon">⚠️</div>
                                    <h3>Preview Error</h3>
                                    <p>{error}</p>
                                    <button onClick={generatePreview} className="retry-button">
                                        Try Again
                                    </button>
                                </div>
                            )
                            : (
                                <>
                                    {activeTab === 'visual' && (
                                        <div className={`preview-viewport ${getViewportClass()}`}>
                                            <div className="preview-frame">
                                                <iframe
                                                    srcDoc={getSrcDocWithCentering(htmlContent)}
                                                    title="Email Preview"
                                                    className="preview-iframe"
                                                    sandbox="allow-scripts allow-same-origin"
                                                />
                                            </div>

                                            <div className="preview-info">
                                                <div className="viewport-info">
                                                    {viewMode === 'desktop' && '🖥️ Desktop (1024px)'}
                                                    {viewMode === 'tablet' && '📱 Tablet (768px)'}
                                                    {viewMode === 'mobile' && '📱 Mobile (375px)'}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                    }

                                    {activeTab === 'mjml' && (
                                        <div className="code-preview-container">
                                            <div className="code-header">
                                                <h4>📝 MJML Source Code</h4>
                                                <div className="code-info">
                                                    Lines: {mjmlContent.split('\n').length} •
                                                    Size: {Math.round(mjmlContent.length / 1024)}KB
                                                </div>
                                                <button
                                                    className="copy-button"
                                                    onClick={copyToClipboard}
                                                    title="Copy to clipboard"
                                                >
                                                    {copySuccess
                                                        ? (
                                                            <>✓ {copySuccess}</>
                                                        )
                                                        : (
                                                            <>📋 Copy</>
                                                        )
                                                    }
                                                </button>
                                            </div>
                                            <div className="editor-container" ref={containerRef}>
                                                {!mjmlEditor.isEditorReady && <div className="editor-loading">Loading editor...</div>}
                                                <div className={`editor-wrapper ${mjmlEditor.isEditorReady ? 'visible' : 'hidden'}`}>
                                                    <Editor
                                                        defaultLanguage="xml"
                                                        value={mjmlContent}
                                                        options={{
                                                            readOnly: true,
                                                            minimap: { enabled: false },
                                                            scrollBeyondLastLine: false,
                                                            wordWrap: 'on',
                                                            fontSize: 14,
                                                            lineNumbers: 'on',
                                                            folding: true,
                                                            theme: 'vs-light',
                                                        }}
                                                        onMount={mjmlEditor.handleEditorDidMount}
                                                        loading={null}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'html' && (
                                        <div className="code-preview-container">
                                            <div className="code-header">
                                                <h4>🌐 HTML Output</h4>
                                                <div className="code-info">
                                                    Lines: {htmlContent.split('\n').length} •
                                                    Size: {Math.round(htmlContent.length / 1024)}KB
                                                </div>
                                                <button
                                                    className="copy-button"
                                                    onClick={copyToClipboard}
                                                    title="Copy to clipboard"
                                                >
                                                    {copySuccess
                                                        ? (
                                                            <>✓ {copySuccess}</>
                                                        )
                                                        : (
                                                            <>📋 Copy</>
                                                        )}
                                                </button>
                                            </div>
                                            <div className="editor-container" ref={containerRef}>
                                                {!htmlEditor.isEditorReady && <div className="editor-loading">Loading editor...</div>}
                                                <div className={`editor-wrapper ${htmlEditor.isEditorReady ? 'visible' : 'hidden'}`}>
                                                    <Editor
                                                        defaultLanguage="html"
                                                        value={htmlContent}
                                                        options={{
                                                            readOnly: true,
                                                            minimap: { enabled: false },
                                                            scrollBeyondLastLine: false,
                                                            wordWrap: 'on',
                                                            fontSize: 14,
                                                            lineNumbers: 'on',
                                                            folding: true,
                                                            theme: 'vs-light',
                                                        }}
                                                        onMount={htmlEditor.handleEditorDidMount}
                                                        loading={null}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )
                    }
                </div>

                <div className="enhanced-preview-footer">
                    <div className="preview-stats">
                        <span>Elements: {countElements(elements)}</span>
                        <span>•</span>
                        <span>Template: {templateName}</span>
                        {activeTab === 'visual' && (
                            <>
                                <span>•</span>
                                <span>View: {viewMode}</span>
                            </>
                        )}
                    </div>

                    <div className="preview-actions">
                        {onConfirm && (
                            <button onClick={onConfirm} className="primary-button">
                                {confirmLabel}
                            </button>
                        )}
                        <button onClick={onClose} className="secondary-button">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// Helper function to count elements recursively
const countElements = (elements: EditorElement[]): number => {
    return elements.reduce((count, element) => {
        return count + 1 + (element.children ? countElements(element.children) : 0)
    }, 0)
}

export default EnhancedPreviewModal
