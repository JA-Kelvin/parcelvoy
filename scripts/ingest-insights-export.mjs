#!/usr/bin/env node
/**
 * Insights Export -> Parcelvoy Identify Ingestion Script
 *
 * - Fetches user-level export from Insights API
 * - Transforms records to Parcelvoy identify payloads
 * - Posts to Parcelvoy /api/client/identify with Bearer API key
 * - Includes retries and configurable concurrency
 *
 * Requirements: Node.js 18+
 *
 * Usage (Windows CMD):
 *   set PV_API_KEY=<YOUR_PV_KEY> & node scripts\ingest-insights-export.mjs --insightsBaseUrl http://127.0.0.1:3000 --segment Champions
 *
 * PowerShell:
 *   $env:PV_API_KEY="<YOUR_PV_KEY>"; node scripts/ingest-insights-export.mjs --segmentGroup core
 *
 * Bash:
 *   PV_API_KEY="<YOUR_PV_KEY>" node scripts/ingest-insights-export.mjs --insightsBaseUrl http://127.0.0.1:3000 --timeframe 90d
 *
 * Env/Args:
 *   --pvApiKey | PV_API_KEY                Parcelvoy API key (Bearer)
 *   --pvBaseUrl | PV_BASE_URL              Parcelvoy base URL (default: http://127.0.0.1:3000)
 *   --insightsBaseUrl | INSIGHTS_BASE_URL  Insights API base URL (default: http://127.0.0.1:3000)
 *   --insightsToken | INSIGHTS_AUTH_BEARER Bearer token for Insights (NextAuth JWT). Optional if Insights auth disabled.
 *   --segment | SEGMENT                    Segment name (default: all)
 *   --segmentGroup | SEGMENT_GROUP         Segment group key (default: all)
 *   --timeframe | TIMEFRAME                e.g. 30d, 90d, 12m, all (default: all)
 *   --limit | LIMIT                        Max rows per request (default: 10000)
 *   --offset | OFFSET                      Offset (default: 0)
 *   --concurrency | CONCURRENCY            Parallel identify posts (default: 5)
 *   --dryRun | DRY_RUN                     true/false - log transformed payloads, skip POST (default: false)
 *   --max | MAX                            Process at most N items from export (default: 0 = no extra limit)
 */

import process from 'node:process'

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      if (a.includes('=')) {
        const [k, v] = a.slice(2).split('=')
        out[k] = v
      } else {
        const k = a.slice(2)
        const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true'
        out[k] = v
      }
    }
  }
  return out
}

const args = parseArgs(process.argv.slice(2))

const CONFIG = {
  pvBaseUrl: args.pvBaseUrl || process.env.PV_BASE_URL || 'http://127.0.0.1:3000',
  pvApiKey: args.pvApiKey || process.env.PV_API_KEY,
  insightsBaseUrl: args.insightsBaseUrl || process.env.INSIGHTS_BASE_URL || 'http://127.0.0.1:3000',
  insightsToken: args.insightsToken || process.env.INSIGHTS_AUTH_BEARER || '',
  segment: args.segment || process.env.SEGMENT || 'all',
  segmentGroup: args.segmentGroup || process.env.SEGMENT_GROUP || 'all',
  timeframe: args.timeframe || process.env.TIMEFRAME || 'all',
  limit: Number(args.limit || process.env.LIMIT || 10000),
  offset: Number(args.offset || process.env.OFFSET || 0),
  concurrency: Number(args.concurrency || process.env.CONCURRENCY || 5),
  dryRun: String(args.dryRun || process.env.DRY_RUN || 'false').toLowerCase() === 'true' || String(args.dryRun || process.env.DRY_RUN || '0') === '1',
  max: Number(args.max || process.env.MAX || 0),
}

if (!CONFIG.pvApiKey) {
  console.error('ERROR: Missing Parcelvoy API key. Set PV_API_KEY env or pass --pvApiKey <key>.')
  process.exit(1)
}

function qs(params) {
  const p = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '' && v !== 'all') p.set(k, String(v))
    if ((k === 'segment' || k === 'segmentGroup' || k === 'timeframe') && v === 'all') p.set(k, 'all')
  })
  return p.toString()
}

async function httpGetJson(url, headers = {}) {
  const res = await fetch(url, { headers })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`GET ${url} -> HTTP ${res.status} ${res.statusText}: ${text}`)
  }
  return res.json()
}

async function httpPostJson(url, body, headers = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`POST ${url} -> HTTP ${res.status} ${res.statusText}: ${text}`)
  }
  try {
    return await res.json()
  } catch {
    return null
  }
}

