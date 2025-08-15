// Save Custom Template Modal for Enhanced MJML Editor
import React, { useEffect, useMemo, useState } from 'react'
import './CustomTemplatesModal.css'
import './SaveCustomTemplateModal.css'

interface MinimalTemplateInfo { id: string, name: string, description?: string }

interface SaveCustomTemplateModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: (payload: { name: string, description?: string, scope: 'full' | 'selected', overrideId?: string }) => void
    canSaveSelected: boolean
    existingTemplates?: MinimalTemplateInfo[]
}

const SaveCustomTemplateModal: React.FC<SaveCustomTemplateModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    canSaveSelected,
    existingTemplates = [],
}) => {
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [scope, setScope] = useState<'full' | 'selected'>('selected')
    const [mode, setMode] = useState<'create' | 'override'>('create')
    const [overrideId, setOverrideId] = useState<string>('')
    const [error, setError] = useState<string | null>(null)

    const hasExisting = useMemo(() => existingTemplates.length > 0, [existingTemplates])

    useEffect(() => {
        if (isOpen) {
            setName('')
            setDescription('')
            setScope(canSaveSelected ? 'selected' : 'full')
            setMode('create')
            setOverrideId('')
            setError(null)
        }
    }, [isOpen, canSaveSelected])

    // Prefill when switching to override or changing selected override
    useEffect(() => {
        if (!isOpen) return
        if (mode !== 'override') return
        const id = overrideId || existingTemplates[0]?.id
        if (!id) return
        const tpl = existingTemplates.find(t => t.id === id)
        if (!tpl) return
        // Only prefill if fields are empty to avoid overwriting user edits
        setOverrideId(id)
        setName(prev => prev || tpl.name)
        setDescription(prev => prev || (tpl.description ?? ''))
    }, [mode, overrideId, existingTemplates, isOpen])

    if (!isOpen) return null

    const handleSubmit = (e?: React.FormEvent) => {
        e?.preventDefault()
        if (!name.trim()) {
            setError('Please provide a name')
            return
        }
        if (mode === 'override') {
            const id = overrideId || existingTemplates[0]?.id
            if (!id) {
                setError('Please select a template to override')
                return
            }
            onConfirm({ name: name.trim(), description: description.trim() || undefined, scope, overrideId: id })
            return
        }
        onConfirm({ name: name.trim(), description: description.trim() || undefined, scope })
    }

    return (
        <div className="custom-templates-modal-overlay" onClick={onClose}>
            <div className="custom-templates-modal" onClick={(e) => e.stopPropagation()}>
                <div className="ctm-header">
                    <div className="ctm-title">
                        <h2>🧩 Create Template</h2>
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

                    <div className="ctm-field">
                        <div className="ctm-field-label">Action</div>
                        <div className="ctm-radio-group">
                            <label className="ctm-radio">
                                <input
                                    type="radio"
                                    name="mode"
                                    value="create"
                                    checked={mode === 'create'}
                                    onChange={() => setMode('create')}
                                />
                                <span>Create new</span>
                            </label>
                            <label className={`ctm-radio ${!hasExisting ? 'disabled' : ''}`} title={!hasExisting ? 'No existing templates to override' : ''}>
                                <input
                                    type="radio"
                                    name="mode"
                                    value="override"
                                    checked={mode === 'override'}
                                    onChange={() => hasExisting && setMode('override')}
                                    disabled={!hasExisting}
                                />
                                <span>Override existing</span>
                            </label>
                        </div>
                    </div>

                    {mode === 'override' && hasExisting && (
                        <label className="ctm-field">
                            <div className="ctm-field-label">Select template to override</div>
                            <select
                                className="ctm-input"
                                value={overrideId || existingTemplates[0]?.id || ''}
                                onChange={(e) => setOverrideId(e.target.value)}
                            >
                                {existingTemplates.map(t => (
                                    <option key={t.id} value={t.id}>
                                        {t.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}

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
