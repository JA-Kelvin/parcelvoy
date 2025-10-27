#!/usr/bin/env node
/*
  Sample Data Generator for Parcelvoy Client API
  - Identifies a user via /api/client/identify
  - Generates randomized events via /api/client/events
  Requirements: Node.js 18+

  Usage examples (Windows PowerShell):
    $env:PV_API_KEY="<YOUR_API_KEY>"; node scripts/generate-sample-data.mjs --membership M-00012345 --email kelvin@example.com --count 100

  CMD:
    set PV_API_KEY=<YOUR_API_KEY> & node scripts\generate-sample-data.mjs --membership M-00012345 --email kelvin@example.com --count 100

  - Fixed events per member (e.g., 5 each):
    set PV_API_KEY=<YOUR_API_KEY> & node scripts/generate-sample-data.mjs --members 20 --eventsPerMember 5

  - Spread a total across members (e.g., 100 total):
    set PV_API_KEY=<YOUR_API_KEY> & node scripts/generate-sample-data.mjs --members 25 --count 100

  bash
    PV_API_KEY="<YOUR_API_KEY>" node /d/xampp/parcelvoy/scripts/generate-sample-data.mjs --members 10 --eventsPerMember 3 --baseUrl http://127.0.0.1:3000

    export PV_BASE_URL="http://127.0.0.1:3000"
    export PV_BATCH_SIZE=25

  Optional args/env:
    --apiKey | PV_API_KEY
    --baseUrl | PV_BASE_URL (default: http://127.0.0.1:3000)
    --membership | PV_MEMBERSHIP_ID (default: M-00012345)
    --email | PV_EMAIL (default: kelvin@example.com)
    --phone | PV_PHONE (default: +85291234567)
    --timezone | PV_TZ (default: Asia/Hong_Kong)
    --locale | PV_LOCALE (default: zh-HK)
    --count | PV_COUNT (default: 100)
    --batchSize | PV_BATCH_SIZE (default: 25)
    --members | PV_MEMBERS (number of random members to create; default: 0 for single-member mode)
    --onlyMembers | PV_ONLY_MEMBERS (true/false; when true, create members and skip events)
    --eventsPerMember | PV_EVENTS_PER_MEMBER (events per member; default: ceil(count/members) when members>0)
*/

import process from 'node:process'
import crypto from 'node:crypto'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

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
  baseUrl: args.baseUrl || process.env.PV_BASE_URL || 'http://127.0.0.1:3000',
  apiKey: args.apiKey || process.env.PV_API_KEY,
  membershipId: args.membership || process.env.PV_MEMBERSHIP_ID || 'M-00012345',
  email: args.email || process.env.PV_EMAIL || 'kelvin@example.com',
  phone: args.phone || process.env.PV_PHONE || '+85291234567',
  timezone: args.timezone || process.env.PV_TZ || 'Asia/Hong_Kong',
  locale: args.locale || process.env.PV_LOCALE || 'zh-HK',
  count: Number(args.count || process.env.PV_COUNT || 100),
  batchSize: Number(args.batchSize || process.env.PV_BATCH_SIZE || 25),
  members: Number(args.members || process.env.PV_MEMBERS || 0),
  onlyMembers: (String(args.onlyMembers || process.env.PV_ONLY_MEMBERS || 'false').toLowerCase() === 'true' || String(args.onlyMembers || process.env.PV_ONLY_MEMBERS || '0') === '1'),
  scenario: args.scenario || process.env.PV_SCENARIO || '',
  clientPath: args.clientPath || process.env.PV_CLIENT_PATH || '/api/client',
  eventsPerMember: (args.eventsPerMember || process.env.PV_EVENTS_PER_MEMBER) ? Number(args.eventsPerMember || process.env.PV_EVENTS_PER_MEMBER) : undefined,
}

if (!CONFIG.apiKey) {
  console.error('ERROR: Missing API key. Set PV_API_KEY env or pass --apiKey <key>.')
  process.exit(1)
}

