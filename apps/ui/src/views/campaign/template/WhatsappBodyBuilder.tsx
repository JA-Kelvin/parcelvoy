import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { UseFormReturn } from 'react-hook-form'
import TextInput from '../../../ui/form/TextInput'
import Button from '../../../ui/Button'
import { TemplateUpdateParams } from '../../../types'
import { SingleSelect } from '../../../ui/form/SingleSelect'
import api from '../../../api'
import { ProjectContext, CampaignContext } from '../../../contexts'
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
    // Accept pre-stringified body from form fields
    if (typeof body === 'string') {
        try { body = JSON.parse(body) } catch { /* ignore */ }
    }
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
    const [campaign] = useContext(CampaignContext)
    const endpoint: string = form.watch('data.endpoint')
    const bodyValue: any = form.watch('data.body')
    const headersValue: any = form.watch('data.headers')

    const isGraphMessages = useMemo(() => /graph\.facebook\.com\/.+\/messages$/.test(endpoint ?? ''), [endpoint])
    const isEndpointEmpty = useMemo(() => ((endpoint ?? '').trim() === ''), [endpoint])
    const isFacebookDomain = useMemo(() => /facebook\.com/i.test(endpoint ?? ''), [endpoint])

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

    // Bind selected integration to campaign's provider (read-only UX)
    useEffect(() => {
        if (campaign?.provider && (campaign.provider.group === 'webhook')) {
            setSelectedIntegration(campaign.provider)
            const hasEndpoint = !!form.getValues('data.endpoint')
            const hasHeaders = !!(headersValue && Object.keys(headersValue || {}).length)
            if (!hasEndpoint && !hasHeaders) {
                applyIntegrationDefaults(campaign.provider)
            }
        }
    }, [campaign?.provider])

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

    // Helper: resolve Handlebars-like placeholders from selected integration provider
    const providerData = useMemo(() => (selectedIntegration?.data ?? {}), [selectedIntegration])
    function getNested(obj: any, path: string): any {
        if (!obj || !path) return undefined
        return path.split('.').reduce((acc: any, key: string) => (acc != null ? acc[key] : undefined), obj)
    }
    function resolveProviderVars(input?: string): string {
        if (!input) return ''
        let out = String(input)
        if (!out.includes('{{')) return out
        // handle lookup first: {{lookup context.provider.data.headers "Authorization"}}
        out = out.replace(/\{\{\s*lookup\s+context\.provider\.data\.([a-zA-Z0-9_.]+)\s+"([^"]+)"\s*\}\}/g, (_m, base: string, key: string) => {
            const baseObj = getNested(providerData, base)
            const val = baseObj?.[key]
            return val != null ? String(val) : ''
        })
        // simple path: {{context.provider.data.business_id}}
        out = out.replace(/\{\{\s*context\.provider\.data\.([a-zA-Z0-9_.]+)\s*\}\}/g, (_m, path: string) => {
            const val = getNested(providerData, path)
            return val != null ? String(val) : ''
        })
        return out
    }

    const effectiveAuthToken = useMemo(() => {
        const token = (authToken ?? '').toString()
        return token.includes('{{') ? resolveProviderVars(token) : token
    }, [authToken, providerData])

    const effectiveWabaId = useMemo(() => {
        const local = (wabaId ?? '').toString()
        if (!local || local.includes('{{')) {
            const fromProvider = providerData?.waba_id
            return fromProvider ? String(fromProvider) : (local.includes('{{') ? '' : local)
        }
        return local
    }, [wabaId, providerData])

    const effectiveBusinessId = useMemo(() => {
        let bid = (businessId ?? '').toString()
        // use provider if local is empty or templated
        if (!bid || bid.includes('{{')) {
            if (providerData?.business_id) bid = String(providerData.business_id)
        }
        if (!bid && endpoint) {
            const resolvedEndpoint = resolveProviderVars(endpoint)
            const m = resolvedEndpoint.match(/graph\.facebook\.com\/v\d+\.\d+\/(\d+)\/messages$/)
            if (m?.[1]) bid = m[1]
        }
        return bid
    }, [businessId, endpoint, providerData])

    function getGraphVersion() {
        const resolved = resolveProviderVars(endpoint)
        const m = resolved?.match(/graph\.facebook\.com\/(v\d+\.\d+)\//)
        return m?.[1] ?? 'v23.0'
    }

    async function fetchTemplates() {
        try {
            if (!effectiveAuthToken) throw new Error('Authorization header (Bearer token) is required to fetch templates')
            if (!effectiveWabaId) throw new Error('WABA ID is required')
            const url = `https://graph.facebook.com/${getGraphVersion()}/${encodeURIComponent(effectiveWabaId)}/message_templates?limit=200`
            const res = await fetch(url, { headers: { Authorization: effectiveAuthToken } })
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

    const autoFetchRef = useRef(false)
    useEffect(() => {
        if (autoFetchRef.current) return
        if (selectedIntegration && effectiveAuthToken && effectiveWabaId && templateName && templates.length === 0) {
            autoFetchRef.current = true
            void fetchTemplates()
        }
    }, [selectedIntegration, effectiveAuthToken, effectiveWabaId, templateName, templates.length])

    useEffect(() => {
        if (!templates.length) return
        if (selectedTemplate) return
        if (!templateName) return
        const langA = String(languageCode ?? '').toLowerCase().replace(/-/g, '_')
        const pick = templates.find(t => t.name === templateName && String(t.language ?? '').toLowerCase().replace(/-/g, '_') === langA)
            ?? templates.find(t => t.name === templateName)
        if (pick) {
            setSelectedTemplate(pick)
            populateFromTemplate(pick)
        }
    }, [templates, selectedTemplate, templateName, languageCode])

    function populateFromTemplate(t?: TemplateMeta) {
        if (!t) return
        setTemplateName(t.name ?? '')
        setLanguageCode(t.language ?? 'en')
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
        const resolved = resolveProviderVars(endpoint)
        const m = resolved?.match(/graph\.facebook\.com\/v\d+\.\d+\/(\d+)\/messages$/)
        if (m?.[1]) {
            setBusinessId(prev => prev || m[1])
        }
    }, [endpoint, providerData])

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

        const hasEndpoint = !!form.getValues('data.endpoint')
        const hasHeaders = !!(headersValue && Object.keys(headersValue || {}).length)
        const providerEndpoint: string = data.endpoint || data.url || ''

        // Endpoint: if first time (no endpoint), prefer dynamic Handlebars
        if (!hasEndpoint) {
            if (providerEndpoint && /graph\.facebook\.com\/.+\/messages/.test(providerEndpoint)) {
                const verMatch = providerEndpoint.match(/graph\.facebook\.com\/(v\d+\.\d+)\//)
                const ver = verMatch?.[1] ?? 'v24.0'
                const dynamicEndpoint = `https://graph.facebook.com/${ver}/{{context.provider.data.business_id}}/messages`
                form.setValue('data.endpoint', dynamicEndpoint, { shouldDirty: true })
            } else if (providerEndpoint) {
                form.setValue('data.endpoint', providerEndpoint, { shouldDirty: true })
            }
        } else if (providerEndpoint) {
            // Respect user's existing endpoint; do not overwrite
        }

        // Headers: if first time (no headers), set dynamic placeholders then merge provider headers for missing keys
        const nextHeaders: Record<string, string> = { ...(headersValue || {}) }
        if (!hasHeaders) {
            if (!nextHeaders.Authorization && !nextHeaders.authorization) {
                nextHeaders.Authorization = '{{lookup context.provider.data.headers "Authorization"}}'
            }
            if (!nextHeaders['Content-Type'] && !nextHeaders['content-type']) {
                nextHeaders['Content-Type'] = '{{lookup context.provider.data.headers "Content-Type"}}'
            }
        }
        const providerHeaders = data.headers || {}
        for (const [k, v] of Object.entries(providerHeaders)) {
            if (!(k in nextHeaders)) nextHeaders[k] = String(v)
        }
        if (!nextHeaders['Content-Type'] && !nextHeaders['content-type']) {
            nextHeaders['Content-Type'] = 'application/json'
        }
        form.setValue('data.headers', nextHeaders, { shouldDirty: true })

        // Local helper fields for fetch/link (dynamic defaults on first-time apply)
        if (!String(wabaId ?? '').trim()) setWabaId('{{context.provider.data.waba_id}}')
        if (!String(businessId ?? '').trim()) setBusinessId('{{context.provider.data.business_id}}')
    }

    const showBuilder = isEndpointEmpty || isFacebookDomain || isGraphMessages || integrations.length > 0
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                    <span className="label-subtitle">Tip: Select an integration to auto-fill Endpoint and Headers.</span>
                    <SingleSelect
                        label="Integration (webhook)"
                        subtitle={campaign?.provider && campaign.provider.group === 'webhook' ? 'Managed by campaign provider' : undefined}
                        disabled={!!(campaign?.provider && campaign.provider.group === 'webhook')}
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
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label className="ui-text-input">
                                <span>Provider IDs</span>
                                <span className="label-subtitle">Managed by campaign provider</span>
                                <div className="label-subtitle">WABA ID: {effectiveWabaId || wabaId || '—'}</div>
                                <div className="label-subtitle">Business ID: {effectiveBusinessId || businessId || '—'}</div>
                            </label>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
                            <Button size="tiny" variant="secondary" onClick={fetchTemplates}>Fetch Templates</Button>
                            {selectedTemplate && effectiveBusinessId && effectiveWabaId && (
                                <a
                                    className="ui-button secondary tiny"
                                    href={`https://business.facebook.com/latest/whatsapp_manager/message_templates/?business_id=${encodeURIComponent(effectiveBusinessId)}&tab=message-templates&childRoute=CAPI&id=${encodeURIComponent(selectedTemplate.id)}&nav_ref=whatsapp_manager&asset_id=${encodeURIComponent(effectiveWabaId)}`}
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
                            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, maxWidth: 700 }}>
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
