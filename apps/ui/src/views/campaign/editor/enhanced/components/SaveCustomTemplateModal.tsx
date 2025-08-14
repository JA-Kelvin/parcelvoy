// Save Custom Template Modal for Enhanced MJML Editor
import React, { useEffect, useState } from 'react'
import './CustomTemplatesModal.css'
import './SaveCustomTemplateModal.css'

interface SaveCustomTemplateModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: (payload: { name: string, description?: string, scope: 'full' | 'selected' }) => void
    canSaveSelected: boolean
}

const SaveCustomTemplateModal: React.FC<SaveCustomTemplateModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    canSaveSelected,
}) => {
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [scope, setScope] = useState<'full' | 'selected'>('selected')
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (isOpen) {
            setName('')
            setDescription('')
            setScope(canSaveSelected ? 'selected' : 'full')
            setError(null)
        }
    }, [isOpen, canSaveSelected])

    if (!isOpen) return null

    const handleSubmit = (e?: React.FormEvent) => {
        e?.preventDefault()
        if (!name.trim()) {
            setError('Please provide a name')
            return
        }
        onConfirm({ name: name.trim(), description: description.trim() || undefined, scope })
    }

    return (
        <div className="custom-templates-modal-overlay" onClick={onClose}>
            <div className="custom-templates-modal" onClick={(e) => e.stopPropagation()}>
                <div className="ctm-header">
                    <div className="ctm-title">
                        <h2>🧩 Save as Template</h2>
                        <p>Create a reusable block you can insert later</p>
                    </div>
                    <button className="ctm-close" onClick={onClose} title="Close">✕</button>
                </div>

                <form onSubmit={handleSubmit} className="ctm-content" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <label className="ctm-field">
                        <div className="ctm-field-label">Name</div>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Hero Section, Two-Column Feature"
                            className="ctm-input"
                            autoFocus
                        />
                    </label>

                    <label className="ctm-field">
                        <div className="ctm-field-label">Description (optional)</div>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Short description"
                            className="ctm-textarea"
                            rows={3}
                        />
                    </label>

                    <div className="ctm-field">
                        <div className="ctm-field-label">Scope</div>
                        <div className="ctm-radio-group">
                            <label className={`ctm-radio ${!canSaveSelected ? 'disabled' : ''}`} title={!canSaveSelected ? 'Select a section to enable' : ''}>
                                <input
                                    type="radio"
                                    name="scope"
                                    value="selected"
                                    checked={scope === 'selected'}
                                    onChange={() => canSaveSelected && setScope('selected')}
                                    disabled={!canSaveSelected}
                                />
                                <span>Selected section</span>
                            </label>
                            <label className="ctm-radio">
                                <input
                                    type="radio"
                                    name="scope"
                                    value="full"
                                    checked={scope === 'full'}
                                    onChange={() => setScope('full')}
                                />
                                <span>Full email (all sections)</span>
                            </label>
                        </div>
                    </div>

                    {error && <div className="ctm-error" role="alert">{error}</div>}
                </form>

                <div className="ctm-footer">
                    <div className="ctm-actions">
                        <button onClick={() => handleSubmit()} className="primary-button">Save</button>
                        <button onClick={onClose} className="secondary-button">Cancel</button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default SaveCustomTemplateModal
