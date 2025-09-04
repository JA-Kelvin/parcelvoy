// Head Editor Modal Component for Enhanced MJML Editor
import React, { useEffect, useMemo, useState } from 'react'
import { EditorElement } from '../types'
import { generateId } from '../utils/mjmlParser'
import './ImportMjmlModal.css'

interface HeadEditorModalProps {
    isOpen: boolean
    onClose: () => void
    elements: EditorElement[]
    onApply: (updatedElements: EditorElement[]) => void
}

const HeadEditorModal: React.FC<HeadEditorModalProps> = ({ isOpen, onClose, elements, onApply }) => {
    const extractHeadCss = (els: EditorElement[]): string => {
        const mjmlRoot = (els || []).find((e) => e.tagName === 'mjml')
        if (!mjmlRoot) return ''
        const head = (mjmlRoot.children || []).find((c) => c.tagName === 'mj-head')
        if (!head) return ''
        const styles = (head.children || []).filter((c) => c.tagName === 'mj-style')
        const cssParts = styles.map((s) => (s.content ?? '').trim()).filter(Boolean)
        return cssParts.join('\n\n')
    }

    const [cssText, setCssText] = useState<string>('')
    const initialCss = useMemo(() => extractHeadCss(elements), [elements])

    // Reset form when opened
    useEffect(() => {
        if (isOpen) {
            setCssText(initialCss)
        }
    }, [isOpen, initialCss])

    const hasChanges = useMemo(() => {
        return (cssText || '').trim() !== (initialCss || '').trim()
    }, [cssText, initialCss])

    const applyHeadStyles = (els: EditorElement[], css: string): EditorElement[] => {
        const trimmed = (css || '').trim()
        return (els || []).map((root) => {
            if (!root || root.tagName !== 'mjml') return root
            const children = Array.isArray(root.children) ? [...root.children] : []
            const headIndex = children.findIndex((c) => c.tagName === 'mj-head')
            let head = headIndex >= 0 ? children[headIndex] : null

            if (!head && !trimmed) {
                // nothing to do
                return root
            }

            if (!head) {
                head = { id: generateId(), type: 'mj-head', tagName: 'mj-head', attributes: {}, children: [] }
            } else {
                // keep all non-style children
                const kept = (head.children || []).filter((c) => c.tagName !== 'mj-style')
                head = { ...head, children: kept }
            }

            if (trimmed) {
                const styleEl: EditorElement = {
                    id: generateId(),
                    type: 'mj-style',
                    tagName: 'mj-style',
                    attributes: {},
                    children: [],
                    content: trimmed,
                }
                head.children = [...(head.children || []), styleEl]
            }

            const nextChildren = [...children]
            if (headIndex >= 0) {
                nextChildren[headIndex] = head
            } else {
                const bodyIndex = nextChildren.findIndex((c) => c.tagName === 'mj-body')
                const insertAt = bodyIndex >= 0 ? bodyIndex : 0
                nextChildren.splice(insertAt, 0, head)
            }
            return { ...root, children: nextChildren }
        })
    }

    const handleSave = () => {
        const next = applyHeadStyles(elements, cssText)
        onApply(next)
    }

    if (!isOpen) return null

    return (
        <div className="import-mjml-modal-overlay" onClick={onClose} tabIndex={-1}>
            <div className="import-mjml-modal" onClick={(e) => e.stopPropagation()}>
                <div className="import-modal-header">
                    <div className="import-modal-title">
                        <h2>🎨 Edit MJML Head Styles</h2>
                        <p>Edit CSS inside &lt;mj-style&gt; within &lt;mj-head&gt;. Changes apply globally.</p>
                    </div>
                    <button className="close-button" onClick={onClose} title="Close Styles Editor">✕</button>
                </div>

                <div className="import-modal-content">
                    <div className="content-input-section">
                        <label htmlFor="head-css" className="content-label">Global CSS (mj-style):</label>
                        <textarea
                            id="head-css"
                            value={cssText}
                            onChange={(e) => setCssText(e.target.value)}
                            placeholder={'/* Example */\n.mj-button a {\n  text-decoration: none;\n}\n'}
                            rows={16}
                            className="content-textarea"
                        />
                    </div>
                    <div className="import-tips">
                        <h4>💡 Tips:</h4>
                        <ul>
                            <li>Styles here will be inserted as a single &lt;mj-style&gt; block under &lt;mj-head&gt;.</li>
                            <li>Existing non-style head content (e.g. &lt;mj-preview&gt;, &lt;mj-title&gt;) is preserved.</li>
                            <li>Leave empty to remove existing &lt;mj-style&gt; blocks.</li>
                        </ul>
                    </div>
                </div>

                <div className="import-modal-footer">
                    <div className="import-actions">
                        <button onClick={handleSave} className="import-button primary-button" disabled={!hasChanges}>
                            💾 Save Styles
                        </button>
                        <button onClick={onClose} className="cancel-button secondary-button">Cancel</button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default HeadEditorModal