function rid(prefix) {
  if (typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
  }
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
function randChoice(arr) {
  return arr[randInt(0, arr.length - 1)]
}
function randomDateWithinMonths(months = 6) {
  const now = new Date()
  const past = new Date()
  past.setMonth(now.getMonth() - months)
  const t = randInt(past.getTime(), now.getTime())
  return new Date(t)
}
function plusDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}
function iso(d) {
  return new Date(d).toISOString()
}
function ymd(d) {
  return new Date(d).toISOString().slice(0, 10)
}

function dateDaysAgo(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d
}
function randomDateBetweenDays(minDaysAgo, maxDaysAgo) {
  const start = plusDays(new Date(), -maxDaysAgo)
  const end = plusDays(new Date(), -minDaysAgo)
  const t = randInt(start.getTime(), end.getTime())
  return new Date(t)
}

function joinUrl(a, b) {
  return `${String(a).replace(/\/+$/,'')}/${String(b).replace(/^\/+/, '')}`
}

const productCatalog = {
  knitwear: [
    { sku: 'KNIT-CARDIGAN', name: 'Knit Cardigan', season: 'winter', price_hkd: 980 },
    { sku: 'WOOL-SWEATER', name: 'Wool Sweater', season: 'autumn', price_hkd: 850 },
    { sku: 'CASHMERE-PULLOVER', name: 'Cashmere Pullover', season: 'winter', price_hkd: 1280 },
  ],
  accessories: [
    { sku: 'WOOL-SCARF', name: 'Wool Scarf', season: 'winter', price_hkd: 220 },
    { sku: 'BEANIE', name: 'Knit Beanie', season: 'winter', price_hkd: 180 },
    { sku: 'LEATHER-BELT', name: 'Leather Belt', season: 'autumn', price_hkd: 390 },
  ],
  outerwear: [
    { sku: 'DOWN-JACKET', name: 'Down Jacket', season: 'winter', price_hkd: 1680 },
    { sku: 'TRENCH-COAT', name: 'Trench Coat', season: 'autumn', price_hkd: 1380 },
  ],
}

function buildOrderEvent(membershipId, date, items) {
  const total = items.reduce((s, it) => s + (it.price_hkd * (it.qty || 1)), 0)
  const orderId = rid('ordr')
  return {
    name: 'order_placed',
    anonymous_id: membershipId,
    external_id: membershipId,
    data: {
      order_id: orderId,
      membership_id: membershipId,
      order_date: iso(date),
      currency: 'HKD',
      total_amount_hkd: Math.round(total * 100) / 100,
      items: items.map((it) => ({
        sku: it.sku,
        name: it.name,
        category: it.category,
        season: it.season,
        price_hkd: it.price_hkd,
        qty: it.qty || 1,
      })),
    },
  }
}

function mkMessageId() { return rid('msg') }
function channelEvent(membershipId, date, channel, type, payload = {}) {
  return {
    name: `${channel}_${type}`,
    anonymous_id: membershipId,
    external_id: membershipId,
    data: { ...payload, occurred_at: iso(date), channel },
  }
}

function memberSignedUpEvent(membershipId, registrationDate) {
  return {
    name: 'member_signed_up',
    anonymous_id: membershipId,
    external_id: membershipId,
    data: { membership_id: membershipId, registered_at: iso(registrationDate) },
  }
}

function generateMemberPayloadForSegment(segment) {
  const base = generateRandomMemberPayload()
  const now = new Date()
  if (segment === 'new_joiners') {
    base.data.registration_date = ymd(randomDateBetweenDays(0, 30))
  } else if (segment === 'repeat_buyers') {
    base.data.registration_date = ymd(randomDateBetweenDays(120, 360))
  } else if (segment === 'lapsed_members') {
    base.data.registration_date = ymd(randomDateBetweenDays(180, 540))
    base.data.lifetime_spend_hkd = randInt(500, 8000)
  } else if (segment === 'high_spenders_seasonal') {
    base.data.registration_date = ymd(randomDateBetweenDays(60, 360))
    base.data.favorite_season = randChoice(['autumn', 'winter'])
  } else if (segment === 'promo_sensitive') {
    base.data.registration_date = ymd(randomDateBetweenDays(60, 240))
  }
  return base
}

