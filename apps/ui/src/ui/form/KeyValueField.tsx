import { ReactNode, useEffect, useState } from 'react'
import { FieldPath, FieldValues, useController } from 'react-hook-form'
import { FieldProps } from '../../types'

interface Row {
    key: string
    value: string
}

function objectToRows(obj?: Record<string, string> | null): Row[] {
    const entries = Object.entries(obj ?? {})
    if (!entries.length) return [{ key: '', value: '' }]
    return entries.map(([k, v]) => ({ key: k ?? '', value: String(v ?? '') }))
}

function rowsToObject(rows: Row[]): Record<string, string> {
    const out: Record<string, string> = {}
    rows.forEach(r => {
        const k = r.key?.trim()
        if (k) out[k] = r.value ?? ''
    })
    return out
}

export default function KeyValueField<X extends FieldValues, P extends FieldPath<X>>({
    form,
    name,
    required,
    label,
    subtitle,
}: FieldProps<X, P>) {
    const { field: { ref, value, ...field }, fieldState } = useController({
        control: form.control,
        name,
        rules: { required },
    })

    const [rows, setRows] = useState<Row[]>(() => objectToRows(value as unknown as Record<string, string>))

    useEffect(() => {
        setRows(objectToRows(value as unknown as Record<string, string>))
    }, [JSON.stringify(value)])

    const error = fieldState.error?.message

    return (
        <label className="ui-text-input">
            {label && (
                <span>
                    {label as ReactNode}
                    {required && <span style={{ color: 'red' }}>&nbsp;*</span>}
                </span>
            )}
            {subtitle && <span className="label-subtitle">{subtitle}</span>}
            <div>
                {rows.map((row, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                        <input
                            ref={idx === 0 ? (ref as any) : undefined}
                            placeholder="Key"
                            value={row.key}
                            onChange={(e) => {
                                const next = [...rows]
                                next[idx] = { ...next[idx], key: e.target.value }
                                setRows(next)
                                field.onChange(rowsToObject(next))
                            }}
                            style={{ flex: 1 }}
                        />
                        <input
                            placeholder="Value"
                            value={row.value}
                            onChange={(e) => {
                                const next = [...rows]
                                next[idx] = { ...next[idx], value: e.target.value }
                                setRows(next)
                                field.onChange(rowsToObject(next))
                            }}
                            style={{ flex: 1 }}
                        />
                        <button
                            type="button"
                            onClick={() => {
                                const next = rows.filter((_, i) => i !== idx)
                                setRows(next.length ? next : [{ key: '', value: '' }])
                                field.onChange(rowsToObject(next))
                            }}
                            aria-label="Remove"
                            style={{ padding: '6px 10px' }}
                        >
                            –
                        </button>
                    </div>
                ))}
                <button
                    type="button"
                    className="ui-button"
                    onClick={() => setRows(prev => [...prev, { key: '', value: '' }])}
                    style={{ padding: '6px 10px' }}
                >
                    + Add
                </button>
            </div>
            {error && <div style={{ color: 'red', marginTop: 6 }}>{error}</div>}
        </label>
    )
}
