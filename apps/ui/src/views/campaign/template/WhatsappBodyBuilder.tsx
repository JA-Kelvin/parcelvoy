import { useContext, useEffect, useMemo, useState } from 'react'
import { UseFormReturn } from 'react-hook-form'
import TextInput from '../../../ui/form/TextInput'
import Button from '../../../ui/Button'
import { TemplateUpdateParams } from '../../../types'
import { SingleSelect } from '../../../ui/form/SingleSelect'
import api from '../../../api'
import { ProjectContext } from '../../../contexts'
import type { Provider } from '../../../types'

interface ParamRow {
    parameter_name: string
    text: string
}

interface TemplateMeta {
    id: string
    name: string
    language: string
    parameter_format?: 'NAMED' | 'POSITIONAL'
    components?: Array<{
        type: string
        text?: string
        format?: string
        example?: any
    }>
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

function escapeHtml(s: string) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
}

function toHtmlWithBoldAndBreaks(s: string) {
    // Convert *bold* and newlines to simple HTML
    const withBold = s.replace(/\*(.*?)\*/g, '<strong>$1</strong>')
    return withBold.replace(/\n/g, '<br/>')
}

export default function WhatsappBodyBuilder({ form }: { form: UseFormReturn<TemplateUpdateParams, any> }) {
    const [project] = useContext(ProjectContext)
    const endpoint: string = form.watch('data.endpoint')
    const bodyValue: any = form.watch('data.body')
    const headersValue: any = form.watch('data.headers')

    const isGraphMessages = useMemo(() => /graph\.facebook\.com\/.+\/messages$/.test(endpoint ?? ''), [endpoint])

    const [to, setTo] = useState('')
    const [messagingProduct, setMessagingProduct] = useState('whatsapp')
    const [templateName, setTemplateName] = useState('')
    const [languageCode, setLanguageCode] = useState('en')
    const [params, setParams] = useState<ParamRow[]>([{ parameter_name: '', text: '' }])

    // Template fetch state
    const [wabaId, setWabaId] = useState('')
    const [businessId, setBusinessId] = useState('')
    const [templates, setTemplates] = useState<TemplateMeta[]>([])
    const [selectedTemplate, setSelectedTemplate] = useState<TemplateMeta | undefined>(undefined)
    const authToken = useMemo(() => {
        const h = headersValue as Record<string, string> | undefined
        if (!h) return ''
        // try common casing keys
        return h?.Authorization || h?.authorization || ''
    }, [headersValue])

    const [integrations, setIntegrations] = useState<Provider[]>([])
    const [selectedIntegration, setSelectedIntegration] = useState<Provider | undefined>(undefined)
    useEffect(() => {
        api.providers.all(project.id)
            .then(list => setIntegrations(list.filter(p => p.group === 'webhook')))
            .catch(() => {})
    }, [project])

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

    function getGraphVersion() {
        const m = endpoint?.match(/graph\.facebook\.com\/(v\d+\.\d+)\//)
        return m?.[1] ?? 'v23.0'
    }

    async function fetchTemplates() {
        try {
            if (!authToken) throw new Error('Authorization header (Bearer token) is required to fetch templates')
            if (!wabaId) throw new Error('WABA ID is required')
            const url = `https://graph.facebook.com/${getGraphVersion()}/${encodeURIComponent(wabaId)}/message_templates?limit=200`
            const res = await fetch(url, { headers: { Authorization: authToken } })
            if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
            const json = await res.json()
            const list: TemplateMeta[] = (json?.data ?? []).map((t: any) => ({
                id: String(t?.id ?? ''),
                name: String(t?.name ?? ''),
                language: String(t?.language ?? t?.language_code ?? ''),
                parameter_format: t?.parameter_format,
                components: t?.components,
            }))
            setTemplates(list)
        } catch (e) {
            console.error(e)
            alert((e as Error).message)
        }
    }

    async function fetchTemplateByName() {
        try {
            if (!authToken) throw new Error('Authorization header (Bearer token) is required to fetch templates')
            if (!wabaId) throw new Error('WABA ID is required')
            if (!templateName) throw new Error('Template Name is required')
            const url = `https://graph.facebook.com/${getGraphVersion()}/${encodeURIComponent(wabaId)}/message_templates?name=${encodeURIComponent(templateName)}`
            const res = await fetch(url, { headers: { Authorization: authToken } })
            if (!res.ok) throw new Error(`Fetch by name failed: ${res.status}`)
            const json = await res.json()
            const list: TemplateMeta[] = (json?.data ?? []).map((t: any) => ({
                id: String(t?.id ?? ''),
                name: String(t?.name ?? ''),
                language: String(t?.language ?? t?.language_code ?? ''),
                parameter_format: t?.parameter_format,
                components: t?.components,
            }))
            if (!list.length) throw new Error('Template not found by name')
            setTemplates(list)
            setSelectedTemplate(list[0])
            populateFromTemplate(list[0])
        } catch (e) {
            console.error(e)
            alert((e as Error).message)
        }
    }

    function populateFromTemplate(t?: TemplateMeta) {
        if (!t) return
        setTemplateName(t.name || '')
        setLanguageCode(t.language || 'en')
        // derive params from components/body
        const body = t.components?.find(c => c?.type?.toUpperCase() === 'BODY')
        const nextParams: ParamRow[] = []
        if (t.parameter_format === 'NAMED') {
            const namedList = body?.example?.body_text_named_params as Array<{ param_name: string, example?: string }>
            if (Array.isArray(namedList) && namedList.length) {
                namedList.forEach(n => nextParams.push({ parameter_name: n.param_name, text: `{{user.${n.param_name}}}` }))
            } else if (body?.text) {
                // fallback parsing from {{param}}
                const names = Array.from(body.text.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)).map(m => m[1])
                names.forEach(n => nextParams.push({ parameter_name: n, text: `{{user.${n}}}` }))
            }
        } else {
            // POSITIONAL
            let count = 0
            if (body?.example?.body_text?.[0]) {
                count = Array.isArray(body.example.body_text[0]) ? body.example.body_text[0].length : 0
            }
            if (!count && body?.text) {
                count = (body.text.match(/\{\{\s*\d+\s*\}\}/g) ?? []).length
            }
            for (let i = 0; i < count; i++) nextParams.push({ parameter_name: '', text: '' })
        }
        setParams(nextParams.length ? nextParams : [{ parameter_name: '', text: '' }])
    }

    // If endpoint contains an ID, treat it as Business ID (messages path uses phone number or business/asset IDs), not WABA
    useEffect(() => {
        const m = endpoint?.match(/graph\.facebook\.com\/v\d+\.\d+\/(\d+)\/messages$/)
        if (m?.[1]) {
            setBusinessId(prev => prev || m[1])
        }
    }, [endpoint])

    const previewHtml = useMemo(() => {
        const isVariableLike = (v?: string) => /\{\{.*\}\}/.test(String(v ?? ''))
        const body = selectedTemplate?.components?.find(c => c?.type?.toUpperCase() === 'BODY')
        const raw = String(body?.text ?? '')
        if (!raw) return ''

        // Helper readers for examples
        const namedExamples: Record<string, string> = {}
        const namedList = body?.example?.body_text_named_params as Array<{ param_name: string, example?: string }>
        if (Array.isArray(namedList)) {
            for (const item of namedList) namedExamples[item.param_name] = item.example ?? ''
        }
        const positionalExamples: string[] = Array.isArray(body?.example?.body_text?.[0]) ? body?.example?.body_text[0] : []

        let out = raw
        if (selectedTemplate?.parameter_format === 'NAMED') {
            out = out.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, name: string) => {
                const userVal = params.find(p => p.parameter_name === name)?.text
                const val = (!userVal || isVariableLike(userVal) ? '' : userVal.trim()) || namedExamples[name] || ''
                return escapeHtml(val)
            })
        } else {
            out = out.replace(/\{\{\s*(\d+)\s*\}\}/g, (_, idxStr: string) => {
                const idx = Number(idxStr) - 1
                const userVal = params[idx]?.text
                const val = (!userVal || isVariableLike(userVal) ? '' : userVal.trim()) || positionalExamples[idx] || ''
                return escapeHtml(val)
            })
        }
        return toHtmlWithBoldAndBreaks(out)
    }, [selectedTemplate, params])

    function applyIntegrationDefaults(p?: Provider) {
        const provider = p ?? selectedIntegration
        if (!provider) return
        const data = (provider as any)?.data || {}
        const nextEndpoint = data.endpoint || data.url || ''
        if (nextEndpoint) form.setValue('data.endpoint', nextEndpoint, { shouldDirty: true })
        const headers = data.headers || {}
        const nextHeaders = {
            ...(headersValue || {}),
            ...(headers || {}),
        }
        if (!nextHeaders['Content-Type'] && !nextHeaders['content-type']) {
            nextHeaders['Content-Type'] = 'application/json'
        }
        form.setValue('data.headers', nextHeaders, { shouldDirty: true })
        if (data.waba_id) setWabaId(String(data.waba_id))
        if (data.business_id) setBusinessId(String(data.business_id))
    }

    const showBuilder = isGraphMessages || integrations.length > 0
    if (!showBuilder) return null

    return (
        <div style={{ border: '1px solid var(--border-color, #e5e7eb)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <strong>WhatsApp Template Builder</strong>
                <Button size="tiny" variant="secondary" onClick={() => {
                    const built = buildBody({ to, messaging_product: messagingProduct, templateName, languageCode, parameters: params })
                    form.setValue('data.body', built, { shouldDirty: true, shouldValidate: true })
                }}>Apply to Body</Button>
            </div>

            {/* Integration quick-load so users know values can come from Integrations */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'end', marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                    <SingleSelect
                        label="Integration (webhook)"
                        value={selectedIntegration}
                        onChange={(p?: Provider) => {
                            setSelectedIntegration(p)
                            const hasEndpoint = !!endpoint
                            const hasHeaders = !!(headersValue && Object.keys(headersValue || {}).length)
                            if (p && !hasEndpoint && !hasHeaders) applyIntegrationDefaults(p)
                        }}
                        options={integrations}
                        toValue={p => p}
                        getValueKey={(p: any) => p?.id ?? ''}
                        getOptionDisplay={(p: Provider) => `${p.name} (${p.type})`}
                        size="regular"
                        variant="plain"
                    />
                </div>
                <Button size="tiny" variant="secondary" onClick={() => applyIntegrationDefaults()}>Apply Integration Defaults</Button>
                <span className="label-subtitle">Tip: Select an integration to auto-fill Endpoint and Headers.</span>
            </div>

            {isGraphMessages && (
                <>
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
                            name="waba_id"
                            label="WABA ID"
                            value={wabaId}
                            onChange={setWabaId}
                            placeholder="e.g. 1748436919147739"
                        />
                        <TextInput
                            name="business_id"
                            label="Business ID (for quick link)"
                            value={businessId}
                            onChange={setBusinessId}
                            placeholder="e.g. 842386909138669"
                        />
                        <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
                            <Button size="tiny" variant="secondary" onClick={fetchTemplates}>Fetch Templates</Button>
                            <Button size="tiny" variant="secondary" onClick={fetchTemplateByName}>Fetch By Name</Button>
                            {selectedTemplate && businessId && wabaId && (
                                <a
                                    className="ui-button secondary tiny"
                                    href={`https://business.facebook.com/latest/whatsapp_manager/message_templates/?business_id=${encodeURIComponent(businessId)}&tab=message-templates&childRoute=CAPI&id=${encodeURIComponent(selectedTemplate.id)}&nav_ref=whatsapp_manager&asset_id=${encodeURIComponent(wabaId)}`}
                                    target="_blank" rel="noreferrer"
                                >
                                    Edit in WhatsApp Manager
                                </a>
                            )}
                        </div>
                        {/* Integration select moved to top; keep only template dropdown here */}
                        <div style={{ gridColumn: '1 / -1' }}>
                            <SingleSelect
                                label="Template"
                                value={selectedTemplate}
                                onChange={(t?: TemplateMeta) => {
                                    setSelectedTemplate(t)
                                    if (t) populateFromTemplate(t)
                                }}
                                options={templates}
                                toValue={t => t}
                                getValueKey={(t: any) => t?.id ?? ''}
                                getOptionDisplay={(t: TemplateMeta) => `${t.name} (${t.language}${t.parameter_format ? ` • ${t.parameter_format}` : ''})`}
                                size="regular"
                                variant="plain"
                            />
                        </div>
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

                    {selectedTemplate && (
                        <div style={{ marginTop: 12 }}>
                            <label className="ui-text-input">
                                <span>Preview</span>
                            </label>
                            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, maxWidth: 360 }}>
                                <div style={{
                                    background: '#e1ffc7',
                                    borderRadius: 16,
                                    padding: '10px 12px',
                                    display: 'inline-block',
                                    color: '#111',
                                    fontSize: 14,
                                    lineHeight: 1.5,
                                }}
                                dangerouslySetInnerHTML={{ __html: previewHtml }}
                                />
                            </div>
                        </div>
                    )}

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
                        <Button size="tiny" className="ui-button" variant="secondary" onClick={() => setParams(prev => [...prev, { parameter_name: '', text: '' }])}>+ Add Parameter</Button>
                        <Button size="tiny" className="ui-button" style={{ marginLeft: 8 }} variant="secondary" onClick={() => {
                            // import current JSON into builder
                            const parsed = parseBody(form.getValues('data.body'))
                            setTo(parsed.to ?? '')
                            setMessagingProduct(parsed.messaging_product ?? 'whatsapp')
                            setTemplateName(parsed.templateName ?? '')
                            setLanguageCode(parsed.languageCode ?? 'en')
                            setParams(parsed.parameters?.length ? parsed.parameters : [{ parameter_name: '', text: '' }])
                        }}>Import from Body</Button>
                    </div>
                </>
            )}
        </div>
    )
}