function generateWelcomeJourneyEvents(memberId, registrationDate) {
  const events = []
  events.push(memberSignedUpEvent(memberId, registrationDate))
  const msgId1 = mkMessageId()
  events.push(channelEvent(memberId, registrationDate, 'email', 'sent', {
    message_id: msgId1,
    campaign_name: 'Welcome to Knit Cardigan Loyalty Program',
    automation_name: 'Welcome Journey',
  }))
  events.push(channelEvent(memberId, plusDays(registrationDate, 0), 'whatsapp', 'sent', {
    message_id: mkMessageId(),
    campaign_name: 'Welcome via WhatsApp',
    automation_name: 'Welcome Journey',
  }))
  events.push(channelEvent(memberId, plusDays(registrationDate, 3), 'email', 'sent', {
    message_id: mkMessageId(),
    campaign_name: 'Welcome Coupon Reminder',
    automation_name: 'Welcome Journey',
  }))
  return events
}

function generateRepeatBuyerEvents(memberId) {
  const events = []
  const firstDate = randomDateBetweenDays(45, 180)
  const secondDate = randomDateBetweenDays(0, 59)
  const knit = { ...randChoice(productCatalog.knitwear), category: 'knitwear', qty: 1 }
  const other = { ...randChoice(productCatalog.accessories), category: 'accessories', qty: randInt(1, 2) }
  events.push(buildOrderEvent(memberId, firstDate, [other]))
  events.push(buildOrderEvent(memberId, secondDate, [knit, other]))
  events.push(channelEvent(memberId, plusDays(secondDate, 1), 'email', 'sent', {
    message_id: mkMessageId(),
    campaign_name: 'Thank You + Accessory Upsell',
    automation_name: 'Thank You + Upsell',
    trigger: 'knit_purchase',
  }))
  return events
}

function generateLapsedMemberEvents(memberId) {
  const events = []
  const oldPurchase1 = randomDateBetweenDays(120, 240)
  const oldPurchase2 = randomDateBetweenDays(200, 300)
  const winterItem = { ...productCatalog.knitwear[0], category: 'knitwear', qty: 1 }
  const coat = { ...randChoice(productCatalog.outerwear), category: 'outerwear', qty: 1 }
  events.push(buildOrderEvent(memberId, oldPurchase2, [winterItem]))
  events.push(buildOrderEvent(memberId, oldPurchase1, [coat]))
  const variant = Math.random() < 0.5 ? 'A' : 'B'
  const winbackName = variant === 'A' ? 'Win-Back: 20% Off Coupon' : 'Win-Back: We Miss You'
  const winbackDate = randomDateBetweenDays(0, 7)
  events.push(channelEvent(memberId, winbackDate, 'email', 'sent', {
    message_id: mkMessageId(),
    campaign_name: winbackName,
    automation_name: 'Win-Back Sequence',
    experiment_id: 'winback_v1',
    variant,
  }))
  events.push(channelEvent(memberId, plusDays(winbackDate, 0), 'sms', 'sent', {
    message_id: mkMessageId(),
    campaign_name: winbackName,
    automation_name: 'Win-Back Sequence',
    experiment_id: 'winback_v1',
    variant,
  }))
  const seasonalVariant = Math.random() < 0.5 ? 'A' : 'B'
  const seasonalName = seasonalVariant === 'A' ? 'Seasonal Launch: Early Access' : 'Seasonal Launch: Free Gift'
  const seasonalDate = randomDateBetweenDays(0, 7)
  events.push(channelEvent(memberId, seasonalDate, 'email', 'sent', {
    message_id: mkMessageId(),
    campaign_name: seasonalName,
    automation_name: 'Seasonal Launch Engagement Test',
    experiment_id: 'seasonal_launch_v1',
    variant: seasonalVariant,
    trigger: 'last_winter_purchase_>=200d',
  }))
  events.push(channelEvent(memberId, plusDays(seasonalDate, 0), 'push', 'sent', {
    message_id: mkMessageId(),
    campaign_name: seasonalName,
    automation_name: 'Seasonal Launch Engagement Test',
    experiment_id: 'seasonal_launch_v1',
    variant: seasonalVariant,
  }))
  return events
}