function buildIdentifyPayload(rec) {
  const data = {
    membership_id: rec.membership_id || rec.external_id || null,
    name: rec.name || [rec.first_name, rec.last_name].filter(Boolean).join(' ') || null,
    first_name: rec.first_name || null,
    last_name: rec.last_name || null,
    rfm: {
      segment: rec.segment || null,
      recency: typeof rec.recency === 'number' ? rec.recency : rec.recency ? Number(rec.recency) : null,
      frequency: typeof rec.frequency === 'number' ? rec.frequency : rec.frequency ? Number(rec.frequency) : null,
      monetary: typeof rec.monetary === 'number' ? rec.monetary : rec.monetary ? Number(rec.monetary) : null,
    },
  }

  return {
    anonymous_id: rec.external_id || String(rec.membership_id || ''),
    external_id: rec.external_id || String(rec.membership_id || ''),
    email: rec.email || undefined,
    phone: rec.phone || undefined,
    timezone: rec.timezone || undefined,
    locale: rec.locale || undefined,
    data,
  }
}

async function identifyWithRetry(baseUrl, apiKey, payload, attempt = 1) {
  const url = `${baseUrl}/api/client/identify`
  try {
    return await httpPostJson(url, payload, { Authorization: `Bearer ${apiKey}` })
  } catch (e) {
    if (attempt >= 3) throw e
    const backoff = 500 * attempt
    console.warn(`Identify failed for ${payload.external_id} (attempt ${attempt}). Retrying in ${backoff}ms...`, String(e))
    await new Promise(r => setTimeout(r, backoff))
    return identifyWithRetry(baseUrl, apiKey, payload, attempt + 1)
  }
}

async function fetchInsightsExport(config) {
  const params = {
    segment: config.segment,
    segmentGroup: config.segmentGroup,
    timeframe: config.timeframe,
    limit: config.limit,
    offset: config.offset,
  }
  const url = `${config.insightsBaseUrl}/api/insights/customers/export?${qs(params)}`
  const headers = {}
  if (config.insightsToken) headers['Authorization'] = `Bearer ${config.insightsToken}`
  else console.warn('Warning: No INSIGHTS_AUTH_BEARER provided. Ensure Insights auth is disabled (DISABLE_AUTH=true) or provide a valid NextAuth JWT.')

  const json = await httpGetJson(url, headers)
  if (!json || !Array.isArray(json.data)) {
    throw new Error('Unexpected export response shape. Expected { data: [] }')
  }
  return json.data
}

async function processWithConcurrency(items, limit, worker) {
  let inFlight = 0
  let idx = 0
  let ok = 0
  let fail = 0

  return new Promise((resolve) => {
    function next() {
      while (inFlight < limit && idx < items.length) {
        const current = items[idx++]
        inFlight++
        Promise.resolve()
          .then(() => worker(current))
          .then(() => { ok++ })
          .catch((e) => { fail++; console.warn('Worker error:', String(e)) })
          .finally(() => {
            inFlight--
            if (idx >= items.length && inFlight === 0) resolve({ ok, fail })
            else next()
          })
      }
    }
    next()
  })
}

async function main() {
  console.log('\n=== Insights -> Parcelvoy Ingestion ===')
  console.log('Insights:', CONFIG.insightsBaseUrl)
  console.log('Parcelvoy:', CONFIG.pvBaseUrl)
  console.log('Filters:', { segment: CONFIG.segment, segmentGroup: CONFIG.segmentGroup, timeframe: CONFIG.timeframe })
  console.log('Limit/Offset:', { limit: CONFIG.limit, offset: CONFIG.offset })
  console.log('Concurrency:', CONFIG.concurrency, 'DryRun:', CONFIG.dryRun)

  const exportRows = await fetchInsightsExport(CONFIG)
  console.log(`Fetched ${exportRows.length} rows from Insights.`)

  const rows = CONFIG.max > 0 ? exportRows.slice(0, CONFIG.max) : exportRows
  const payloads = rows.map(buildIdentifyPayload)

  if (CONFIG.dryRun) {
    console.log('Dry run - showing first 3 payloads:')
    console.dir(payloads.slice(0, 3), { depth: null })
    console.log(`Total payloads prepared: ${payloads.length}`)
    return
  }

  const result = await processWithConcurrency(payloads, CONFIG.concurrency, async (p) => {
    await identifyWithRetry(CONFIG.pvBaseUrl, CONFIG.pvApiKey, p)
  })

  console.log(`Done. Identify successes: ${result.ok}, failures: ${result.fail}`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
