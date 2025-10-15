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
        .find((c: any) => String(c?.type ?? '').toLowerCase() === 'body')?.parameters?.map((p: any) => ({
            parameter_name: p?.parameter_name ?? '',
            text: p?.text ?? '',
        })) ?? []

    const headerComp = (body?.template?.components ?? [])
        .find((c: any) => String(c?.type ?? '').toUpperCase() === 'HEADER')
    let headerType: 'none' | 'text' | 'image' = 'none'
    let headerText = ''
    let headerImageLink = ''
    const hp = headerComp?.parameters?.[0]
    if (hp) {
        const htype = String(hp?.type ?? '').toLowerCase()
        if (htype === 'text' && hp?.text != null) {
            headerType = 'text'
            headerText = String(hp.text)
        } else if (htype === 'image' && hp?.image?.link) {
            headerType = 'image'
            headerImageLink = String(hp.image.link)
        }
    }

    return { to, messaging_product, type, templateName, languageCode, parameters, headerType, headerText, headerImageLink }
}

function buildBody({ to, messaging_product, templateName, languageCode, parameters, headerType, headerText, headerImageLink }: {
    to: string
    messaging_product: string
    templateName: string
    languageCode: string
    parameters: ParamRow[]
    headerType: 'none' | 'text' | 'image'
    headerText: string
    headerImageLink: string
}) {
    const components: any[] = []
    const headerTextValue = String(headerText ?? '').trim()
    const headerImageLinkValue = String(headerImageLink ?? '').trim()
    if (headerType === 'text' && headerTextValue) {
        components.push({
            type: 'header',
            parameters: [
                { type: 'text', text: headerTextValue },
            ],
        })
    } else if (headerType === 'image' && headerImageLinkValue) {
        components.push({
            type: 'header',
            parameters: [
                { type: 'image', image: { link: headerImageLinkValue } },
            ],
        })
    }

    components.push({
        type: 'body',
        parameters: parameters.map(p => {
            const param: any = { type: 'text', text: p.text }
            const name = (p.parameter_name ?? '').trim()
            if (name) param.parameter_name = name
            return param
        }),
    })

    const body = {
        to,
        type: 'template',
        template: {
            name: templateName,
            language: { code: languageCode },
            components,
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
    const isFacebookDomain = useMemo(() => /facebook\.com/i.test(endpoint ?? ''), [endpoint])

    const [to, setTo] = useState('')
    const [messagingProduct, setMessagingProduct] = useState('whatsapp')
    const [templateName, setTemplateName] = useState('')
    const [languageCode, setLanguageCode] = useState('en')
    const [params, setParams] = useState<ParamRow[]>([{ parameter_name: '', text: '' }])
    const [headerType, setHeaderType] = useState<'none' | 'text' | 'image'>('none')
    const [headerText, setHeaderText] = useState('')
    const [headerImageLink, setHeaderImageLink] = useState('')
    const [autoSyncEnabled, setAutoSyncEnabled] = useState(true)

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

    // Refs/keys used by effects below (declare before use)
    const autoFetchRef = useRef(false)
    const lastSyncedBodyStrRef = useRef<string>('')
    const autoSyncTimerRef = useRef<number | undefined>(undefined)
    const seedBodyParamsRef = useRef<ParamRow[] | null>(null)
    const paramsKey = useMemo(() => JSON.stringify(params), [params])

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
            const bodyStr = JSON.stringify(bodyValue ?? {})
            if (lastSyncedBodyStrRef.current && bodyStr === lastSyncedBodyStrRef.current) return
            const parsed = parseBody(bodyValue)
            const nextTo = parsed.to ?? ''
            if (nextTo !== to) setTo(nextTo)
            const nextMsg = parsed.messaging_product ?? 'whatsapp'
            if (nextMsg !== messagingProduct) setMessagingProduct(nextMsg)
            const nextName = parsed.templateName ?? ''
            if (nextName !== templateName) setTemplateName(nextName)
            const nextLang = parsed.languageCode ?? 'en'
            if (nextLang !== languageCode) setLanguageCode(nextLang)
            const nextParams = parsed.parameters?.length ? parsed.parameters : [{ parameter_name: '', text: '' }]
            if (JSON.stringify(nextParams) !== JSON.stringify(params)) setParams(nextParams)
            // Seed original non-empty params for fallback preservation
            try {
                if (!seedBodyParamsRef.current) {
                    const hasNonEmpty = Array.isArray(nextParams) && nextParams.some(p => String(p?.text ?? '').trim())
                    if (hasNonEmpty) seedBodyParamsRef.current = JSON.parse(JSON.stringify(nextParams))
                }
            } catch {}
            const nextHeaderType = (parsed.headerType as any) ?? 'none'
            if (nextHeaderType !== headerType) setHeaderType(nextHeaderType)
            const nextHeaderText = parsed.headerText ?? ''
            if (nextHeaderText !== headerText) setHeaderText(nextHeaderText)
            const nextHeaderImage = parsed.headerImageLink ?? ''
            if (nextHeaderImage !== headerImageLink) setHeaderImageLink(nextHeaderImage)
        } catch {
            // ignore parse errors and keep local state
        }
        // eslint-disable-next-line
    }, [JSON.stringify(bodyValue)])

    function commitBody() {
        let built = buildBody({
            to,
            messaging_product: messagingProduct,
            templateName,
            languageCode,
            parameters: params,
            headerType,
            headerText,
            headerImageLink,
        })
        // Fallback: preserve existing non-empty body params if new ones are all empty
        try {
            const existing = parseBody(form.getValues('data.body'))
            const newAllEmpty = !params.some(p => String(p?.text ?? '').trim())
            let existingHas = Array.isArray(existing.parameters) && existing.parameters.some((p: any) => String(p?.text ?? '').trim())
            let fallbackParams: Array<{ text: string }> | null = null
            if (existingHas) {
                fallbackParams = existing.parameters.map((p: any) => ({ text: p?.text ?? '' }))
            } else if (seedBodyParamsRef.current && seedBodyParamsRef.current.some(p => String(p?.text ?? '').trim())) {
                fallbackParams = seedBodyParamsRef.current.map(p => ({ text: p?.text ?? '' }))
                existingHas = true
            }
            if (newAllEmpty && existingHas && fallbackParams) {
                const comps = (built as any)?.template?.components || []
                const i = comps.findIndex((c: any) => String(c?.type ?? '').toUpperCase() === 'BODY')
                if (i >= 0) comps[i] = {
                    type: 'body',
                    parameters: fallbackParams.map((p: any) => ({ type: 'text', text: p?.text ?? '' })),
                }
            }
        } catch {}
        const builtStr = JSON.stringify(built)
        if (lastSyncedBodyStrRef.current === builtStr) return
        lastSyncedBodyStrRef.current = builtStr
        form.setValue('data.body', built, { shouldDirty: true })
    }

    useEffect(() => {
        if (!isFacebookDomain || !autoSyncEnabled) return
        // debounce to reduce layout thrash
        if (autoSyncTimerRef.current) window.clearTimeout(autoSyncTimerRef.current)
        autoSyncTimerRef.current = window.setTimeout(() => {
            let built = buildBody({
                to,
                messaging_product: messagingProduct,
                templateName,
                languageCode,
                parameters: params,
                headerType,
                headerText,
                headerImageLink,
            })
            // Fallback: preserve existing non-empty body params if new ones are all empty
            try {
                const existing = parseBody(form.getValues('data.body'))
                const newAllEmpty = !params.some(p => String(p?.text ?? '').trim())
                let existingHas = Array.isArray(existing.parameters) && existing.parameters.some((p: any) => String(p?.text ?? '').trim())
                let fallbackParams: Array<{ text: string }> | null = null
                if (existingHas) {
                    fallbackParams = existing.parameters.map((p: any) => ({ text: p?.text ?? '' }))
                } else if (seedBodyParamsRef.current && seedBodyParamsRef.current.some(p => String(p?.text ?? '').trim())) {
                    fallbackParams = seedBodyParamsRef.current.map(p => ({ text: p?.text ?? '' }))
                    existingHas = true
                }
                if (newAllEmpty && existingHas && fallbackParams) {
                    const comps = (built as any)?.template?.components || []
                    const i = comps.findIndex((c: any) => String(c?.type ?? '').toUpperCase() === 'BODY')
                    if (i >= 0) comps[i] = {
                        type: 'body',
                        parameters: fallbackParams.map((p: any) => ({ type: 'text', text: p?.text ?? '' })),
                    }
                }
            } catch {}
            try {
                const current = form.getValues('data.body')
                const currStr = JSON.stringify(current ?? {})
                const builtStr = JSON.stringify(built)
                if (currStr !== builtStr) {
                    lastSyncedBodyStrRef.current = builtStr
                    form.setValue('data.body', built, { shouldDirty: true })
                }
            } catch {
                const builtStr = JSON.stringify(built)
                lastSyncedBodyStrRef.current = builtStr
                form.setValue('data.body', built, { shouldDirty: true })
            }
        }, 1000)
        return () => {
            if (autoSyncTimerRef.current) window.clearTimeout(autoSyncTimerRef.current)
        }
        // eslint-disable-next-line
    }, [to, messagingProduct, templateName, languageCode, paramsKey, headerType, headerText, headerImageLink, isFacebookDomain, autoSyncEnabled])

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
            populateFromTemplate(pick, { preserveExisting: true })
        }
    }, [templates, selectedTemplate, templateName, languageCode])

    function populateFromTemplate(t?: TemplateMeta, opts?: { preserveExisting?: boolean }) {
        if (!t) return
        const preserveExisting = opts?.preserveExisting ?? false
        setTemplateName(t.name ?? '')
        setLanguageCode(t.language ?? 'en')

        // Existing values detection (source of truth: current form body to avoid race with state hydration)
        let hasExistingHeader = false
        let hasExistingParams = false
        try {
            const existing = parseBody(form.getValues('data.body'))
            hasExistingHeader = (existing.headerType && existing.headerType !== 'none')
                || Boolean(String(existing.headerText ?? '').trim())
                || Boolean(String(existing.headerImageLink ?? '').trim())
            hasExistingParams = Array.isArray(existing.parameters) && existing.parameters.some((p: any) => Boolean(String(p?.text ?? '').trim()))
        } catch {}

        // Header
        if (!(preserveExisting && hasExistingHeader)) {
            const headerC = t.components?.find(c => c?.type?.toUpperCase() === 'HEADER')
            if (headerC) {
                const fmt = String((headerC as any)?.format ?? '').toUpperCase()
                if (fmt === 'IMAGE') {
                    setHeaderType('image')
                    // do not overwrite link; user provides actual link at send-time
                    setHeaderText('')
                    if (!preserveExisting) setHeaderImageLink('')
                } else if (fmt === 'TEXT') {
                    setHeaderType('text')
                    setHeaderText(String((headerC as any)?.text ?? ''))
                    setHeaderImageLink('')
                } else {
                    setHeaderType('none')
                    setHeaderText('')
                    setHeaderImageLink('')
                }
            } else {
                setHeaderType('none')
                setHeaderText('')
                setHeaderImageLink('')
            }
        }

        // Body params
        if (!(preserveExisting && hasExistingParams)) {
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

    const headerTypeOptions = useMemo(() => ([
        { id: 'none', label: 'None' },
        { id: 'text', label: 'Text' },
        { id: 'image', label: 'Image' },
    ]), [])

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

    const showBuilder = isFacebookDomain
    if (!showBuilder) return null

    return (
        <div style={{ border: '1px solid var(--border-color, #e5e7eb)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <strong>WhatsApp Template Builder</strong>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label className="ui-text-input" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                            type="checkbox"
                            checked={autoSyncEnabled}
                            onChange={(e) => setAutoSyncEnabled(e.currentTarget.checked)}
                            style={{ margin: 0 }}
                        />
                        <span className="label-subtitle">Auto-sync (1000ms)</span>
                    </label>
                    <Button size="tiny" variant="secondary" onClick={async () => {
                        commitBody()
                        if (form.trigger) await form.trigger('data.body')
                    }}>Apply to Body</Button>
                </div>
            </div>

            {/* Integration quick-load so users know values can come from Integrations */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ gridColumn: '1 / -1' }}>
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
                <span className="label-subtitle">Tip: Select an integration to auto-fill Endpoint and Headers.</span>
            </div>

            {isGraphMessages && (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
                            onBlur={() => { if (!autoSyncEnabled) commitBody() }}
                            placeholder="welcome_message"
                        />
                        <TextInput
                            name="language_code"
                            label="Language Code"
                            value={languageCode}
                            onChange={setLanguageCode}
                            onBlur={() => { if (!autoSyncEnabled) commitBody() }}
                            placeholder="en"
                        />
                    </div>

                    {selectedTemplate && (
                        <div style={{ marginTop: 12 }}>
                            <label className="ui-text-input">
                                <span>Preview</span>
                            </label>
                            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, maxWidth: 700 }}>
                                {headerType === 'text' && headerText && (
                                    <div style={{ marginBottom: 8, fontWeight: 600 }}>{headerText}</div>
                                )}
                                {headerType === 'image' && headerImageLink && (
                                    <div style={{ marginBottom: 8 }}>
                                        <img src={headerImageLink} alt="" style={{ maxWidth: 240, borderRadius: 8 }} />
                                    </div>
                                )}
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
                    <div style={{ gridColumn: '1 / -1' }}>
                        <TextInput
                            name="to"
                            label="To"
                            value={to}
                            onChange={setTo}
                            onBlur={() => { if (!autoSyncEnabled) commitBody() }}
                            placeholder="{{user.phone}}"
                        />
                        <TextInput
                            name="messaging_product"
                            label="Messaging Product"
                            value={messagingProduct}
                            onChange={(v) => setMessagingProduct(String(v))}
                            onBlur={() => { if (!autoSyncEnabled) commitBody() }}
                            placeholder="whatsapp"
                        />
                        <SingleSelect
                            label="Header Type"
                            value={headerTypeOptions.find(o => o.id === headerType)}
                            onChange={(o?: any) => setHeaderType((o?.id ?? 'none'))}
                            options={headerTypeOptions}
                            toValue={(o: any) => o}
                            getValueKey={(o: any) => o.id}
                            getOptionDisplay={(o: any) => o.label}
                            size="regular"
                            variant="plain"
                        />
                        {headerType === 'text' && (
                            <TextInput
                                name="header_text"
                                label="Header Text"
                                value={headerText}
                                onChange={setHeaderText}
                                onBlur={() => { if (!autoSyncEnabled) commitBody() }}
                                placeholder="Welcome"
                            />
                        )}
                        {headerType === 'image' && (
                            <TextInput
                                name="header_image_link"
                                label="Header Image Link"
                                value={headerImageLink}
                                onChange={setHeaderImageLink}
                                onBlur={() => { if (!autoSyncEnabled) commitBody() }}
                                placeholder="https://..."
                            />
                        )}
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
                                    onBlur={() => { if (!autoSyncEnabled) commitBody() }}
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
                                    onBlur={() => { if (!autoSyncEnabled) commitBody() }}
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
                            const parsed = parseBody(form.getValues('data.body'))
                            setTo(parsed.to ?? '')
                            setMessagingProduct(parsed.messaging_product ?? 'whatsapp')
                            setTemplateName(parsed.templateName ?? '')
                            setLanguageCode(parsed.languageCode ?? 'en')
                            setParams(parsed.parameters?.length ? parsed.parameters : [{ parameter_name: '', text: '' }])
                            if (parsed.headerType) setHeaderType(parsed.headerType as any)
                            setHeaderText(parsed.headerText ?? '')
                            setHeaderImageLink(parsed.headerImageLink ?? '')
                        }}>Import from Body</Button>
                    </div>
                </>
            )}
        </div>
    )
}