function generateHighSpenderSeasonalEvents(memberId) {
  const events = []
  const d1 = randomDateBetweenDays(30, 60)
  const d2 = randomDateBetweenDays(0, 29)
  const big1 = { ...randChoice(productCatalog.knitwear), category: 'knitwear', qty: 1 }
  const big2 = { ...randChoice(productCatalog.outerwear), category: 'outerwear', qty: 1 }
  big1.price_hkd = Math.max(big1.price_hkd, 900)
  big2.price_hkd = Math.max(big2.price_hkd, 900)
  events.push(buildOrderEvent(memberId, d1, [big1]))
  events.push(buildOrderEvent(memberId, d2, [big2]))
  events.push(channelEvent(memberId, plusDays(d2, 2), 'email', 'sent', {
    message_id: mkMessageId(),
    campaign_name: 'New Knitwear Collection',
    automation_name: 'Seasonal Promotion',
    audience: 'High Spenders with Seasonal Interest',
  }))
  return events
}

function generatePromotionSensitiveEvents(memberId) {
  const events = []
  const baseDates = [randomDateBetweenDays(40, 45), randomDateBetweenDays(20, 25), randomDateBetweenDays(5, 10)]
  let openedCount = 0
  for (let i = 0; i < 3; i++) {
    const sentId = mkMessageId()
    events.push(channelEvent(memberId, baseDates[i], 'email', 'sent', {
      message_id: sentId,
      campaign_name: `Promo ${i + 1}`,
      campaign_type: 'promotion',
    }))
    if (Math.random() < 0.8 || openedCount < 2) {
      openedCount++
      events.push(channelEvent(memberId, plusDays(baseDates[i], 0), 'email', 'opened', {
        message_id: sentId,
        campaign_name: `Promo ${i + 1}`,
      }))
    }
  }
  if (Math.random() < 0.1) {
    const promoIdx = randInt(0, 2)
    const purchaseDate = plusDays(baseDates[promoIdx], randInt(1, 7))
    const acc = { ...randChoice(productCatalog.accessories), category: 'accessories', qty: 1 }
    events.push(buildOrderEvent(memberId, purchaseDate, [acc]))
  }
  return events
}

const stores = Array.from({ length: 10 }, (_, i) => `STR-${String(i + 1).padStart(3, '0')}`)
const merchants = ['Juicy Cafe', 'Juicy Bistro', 'Juicy Market', 'Juicy Deli', 'Juicy Express', 'Juicy Mart', 'Juicy Kitchen']
const couponList = ['CPN-15OFF-2025', 'CPN-500P-REWARD', 'CPN-SUMMER-2025', 'CPN-FREESHIP', 'CPN-BOGO-2025']
const couponNameById = {
  'CPN-15OFF-2025': '15% Off',
  'CPN-500P-REWARD': '500 Points Reward',
  'CPN-SUMMER-2025': 'Summer Special',
  'CPN-FREESHIP': 'Free Shipping',
  'CPN-BOGO-2025': 'Buy One Get One',
}

// Random member helpers
const firstNames = ['Kelvin', 'Ada', 'Ben', 'Carmen', 'Dicky', 'Emily', 'Felix', 'Grace', 'Henry', 'Iris', 'Jason', 'Karen', 'Liam', 'Mandy', 'Natalie', 'Oscar', 'Queenie', 'Rachel', 'Sam', 'Tina', 'Victor', 'Winnie', 'Yvonne']
const lastNames = ['Ho', 'Chan', 'Lee', 'Wong', 'Lau', 'Tang', 'Ng', 'Cheung', 'Lam', 'Cheng', 'Leung', 'Yip']
const salutations = ['Mr.', 'Ms.', 'Mrs.', 'Mx.']
const tiers = ['Bronze', 'Silver', 'Gold', 'Platinum']

