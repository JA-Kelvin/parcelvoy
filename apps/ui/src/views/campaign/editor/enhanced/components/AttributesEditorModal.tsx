// Attributes Editor Modal Component for Enhanced MJML Editor
import React, { useEffect, useMemo, useState } from 'react'
import { EditorElement } from '../types'
import { generateId } from '../utils/mjmlParser'
import './ImportMjmlModal.css'

interface AttributesEditorModalProps {
    isOpen: boolean
    onClose: () => void
    elements: EditorElement[]
    onApply: (updatedElements: EditorElement[]) => void
}

interface AttributeDefinition {
    component: string
    attributes: Record<string, string>
}

const AttributesEditorModal: React.FC<AttributesEditorModalProps> = ({ isOpen, onClose, elements, onApply }) => {
    const [attributeDefinitions, setAttributeDefinitions] = useState<AttributeDefinition[]>([])

    // Common MJML components that can have global attributes
    const availableComponents = [
        { value: 'mj-all', label: 'All Components (mj-all)', description: 'Apply to all MJML components' },
        { value: 'mj-text', label: 'Text (mj-text)', description: 'Text blocks' },
        { value: 'mj-button', label: 'Button (mj-button)', description: 'Button elements' },
        { value: 'mj-image', label: 'Image (mj-image)', description: 'Image elements' },
        { value: 'mj-section', label: 'Section (mj-section)', description: 'Section containers' },
        { value: 'mj-column', label: 'Column (mj-column)', description: 'Column containers' },
        { value: 'mj-wrapper', label: 'Wrapper (mj-wrapper)', description: 'Wrapper containers' },
        { value: 'mj-hero', label: 'Hero (mj-hero)', description: 'Hero sections' },
        { value: 'mj-navbar', label: 'Navbar (mj-navbar)', description: 'Navigation bars' },
        { value: 'mj-social', label: 'Social (mj-social)', description: 'Social media links' },
        { value: 'mj-divider', label: 'Divider (mj-divider)', description: 'Divider lines' },
        { value: 'mj-spacer', label: 'Spacer (mj-spacer)', description: 'Spacing elements' },
    ]

    // Common attributes for different component types
    const commonAttributes: Record<string, string[]> = {
        'mj-all': ['font-family', 'font-size', 'color', 'line-height'],
        'mj-text': ['font-family', 'font-size', 'color', 'line-height', 'padding', 'align'],
        'mj-button': ['background-color', 'color', 'font-family', 'font-size', 'padding', 'border-radius', 'align'],
        'mj-image': ['padding', 'align', 'border-radius', 'width'],
        'mj-section': ['background-color', 'padding', 'border', 'border-radius'],
        'mj-column': ['background-color', 'padding', 'border', 'border-radius'],
        'mj-wrapper': ['background-color', 'padding', 'border'],
        'mj-hero': ['background-color', 'background-url', 'height', 'padding'],
        'mj-navbar': ['background-color', 'padding', 'align'],
        'mj-social': ['padding', 'align', 'icon-size'],
        'mj-divider': ['border-color', 'border-style', 'border-width', 'padding'],
        'mj-spacer': ['height', 'padding'],
    }

    // Extract existing mj-attributes from elements
    const extractAttributes = (els: EditorElement[]): AttributeDefinition[] => {
        const mjmlRoot = (els || []).find((e) => e.tagName === 'mjml')
        if (!mjmlRoot) return []

        const head = (mjmlRoot.children || []).find((c) => c.tagName === 'mj-head')
        if (!head) return []

        const attributesEl = (head.children || []).find((c) => c.tagName === 'mj-attributes')
        if (!attributesEl) return []

        return (attributesEl.children || []).map((child) => ({
            component: child.tagName,
            attributes: { ...child.attributes },
        }))
    }

    const initialAttributes = useMemo(() => extractAttributes(elements), [elements])

    // Reset form when opened
    useEffect(() => {
        if (isOpen) {
            setAttributeDefinitions(initialAttributes.length > 0 ? [...initialAttributes] : [])
        }
    }, [isOpen, initialAttributes])

    const hasChanges = useMemo(() => {
        return JSON.stringify(attributeDefinitions) !== JSON.stringify(initialAttributes)
    }, [attributeDefinitions, initialAttributes])

    const addAttributeDefinition = () => {
        setAttributeDefinitions([...attributeDefinitions, { component: 'mj-all', attributes: {} }])
    }

    const removeAttributeDefinition = (index: number) => {
        setAttributeDefinitions(attributeDefinitions.filter((_, i) => i !== index))
    }

    const updateComponent = (index: number, component: string) => {
        const updated = [...attributeDefinitions]
        updated[index] = { ...updated[index], component, attributes: {} }
        setAttributeDefinitions(updated)
    }

    const updateAttribute = (defIndex: number, attrName: string, attrValue: string) => {
        const updated = [...attributeDefinitions]
        if (attrValue.trim()) {
            updated[defIndex].attributes[attrName] = attrValue.trim()
        } else {
            delete updated[defIndex]?.attributes[attrName]
        }
        setAttributeDefinitions(updated)
    }

    const addCustomAttribute = (defIndex: number) => {
        const attrName = prompt('Enter attribute name (e.g., "font-family", "padding"):')
        if (attrName?.trim()) {
            updateAttribute(defIndex, attrName.trim(), '')
        }
    }

    const applyAttributes = (els: EditorElement[], definitions: AttributeDefinition[]): EditorElement[] => {
        return (els || []).map((root) => {
            if (!root || root.tagName !== 'mjml') return root

            const children = Array.isArray(root.children) ? [...root.children] : []
            const headIndex = children.findIndex((c) => c.tagName === 'mj-head')
            let head = headIndex >= 0 ? children[headIndex] : null

            if (!head && definitions.length === 0) {
                return root // Nothing to do
            }

            if (!head) {
                head = { id: generateId(), type: 'mj-head', tagName: 'mj-head', attributes: {}, children: [] }
            } else {
                // Keep all non-attributes children
                const kept = (head.children || []).filter((c) => c.tagName !== 'mj-attributes')
                head = { ...head, children: kept }
            }

            if (definitions.length > 0) {
                const attributesEl: EditorElement = {
                    id: generateId(),
                    type: 'mj-attributes',
                    tagName: 'mj-attributes',
                    attributes: {},
                    children: definitions.map((def) => ({
                        id: generateId(),
                        type: def.component,
                        tagName: def.component,
                        attributes: { ...def.attributes },
                        children: [],
                    })),
                }
                head.children = [...(head.children || []), attributesEl]
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
        const next = applyAttributes(elements, attributeDefinitions)
        onApply(next)
    }

    if (!isOpen) return null

    return (
        <div className="import-mjml-modal-overlay" onClick={onClose} tabIndex={-1}>
            <div className="import-mjml-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '90vh' }}>
                <div className="import-modal-header">
                    <div className="import-modal-title">
                        <h2>🎯 Global Attributes Editor</h2>
                        <p>Set default attributes for MJML components using &lt;mj-attributes&gt;.</p>
                    </div>
                    <button className="close-button" onClick={onClose} title="Close Attributes Editor">✕</button>
                </div>

                <div className="import-modal-content" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                    <div className="content-input-section">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <label className="content-label">Component Attribute Definitions:</label>
                            <button
                                onClick={addAttributeDefinition}
                                className="import-button"
                                style={{ padding: '5px 10px', fontSize: '12px' }}
                            >
                                + Add Component
                            </button>
                        </div>

                        {attributeDefinitions.length === 0 && (
                            <div style={{
                                padding: '20px',
                                textAlign: 'center',
                                color: '#666',
                                border: '2px dashed #ddd',
                                borderRadius: '8px',
                                marginBottom: '15px',
                            }}>
                                No global attributes defined. Click &quot;Add Component&quot; to start.
                            </div>
                        )}

                        {attributeDefinitions.map((def, defIndex) => (
                            <div key={defIndex} style={{
                                border: '1px solid #ddd',
                                borderRadius: '8px',
                                padding: '15px',
                                marginBottom: '15px',
                                backgroundColor: '#f9f9f9',
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                    <select
                                        value={def.component}
                                        onChange={(e) => updateComponent(defIndex, e.target.value)}
                                        style={{
                                            padding: '5px 10px',
                                            borderRadius: '4px',
                                            border: '1px solid #ccc',
                                            fontSize: '14px',
                                            flex: 1,
                                            marginRight: '10px',
                                        }}
                                    >
                                        {availableComponents.map((comp) => (
                                            <option key={comp.value} value={comp.value}>
                                                {comp.label}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={() => removeAttributeDefinition(defIndex)}
                                        style={{
                                            padding: '5px 8px',
                                            backgroundColor: '#dc3545',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontSize: '12px',
                                        }}
                                        title="Remove this component definition"
                                    >
                                        ✕
                                    </button>
                                </div>

                                <div style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
                                    {availableComponents.find(c => c.value === def.component)?.description}
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                                    {commonAttributes[def.component]?.map((attrName) => (
                                        <div key={attrName}>
                                            <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>
                                                {attrName}:
                                            </label>
                                            <input
                                                type="text"
                                                value={def.attributes[attrName] || ''}
                                                onChange={(e) => updateAttribute(defIndex, attrName, e.target.value)}
                                                placeholder={`e.g., ${attrName === 'font-family'
                                                    ? 'Arial, sans-serif'
                                                    : attrName === 'font-size'
                                                        ? '16px'
                                                        : attrName === 'color'
                                                            ? '#333333'
                                                            : attrName === 'padding'
                                                                ? '10px 25px'
                                                                : attrName === 'background-color'
                                                                    ? '#ffffff'
                                                                    : '...'}
                                                `}
                                                style={{
                                                    width: '100%',
                                                    padding: '4px 8px',
                                                    fontSize: '12px',
                                                    border: '1px solid #ccc',
                                                    borderRadius: '3px',
                                                }}
                                            />
                                        </div>
                                    ))}

                                    {/* Custom attributes */}
                                    {Object.entries(def.attributes).filter(([name]) =>
                                        !commonAttributes[def.component]?.includes(name),
                                    ).map(([attrName, attrValue]) => (
                                        <div key={attrName}>
                                            <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>
                                                {attrName} (custom):
                                            </label>
                                            <input
                                                type="text"
                                                value={attrValue}
                                                onChange={(e) => updateAttribute(defIndex, attrName, e.target.value)}
                                                style={{
                                                    width: '100%',
                                                    padding: '4px 8px',
                                                    fontSize: '12px',
                                                    border: '1px solid #ccc',
                                                    borderRadius: '3px',
                                                }}
                                            />
                                        </div>
                                    ))}
                                </div>

                                <button
                                    onClick={() => addCustomAttribute(defIndex)}
                                    style={{
                                        marginTop: '10px',
                                        padding: '4px 8px',
                                        fontSize: '11px',
                                        backgroundColor: '#28a745',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '3px',
                                        cursor: 'pointer',
                                    }}
                                >
                                    + Add Custom Attribute
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="import-tips">
                        <h4>💡 Tips:</h4>
                        <ul>
                            <li><strong>mj-all</strong> applies attributes to all MJML components globally.</li>
                            <li>Component-specific definitions override mj-all settings.</li>
                            <li>Individual element attributes override global definitions.</li>
                            <li>Common attributes: font-family, font-size, color, padding, background-color, border-radius.</li>
                            <li>Leave fields empty to remove attributes from global definitions.</li>
                        </ul>
                    </div>
                </div>

                <div className="import-modal-footer">
                    <div className="import-actions">
                        <button onClick={handleSave} className="import-button primary-button" disabled={!hasChanges}>
                            💾 Save Attributes
                        </button>
                        <button onClick={onClose} className="cancel-button secondary-button">Cancel</button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default AttributesEditorModal
