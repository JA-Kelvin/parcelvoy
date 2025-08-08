// Import MJML Modal Component for Enhanced MJML Editor
import React, { useState, useEffect } from 'react'
import { EditorElement } from '../types'
import { parseMJMLString } from '../utils/mjmlParser'
import './ImportMjmlModal.css'

interface ImportMjmlModalProps {
    isOpen: boolean
    onClose: () => void
    onImport: (elements: EditorElement[]) => void
}

const ImportMjmlModal: React.FC<ImportMjmlModalProps> = ({
    isOpen,
    onClose,
    onImport,
}) => {
    const [pastedContent, setPastedContent] = useState<string>('')
    const [isValid, setIsValid] = useState<boolean>(true)
    const [validationMessage, setValidationMessage] = useState<string>('')
    const [isLoading, setIsLoading] = useState<boolean>(false)

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setPastedContent('')
            setIsValid(true)
            setValidationMessage('')
            setIsLoading(false)
        }
    }, [isOpen])

    // Basic validation for MJML or HTML content
    const validateContent = (content: string): boolean => {
        if (!content.trim()) {
            setIsValid(false)
            setValidationMessage('Content cannot be empty')
            return false
        }

        // Check for basic MJML structure
        if (content.includes('<mjml') && !content.includes('</mjml>')) {
            setIsValid(false)
            setValidationMessage('MJML content appears to be missing closing tags')
            return false
        }

        // Check for basic HTML structure
        if ((content.includes('<html') && !content.includes('</html>')) || (content.includes('<body') && !content.includes('</body>'))) {
            setIsValid(false)
            setValidationMessage('HTML content appears to be missing closing tags')
            return false
        }

        setIsValid(true)
        setValidationMessage('')
        return true
    }

    const handleSubmit = async () => {
        if (!validateContent(pastedContent)) {
            return
        }

        setIsLoading(true)

        try {
            // Parse the MJML content into editor elements
            const elements = await parseMJMLString(pastedContent)
            onImport(elements)
            onClose()
        } catch (error) {
            console.error('Error parsing MJML content:', error)
            setIsValid(false)
            setValidationMessage('Failed to parse MJML content. Please check the syntax.')
        } finally {
            setIsLoading(false)
        }
    }

    const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newContent = e.target.value
        setPastedContent(newContent)

        // Clear validation errors as user types
        if (!isValid && newContent.trim()) {
            setIsValid(true)
            setValidationMessage('')
        }
    }

    const handleKeyDown = async (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose()
        }
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            await handleSubmit()
        }
    }

    if (!isOpen) return null

    return (
        <div className="import-mjml-modal-overlay" onClick={onClose} onKeyDown={handleKeyDown} tabIndex={-1}>
            <div className="import-mjml-modal" onClick={(e) => e.stopPropagation()}>
                <div className="import-modal-header">
                    <div className="import-modal-title">
                        <h2>📥 Import MJML Content</h2>
                        <p>Paste your MJML or HTML content below to import it into the editor</p>
                    </div>
                    <button className="close-button" onClick={onClose} title="Close Import Modal">
                        ✕
                    </button>
                </div>

                <div className="import-modal-content">
                    <div className="content-input-section">
                        <label htmlFor="mjml-content" className="content-label">
                            MJML Content:
                        </label>
                        <textarea
                            id="mjml-content"
                            value={pastedContent}
                            onChange={handleContentChange}
                            placeholder={`<mjml>
  <mj-body>
    <mj-section>
      <mj-column>
        <mj-text>
          Hello World
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`}
                            rows={15}
                            className={`content-textarea ${!isValid ? 'textarea-error' : ''}`}
                            disabled={isLoading}
                        />

                        {!isValid && (
                            <div className="validation-error">
                                ⚠️ {validationMessage}
                            </div>
                        )}
                    </div>

                    <div className="import-tips">
                        <h4>💡 Tips:</h4>
                        <ul>
                            <li>You can paste complete MJML documents</li>
                            <li>The content will be parsed and converted to editable elements</li>
                            <li>Use Ctrl+Enter to quickly import after pasting</li>
                        </ul>
                    </div>
                </div>

                <div className="import-modal-footer">
                    <div className="import-actions">
                        <button
                            onClick={handleSubmit}
                            className="import-button primary-button"
                            disabled={!pastedContent.trim() || isLoading}
                        >
                            {isLoading
                                ? (
                                    <>
                                        <div className="loading-spinner"></div>
                                        Importing...
                                    </>
                                )
                                : (
                                    <>
                                        📥 Import Content
                                    </>
                                )
                            }
                        </button>
                        <button onClick={onClose} className="cancel-button secondary-button">
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ImportMjmlModal