function randomMembershipId() {
  return `M-${String(randInt(0, 99999999)).padStart(8, '0')}`
}
function randomPhoneHK() {
  // Hong Kong mobile numbers commonly start with 5/6/9
  const start = randChoice(['5', '6', '9'])
  let rest = ''
  for (let i = 0; i < 7; i++) rest += String(randInt(0, 9))
  return `+852${start}${rest}`
}
function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}
function generateRandomMemberPayload() {
  const first = randChoice(firstNames)
  const last = randChoice(lastNames).toUpperCase()
  const fullName = `${first} ${last}`
  const membership_id = randomMembershipId()
  const today = new Date()
  const closingDate = plusDays(today, -randInt(1, 90))
  const expiringDate = plusDays(today, randInt(30, 180))
  const tier = randChoice(tiers)
  const balance = randInt(0, 5000)
  const email = `${slugify(first)}.${slugify(last)}+${membership_id.slice(-4)}@example.com`
  return {
    anonymous_id: membership_id,
    external_id: membership_id,
    email,
    phone: randomPhoneHK(),
    timezone: 'Asia/Hong_Kong',
    locale: randChoice(['zh-HK', 'en']),
    data: {
      membership_id,
      name: fullName,
      first_name: first,
      last_name: last,
      salutation: randChoice(salutations),
      tier,
      point_balance: balance,
      registration_date: null,
      last_login: null,
      points: {
        total_balance: balance,
        closing_date: ymd(closingDate),
        expiring_points: Math.round(balance * Math.random()),
        expiring_points_date: ymd(expiringDate),
      },
    },
  }
}

