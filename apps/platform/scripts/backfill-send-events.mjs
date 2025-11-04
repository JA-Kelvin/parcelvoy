#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import knex from 'knex'

// Load .env from nearest available location (cwd, package, apps root, repo root)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../../../.env'),
  path.resolve(__dirname, '../../../../.env'),
]
for (const p of envCandidates) {
  if (fs.existsSync(p)) { dotenv.config({ path: p }); break }
}

const env = {
  client: process.env.DB_CLIENT ?? 'mysql2',
  connection: {
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
    database: process.env.DB_DATABASE,
  },
}

const db = knex({ client: env.client, connection: env.connection })

function parseArgs(argv) {
  const args = {}
  for (const arg of argv.slice(2)) {
    const m = arg.match(/^--([^=]+)=(.*)$/)
    if (m) args[m[1]] = m[2]
    else if (arg.startsWith('--')) args[arg.slice(2)] = true
  }
  return args
}

const args = parseArgs(process.argv)
const projectId = parseInt(args.project || args.projectId || args.p, 10)
const from = args.from ? new Date(args.from) : undefined
const to = args.to ? new Date(args.to) : undefined
const batch = args.batch ? parseInt(args.batch, 10) : 1000
const dryRun = !!args.dryRun

if (!projectId || !from || !to) {
  console.error('Usage: node scripts/backfill-send-events.mjs --project=<id> --from=ISO --to=ISO [--batch=1000] [--dryRun]')
  process.exit(1)
}

function eventFromName(name) {
  if (name.endsWith('_sent')) return 'sent'
  if (name.endsWith('_failed')) return 'failed'
  return undefined
}

function channelFromName(name) {
  const idx = name.lastIndexOf('_')
  return idx > 0 ? name.substring(0, idx) : undefined
}

async function main() {
  console.log('Backfill campaign_send_events start', { projectId, from, to, batch, dryRun })
  let lastId = 0
  let total = 0

  while (true) {
    const rows = await db('user_events')
      .where('project_id', projectId)
      .andWhere('id', '>', lastId)
      .andWhere('created_at', '>=', from)
      .andWhere('created_at', '<=', to)
      .andWhereRaw("name REGEXP '^(email|text|push|in_app|webhook)_(sent|failed)$'")
      .orderBy('id', 'asc')
      .limit(batch)

    if (!rows.length) break

    const inserts = []
    for (const r of rows) {
      lastId = r.id
      const event = eventFromName(r.name)
      if (!event) continue
      const channel = channelFromName(r.name) || JSON.parse(r.data || '{}').channel || 'email'
      let data
      try { data = typeof r.data === 'string' ? JSON.parse(r.data || '{}') : (r.data || {}) } catch { data = {} }
      const campaign_id = data.campaign_id ? Number(data.campaign_id) : undefined
      if (!campaign_id) continue
      const reference_id = (data.reference_id ?? '0') + ''
      const meta = {}
      if (data.result) meta.result = data.result

      inserts.push({
        project_id: r.project_id,
        campaign_id,
        user_id: r.user_id,
        channel,
        event,
        reference_type: data.reference_type ?? null,
        reference_id,
        provider_id: null,
        provider_message_id: null,
        meta: Object.keys(meta).length ? JSON.stringify(meta) : null,
        created_at: r.created_at,
        updated_at: r.created_at,
      })
    }

    if (inserts.length) {
      if (dryRun) {
        console.log('Would insert', inserts.length, 'rows; example:', inserts[0])
      } else {
        await db('campaign_send_events')
          .insert(inserts)
          .onConflict()
          .ignore()
        total += inserts.length
        console.log('Inserted', inserts.length, 'rows; lastId=', lastId)
      }
    }

    if (rows.length < batch) break
  }

  console.log('Backfill completed. Total inserted:', total)
  await db.destroy()
}

main().catch(async (err) => {
  console.error('Backfill failed', err)
  await db.destroy()
  process.exit(1)
})
