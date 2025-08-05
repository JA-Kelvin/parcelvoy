// Enhanced Preview Modal Component with Code View for Enhanced MJML Editor
import React, { useState, useEffect } from 'react'
import { EditorElement } from '../types'
import { editorElementsToMjmlString, mjmlToHtml } from '../utils/mjmlParser'
import './EnhancedPreviewModal.css'

interface EnhancedPreviewModalProps {
    isOpen: boolean
    onClose: () => void
    elements: EditorElement[]
    templateName?: string
}

type ViewMode = 'desktop' | 'tablet' | 'mobile'
type PreviewTab = 'visual' | 'mjml' | 'html'

const EnhancedPreviewModal: React.FC<EnhancedPreviewModalProps> = ({
    isOpen,
    onClose,
    elements,
    templateName = 'Email Template',
}) => {
    const [htmlContent, setHtmlContent] = useState<string>('')
    const [mjmlContent, setMjmlContent] = useState<string>('')
    const [isLoading, setIsLoading] = useState(false)
    const [viewMode, setViewMode] = useState<ViewMode>('desktop')
    const [activeTab, setActiveTab] = useState<PreviewTab>('visual')
    const [error, setError] = useState<string | null>(null)
    const [copySuccess, setCopySuccess] = useState<string>('')

    useEffect(() => {
        if (isOpen && elements.length > 0) {
            void generatePreview()
        }
    }, [isOpen, elements])

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
            console.error('Failed to copy to clipboard:', err)
            setCopySuccess('Failed to copy')
            setTimeout(() => setCopySuccess(''), 2000)
        }
    }

    const formatCode = (code: string, language: 'mjml' | 'html'): string => {
        // Enhanced code formatting with syntax highlighting
        if (!code) return ''

        try {
            // First format the code structure
            let formatted = ''

            if (language === 'mjml') {
                formatted = formatMjmlCode(code)
            } else if (language === 'html') {
                formatted = formatHtmlCode(code)
            }

            // Apply syntax highlighting
            return applySyntaxHighlighting(formatted)
        } catch (err) {
            console.error(`Error formatting ${language} code:`, err)
            return code
        }
    }

    const applySyntaxHighlighting = (code: string): string => {
        // Always escape HTML to prevent XSS
        const escaped = escapeHtml(code)

        // Apply syntax highlighting step by step to avoid conflicts
        let highlighted = escaped

        // 1. Highlight comments first
        highlighted = highlighted.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="syntax-comment">$1</span>')

        // 2. Highlight complete XML/HTML tags
        highlighted = highlighted.replace(/(&lt;\/?[a-zA-Z][a-zA-Z0-9-]*(?:\s[^&gt;]*)?&gt;)/g, (match) => {
            // Don't re-highlight if already in a span
            if (match.includes('<span')) return match
            return `<span class="syntax-tag">${match}</span>`
        })

        // 3. Highlight attributes and values within tag spans
        highlighted = highlighted.replace(/<span class="syntax-tag">([^<]+)<\/span>/g, (match, tagContent) => {
            let processedTag = tagContent
            // Highlight attributes (word followed by =)
            processedTag = processedTag.replace(/\b([a-zA-Z-]+)(?==)/g, '<span class="syntax-attribute">$1</span>')
            // Highlight attribute values
            processedTag = processedTag.replace(/=(&quot;[^&quot;]*&quot;|&#x27;[^&#x27;]*&#x27;)/g, '=<span class="syntax-value">$1</span>')
            return `<span class="syntax-tag">${processedTag}</span>`
        })

        return highlighted
    }

    const escapeHtml = (text: string): string => {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
    }

    const formatMjmlCode = (code: string): string => {
        let indent = 0
        const lines = code.split('\n')

        return lines.map(line => {
            const trimmed = line.trim()
            if (!trimmed) return ''

            // Handle MJML-specific tags
            if (trimmed.startsWith('</')) {
                indent = Math.max(0, indent - 1)
            }

            const indentedLine = '  '.repeat(indent) + trimmed

            // MJML void elements (self-closing)
            const mjmlVoidElements = ['mj-image', 'mj-divider', 'mj-spacer', 'mj-raw']
            const isVoidElement = mjmlVoidElements.some(tag => trimmed.includes(`<${tag}`))

            if (trimmed.startsWith('<') && !trimmed.startsWith('</') && !trimmed.endsWith('/>') && !isVoidElement) {
                indent++
            }

            return indentedLine
        }).join('\n')
    }

    const formatHtmlCode = (code: string): string => {
        let indent = 0
        const lines = code.split('\n')

        return lines.map(line => {
            const trimmed = line.trim()
            if (!trimmed) return ''

            // Handle HTML-specific formatting
            if (trimmed.startsWith('</')) {
                indent = Math.max(0, indent - 1)
            }

            const indentedLine = '  '.repeat(indent) + trimmed

            // HTML void elements
            const htmlVoidElements = ['img', 'br', 'hr', 'input', 'meta', 'link']
            const isVoidElement = htmlVoidElements.some(tag => trimmed.includes(`<${tag}`))

            if (trimmed.startsWith('<') && !trimmed.startsWith('</') && !trimmed.endsWith('/>') && !isVoidElement) {
                indent++
            }

            return indentedLine
        }).join('\n')
    }

    if (!isOpen) return null

    return (
        <div className="enhanced-preview-modal-overlay" onClick={onClose} onKeyDown={handleKeyDown} tabIndex={-1}>
            <div className="enhanced-preview-modal" onClick={(e) => e.stopPropagation()}>
                <div className="enhanced-preview-header">
                    <div className="preview-title">
                        <h2>👁️ Preview: {templateName}</h2>
                    </div>

                    <div className="preview-tabs">
                        <button
                            className={`tab-button ${activeTab === 'visual' ? 'active' : ''}`}
                            onClick={() => setActiveTab('visual')}
                            title="Visual Preview"
                        >
                            👁️ Visual
                        </button>
                        <button
                            className={`tab-button ${activeTab === 'mjml' ? 'active' : ''}`}
                            onClick={() => setActiveTab('mjml')}
                            title="MJML Code"
                        >
                            📝 MJML
                        </button>
                        <button
                            className={`tab-button ${activeTab === 'html' ? 'active' : ''}`}
                            onClick={() => setActiveTab('html')}
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
                                                    srcDoc={htmlContent}
                                                    title="Email Preview"
                                                    className="preview-iframe"
                                                    sandbox="allow-same-origin"
                                                />
                                            </div>

                                            <div className="preview-info">
                                                <div className="viewport-info">
                                                    {viewMode === 'desktop' && '🖥️ Desktop (600px+)'}
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
                                            </div>
                                            <pre className="code-content mjml-code">
                                                <code dangerouslySetInnerHTML={{ __html: formatCode(mjmlContent, 'mjml') }} />
                                            </pre>
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
                                            </div>
                                            <pre className="code-content html-code">
                                                <code dangerouslySetInnerHTML={{ __html: formatCode(htmlContent, 'html') }} />
                                            </pre>
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