async function httpPost(path, body) {
  const url = joinUrl(CONFIG.baseUrl, path)
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CONFIG.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`)
  }
  try {
    return await res.json()
  } catch {
    return null
  }
}

async function identifyUser(payloadOverride) {
  const today = new Date()
  const closingDate = plusDays(today, -randInt(15, 60))
  const expiringDate = plusDays(today, randInt(30, 90))
  let payload = payloadOverride
  if (!payload) {
    payload = {
      anonymous_id: CONFIG.membershipId,
      external_id: CONFIG.membershipId,
      email: CONFIG.email,
      phone: CONFIG.phone,
      timezone: CONFIG.timezone,
      locale: CONFIG.locale,
      data: {
        membership_id: CONFIG.membershipId,
        name: 'Kelvin HO',
        first_name: 'Kelvin',
        last_name: 'HO',
        salutation: 'Mr.',
        tier: 'Gold',
        point_balance: 1666,
        registration_date: null,
        last_login: null,
        points: {
          total_balance: 1666,
          closing_date: ymd(closingDate),
          expiring_points: 1666,
          expiring_points_date: ymd(expiringDate),
        },
      },
    }
  }

  console.log('Identifying user...', { external_id: payload.external_id })
  const res = await httpPost(joinUrl(CONFIG.clientPath, 'identify'), payload)
  console.log('Identify result:', res)
  return payload
}

async function createRandomMembers(n) {
  const created = []
  for (let i = 0; i < n; i++) {
    const p = generateRandomMemberPayload()
    try {
      await identifyUser(p)
      created.push(p)
    } catch (e) {
      console.warn('Identify failed for', p.external_id, String(e))
    }
    await sleep(50)
  }
  return created
}

function generateRandomEvent(membershipId) {
  const r = Math.random()
  if (r < 0.5) {
    // PointTransaction
    const type = Math.random() < 0.7 ? 'earn' : 'burn'
    const date = randomDateWithinMonths(6)
    const points = type === 'earn' ? randInt(10, 1000) : randInt(50, 2000)
    const evtName = type === 'earn' ? 'points_earned' : 'points_burned'
    const item = {
      name: evtName,
      anonymous_id: membershipId,
      external_id: membershipId,
      data: {
        transaction_id: rid('ptxn'),
        membership_id: membershipId,
        type,
        points,
        transaction_date: iso(date),
        store_id: randChoice(stores),
        merchant_name: randChoice(merchants),
        event_id: type === 'earn' ? `${randChoice(['EVT-WELCOME', 'EVT-PROMO', 'EVT-BONUS'])}-${new Date().getFullYear()}` : 'EVT-REDEEM',
      },
    }
    if (type === 'earn' && Math.random() < 0.6) {
      item.data.expiry_date = iso(plusDays(date, randInt(180, 365)))
    }
    return item
  } else if (r < 0.8) {
    // CouponTransaction
    const status = randChoice(['applied', 'redeemed', 'expired'])
    const date = randomDateWithinMonths(6)
    const couponId = randChoice(couponList)
    const item = {
      name: status === 'expired' ? 'coupon_expired' : status === 'redeemed' ? 'coupon_redeemed' : 'coupon_applied',
      anonymous_id: membershipId,
      external_id: membershipId,
      data: {
        coupon_transaction_id: rid('ctxn'),
        membership_id: membershipId,
        coupon_id: couponId,
        coupon_name: couponNameById[couponId],
        status,
        transaction_date: iso(date),
        points_used: status === 'redeemed' ? randInt(100, 1000) : 0,
        store_id: randChoice(stores),
        expiry_date: status === 'expired' ? iso(plusDays(date, -randInt(1, 30))) : iso(plusDays(date, randInt(7, 60))),
      },
    }
    return item
  } else {
    // ReceiptUpload
    const status = randChoice(['pending', 'verified', 'rejected'])
    const date = randomDateWithinMonths(6)
    const amount = Math.round((Math.random() * 3000 + 5) * 100) / 100
    const receiptId = rid('rcpt')
    const item = {
      name: status === 'verified' ? 'receipt_verified' : status === 'rejected' ? 'receipt_rejected' : 'receipt_uploaded',
      anonymous_id: membershipId,
      external_id: membershipId,
      data: {
        receipt_id: receiptId,
        membership_id: membershipId,
        upload_date: iso(date),
        amount,
        merchant_name: randChoice(merchants),
        store_id: randChoice(stores),
        image_url: `https://picsum.photos/seed/${receiptId}/600/800`,
        status,
      },
    }
    if (status === 'verified') {
      item.data.points_earned = Math.max(1, Math.round(amount))
    }
    return item
  }
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function postEventsWithRetry(events, attempt = 1) {
  try {
    return await httpPost(joinUrl(CONFIG.clientPath, 'events'), events)
  } catch (e) {
    if (attempt >= 3) throw e
    const backoff = 500 * attempt
    console.warn(`Batch failed (attempt ${attempt}). Retrying in ${backoff}ms...`, String(e))
    await sleep(backoff)
    return postEventsWithRetry(events, attempt + 1)
  }
}

