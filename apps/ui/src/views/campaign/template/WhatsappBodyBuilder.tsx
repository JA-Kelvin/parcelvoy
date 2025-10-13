import { useEffect, useMemo, useState } from 'react'
import { UseFormReturn } from 'react-hook-form'
import TextInput from '../../../ui/form/TextInput'
import Button from '../../../ui/Button'
import { TemplateUpdateParams } from '../../../types'

interface ParamRow {
    parameter_name: string
    text: string
}

function parseBody(body: any) {
    const to = body?.to ?? ''
    const messaging_product = body?.messaging_product ?? 'whatsapp'
    const type = body?.type ?? 'template'
    const templateName = body?.template?.name ?? ''
    const languageCode = body?.template?.language?.code ?? ''

    const parameters: ParamRow[] = (body?.template?.components ?? [])
        .find((c: any) => c?.type === 'body')?.parameters?.map((p: any) => ({
            parameter_name: p?.parameter_name ?? '',
            text: p?.text ?? '',
        })) ?? []

    return { to, messaging_product, type, templateName, languageCode, parameters }
}

function buildBody({ to, messaging_product, templateName, languageCode, parameters }: {
    to: string
    messaging_product: string
    templateName: string
    languageCode: string
    parameters: ParamRow[]
}) {
    const body = {
        to,
        type: 'template',
        template: {
            name: templateName,
            language: { code: languageCode },
            components: [
                {
                    type: 'body',
                    parameters: parameters.map(p => {
                        const param: any = { type: 'text', text: p.text }
                        const name = (p.parameter_name ?? '').trim()
                        if (name) param.parameter_name = name
                        return param
                    }),
                },
            ],
        },
        messaging_product,
    }
    return body
}

export default function WhatsappBodyBuilder({ form }: { form: UseFormReturn<TemplateUpdateParams, any> }) {
    const endpoint: string = form.watch('data.endpoint')
    const bodyValue: any = form.watch('data.body')

    const supported = useMemo(() => /graph\.facebook\.com\/.+\/messages$/.test(endpoint ?? ''), [endpoint])

    const [to, setTo] = useState('')
    const [messagingProduct, setMessagingProduct] = useState('whatsapp')
    const [templateName, setTemplateName] = useState('')
    const [languageCode, setLanguageCode] = useState('en')
    const [params, setParams] = useState<ParamRow[]>([{ parameter_name: '', text: '' }])

    useEffect(() => {
        try {
            const parsed = parseBody(bodyValue)
            setTo(parsed.to ?? '')
            setMessagingProduct(parsed.messaging_product ?? 'whatsapp')
            setTemplateName(parsed.templateName ?? '')
            setLanguageCode(parsed.languageCode ?? 'en')
            setParams(parsed.parameters?.length ? parsed.parameters : [{ parameter_name: '', text: '' }])
        } catch {
            // ignore parse errors and keep local state
        }
    }, [JSON.stringify(bodyValue)])

    if (!supported) return null

    return (
        <div style={{ border: '1px solid var(--border-color, #e5e7eb)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <strong>WhatsApp Template Builder</strong>
                <Button size="tiny" variant="secondary" onClick={() => {
                    const built = buildBody({ to, messaging_product: messagingProduct, templateName, languageCode, parameters: params })
                    form.setValue('data.body', built, { shouldDirty: true, shouldValidate: true })
                }}>Apply to Body</Button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <TextInput
                    name="to"
                    label="To"
                    value={to}
                    onChange={setTo}
                    placeholder="{{user.phone}}"
                />
                <TextInput
                    name="messaging_product"
                    label="Messaging Product"
                    value={messagingProduct}
                    onChange={(v) => setMessagingProduct(String(v))}
                    placeholder="whatsapp"
                />
                <TextInput
                    name="template_name"
                    label="Template Name"
                    value={templateName}
                    onChange={setTemplateName}
                    placeholder="welcome_message"
                />
                <TextInput
                    name="language_code"
                    label="Language Code"
                    value={languageCode}
                    onChange={setLanguageCode}
                    placeholder="en"
                />
            </div>

            <div style={{ marginTop: 12 }}>
                <label className="ui-text-input">
                    <span>Parameters</span>
                </label>
                {params.map((p, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                        <input
                            placeholder="parameter_name"
                            value={p.parameter_name}
                            onChange={(e) => {
                                const next = [...params]
                                next[idx] = { ...next[idx], parameter_name: e.target.value }
                                setParams(next)
                            }}
                            style={{ flex: 1 }}
                        />
                        <input
                            placeholder="text"
                            value={p.text}
                            onChange={(e) => {
                                const next = [...params]
                                next[idx] = { ...next[idx], text: e.target.value }
                                setParams(next)
                            }}
                            style={{ flex: 1 }}
                        />
                        <Button size="tiny" variant="secondary" onClick={() => {
                            const next = params.filter((_, i) => i !== idx)
                            setParams(next.length ? next : [{ parameter_name: '', text: '' }])
                        }}>Remove</Button>
                    </div>
                ))}
                <Button size="tiny" variant="secondary" onClick={() => setParams(prev => [...prev, { parameter_name: '', text: '' }])}>+ Add Parameter</Button>
                <Button size="tiny" style={{ marginLeft: 8 }} variant="secondary" onClick={() => {
                    // import current JSON into builder
                    const parsed = parseBody(form.getValues('data.body'))
                    setTo(parsed.to ?? '')
                    setMessagingProduct(parsed.messaging_product ?? 'whatsapp')
                    setTemplateName(parsed.templateName ?? '')
                    setLanguageCode(parsed.languageCode ?? 'en')
                    setParams(parsed.parameters?.length ? parsed.parameters : [{ parameter_name: '', text: '' }])
                }}>Import from Body</Button>
            </div>
        </div>
    )
}