async function main() {
  console.log('\n=== Parcelvoy Sample Data Generator ===')
  console.log('Base URL:', CONFIG.baseUrl)
  console.log('Single-member ID:', CONFIG.membershipId)
  console.log('Members to create:', CONFIG.members)
  console.log('Count:', CONFIG.count, 'Batch Size:', CONFIG.batchSize)

  if (CONFIG.members > 0 && CONFIG.scenario === 'cardigan') {
    const segments = ['new_joiners', 'repeat_buyers', 'lapsed_members', 'high_spenders_seasonal', 'promo_sensitive']
    const counts = {}
    const base = Math.floor(CONFIG.members / segments.length)
    let rem = CONFIG.members % segments.length
    for (const s of segments) { counts[s] = base }
    for (let i = 0; i < segments.length && rem > 0; i++) { counts[segments[i]] += 1; rem -= 1 }
    console.log(`\nCreating ${CONFIG.members} members for Knit Cardigan Loyalty Program scenario...`)
    const created = []
    for (const s of segments) {
      for (let i = 0; i < counts[s]; i++) {
        const p = generateMemberPayloadForSegment(s)
        try {
          await identifyUser(p)
          created.push({ segment: s, payload: p })
        } catch (e) {
          console.warn('Identify failed for', p.external_id, String(e))
        }
        await sleep(50)
      }
    }
    console.log(`Members created: ${created.length}`)

    if (CONFIG.onlyMembers) {
      console.log('\nOnly members creation requested. Skipping events.')
      return
    }

    console.log(`\nGenerating automation and purchase events for scenario...`)
    const allEvents = []
    for (const m of created) {
      const mid = m.payload.external_id
      const regDate = m.payload.data.registration_date ? new Date(m.payload.data.registration_date) : new Date()
      if (m.segment === 'new_joiners') {
        allEvents.push(...generateWelcomeJourneyEvents(mid, regDate))
      } else if (m.segment === 'repeat_buyers') {
        allEvents.push(...generateRepeatBuyerEvents(mid))
      } else if (m.segment === 'lapsed_members') {
        allEvents.push(...generateLapsedMemberEvents(mid))
      } else if (m.segment === 'high_spenders_seasonal') {
        allEvents.push(...generateHighSpenderSeasonalEvents(mid))
      } else if (m.segment === 'promo_sensitive') {
        allEvents.push(...generatePromotionSensitiveEvents(mid))
      }
    }

    const batches = chunk(allEvents, CONFIG.batchSize)
    let sent = 0
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]
      console.log(`Posting batch ${i + 1}/${batches.length} (size=${batch.length})...`)
      const res = await postEventsWithRetry(batch)
      sent += batch.length
      console.log('Batch result:', res)
      await sleep(200)
    }
    console.log(`\nDone. Members: ${created.length}, Events sent: ${sent}`)
    return
  }

  if (CONFIG.members > 0) {
    console.log(`\nCreating ${CONFIG.members} random members...`)
    const members = await createRandomMembers(CONFIG.members)
    console.log(`Members created: ${members.length}`)

    if (CONFIG.onlyMembers) {
      console.log('\nOnly members creation requested. Skipping events.')
      return
    }

    let per = (typeof CONFIG.eventsPerMember === 'number' && CONFIG.eventsPerMember > 0)
      ? CONFIG.eventsPerMember
      : Math.max(1, Math.floor(CONFIG.count / Math.max(1, members.length)))

    console.log(`\nGenerating ${per} events per member (~${per * members.length} total)...`)
    const allEvents = []
    for (const m of members) {
      for (let i = 0; i < per; i++) {
        allEvents.push(generateRandomEvent(m.external_id))
      }
    }

    const batches = chunk(allEvents, CONFIG.batchSize)
    let sent = 0
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]
      console.log(`Posting batch ${i + 1}/${batches.length} (size=${batch.length})...`)
      const res = await postEventsWithRetry(batch)
      sent += batch.length
      console.log('Batch result:', res)
      await sleep(200)
    }
    console.log(`\nDone. Members: ${members.length}, Events sent: ${sent}`)
    return
  }

  // Single-member mode (backward compatible)
  console.log('\nCreating single member and posting events...')
  await identifyUser()

  console.log(`\nGenerating ${CONFIG.count} randomized events...`)
  const events = Array.from({ length: CONFIG.count }, () => generateRandomEvent(CONFIG.membershipId))

  const batches = chunk(events, CONFIG.batchSize)
  let sent = 0
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]
    console.log(`Posting batch ${i + 1}/${batches.length} (size=${batch.length})...`)
    const res = await postEventsWithRetry(batch)
    sent += batch.length
    console.log('Batch result:', res)
    await sleep(200)
  }

  console.log(`\nDone. Events sent: ${sent}`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
