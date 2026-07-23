#!/usr/bin/env node
/**
 * LuLu Hypermarket KSA scraper — runs locally, not on Vercel.
 *
 * An earlier attempt used LuLu's widget API. It worked, but returned prices in
 * AED regardless of the currency cookie, which is worse than no data on a Saudi
 * price-comparison site. The /ar-sa/ storefront does not have that problem:
 * the same SKU renders 49.95 there and 37.90 on /ae/, so those numbers really
 * are the Saudi ones. That is why this reads the rendered page instead.
 *
 * Category landing pages (/ar-sa/grocery/) only ever show 24 items and ignore
 * ?page=N. The real listing is /ar-sa/list/?category_ids=N, which paginates
 * properly at 20 per page — that is what this walks.
 *
 * Run:
 *   node scripts/scrape-lulu-playwright.mjs --key=$APP_SECRET
 *
 * Options:
 *   --key=      APP_SECRET (or set APP_SECRET in the environment)
 *   --site=     target site (default https://sa.smartcopons.com)
 *   --dry       scrape and print, do not upload
 *   --out=      write the scraped offers to a JSON file before uploading
 *   --headed    show the browser (useful when the markup changes)
 *   --pages=N   max list pages per category (default 12 = 240 products)
 *   --limit=N   stop after N categories
 *   --deals     keep only discounted items
 */

import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const BASE = 'https://gcc.luluhypermarket.com'

// Roots to expand. Their children are discovered at runtime, so a reshuffled
// catalogue widens or narrows the crawl instead of silently shrinking it.
const SEED_IDS = ['5017', '5250', '5360', '5239', '5237', '5240', '5232']

const NAV_TIMEOUT = 50_000
const BATCH = 4000 // /api/admin/import-offers rejects payloads over 5000

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? true]
  })
)

const KEY = args.key || process.env.APP_SECRET
const SITE = args.site || 'https://sa.smartcopons.com'
const DRY = !!args.dry
const DEALS_ONLY = !!args.deals
const MAX_PAGES = args.pages ? parseInt(args.pages, 10) : 12

if (!KEY && !DRY) {
  console.error('Missing --key=$APP_SECRET (or run with --dry)')
  process.exit(1)
}

const listUrl = (id, page) =>
  `${BASE}/ar-sa/list/?category_ids=${id}&sorter=-discount_ratio&page=${page}`

/**
 * Runs inside the page. A card's innerText is, in order:
 *   rating / brand / name / price / old price / "17% OFF"
 * with the last three optional.
 */
function extractCards() {
  const out = []
  const seen = new Set()

  document.querySelectorAll('a[href*="/p/"]').forEach(a => {
    const href = a.getAttribute('href') || ''
    const sku = (href.match(/\/p\/(\d+)/) || [])[1]
    if (!sku || seen.has(sku)) return

    // Walk up until the ancestor that actually holds the price.
    let card = a
    for (let i = 0; i < 6 && card; i++) {
      if (/\d+\.\d{2}/.test(card.innerText || '')) break
      card = card.parentElement
    }
    if (!card) return

    const text = card.innerText || ''
    const nums = text.match(/\d[\d,]*\.\d{2}/g) || []
    if (!nums.length) return

    const price = parseFloat(nums[0].replace(/,/g, ''))
    if (!price || price <= 0) return
    const oldRaw = nums[1] ? parseFloat(nums[1].replace(/,/g, '')) : null
    const oldPrice = oldRaw && oldRaw > price ? oldRaw : null

    const lines = text
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
    // The name is the longest line that is neither a price, a percentage, nor
    // the bare rating number the card opens with.
    const name = lines
      .filter(l => !/^\d[\d,]*(\.\d{2})?$/.test(l) && !/%/.test(l))
      .sort((x, y) => y.length - x.length)[0]
    if (!name || name.length < 5) return

    const disc = text.match(/(\d+)\s*%/)

    seen.add(sku)
    out.push({
      sku,
      name,
      price,
      oldPrice,
      discountPercent: disc ? parseInt(disc[1], 10) : null,
      imageUrl: card.querySelector('img')?.src?.split('?')[0] || null,
      url: href.split('?')[0],
    })
  })

  return out
}

/** Scroll until the product count stops growing — the grid lazy-loads. */
async function settle(page) {
  let prev = 0
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(1100)
    const n = await page.evaluate(
      () => new Set([...document.querySelectorAll('a[href*="/p/"]')].map(a => a.getAttribute('href'))).size
    )
    if (n === prev && i > 1) break
    prev = n
  }
}

async function discoverCategories(page) {
  const found = new Map()

  for (const seed of SEED_IDS) {
    try {
      await page.goto(listUrl(seed, 1), { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT })
      await page.waitForTimeout(6000)
      const kids = await page.evaluate(() => {
        const out = []
        document.querySelectorAll('a[href*="category_ids="]').forEach(a => {
          const id = (a.getAttribute('href').match(/category_ids=(\d+)/) || [])[1]
          const label = (a.innerText || '').trim().replace(/\s+/g, ' ')
          const count = parseInt((label.match(/\((\d[\d,]*)\)/) || [])[1]?.replace(/,/g, '') || '0', 10)
          if (id) out.push({ id, name: label.replace(/\s*\(.*$/, ''), count })
        })
        return out
      })
      for (const k of kids) {
        if (!found.has(k.id) && k.name) found.set(k.id, k)
      }
      // Keep the seed itself: some have no children exposed.
      if (!found.has(seed)) found.set(seed, { id: seed, name: `قسم ${seed}`, count: 0 })
    } catch (err) {
      console.log(`  تخطّي ${seed}: ${err.message.slice(0, 60)}`)
    }
  }

  return [...found.values()].sort((a, b) => b.count - a.count)
}

async function scrapeCategory(page, cat) {
  const collected = new Map()

  for (let p = 1; p <= MAX_PAGES; p++) {
    try {
      await page.goto(listUrl(cat.id, p), { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT })
      await page.waitForSelector('a[href*="/p/"]', { timeout: 15_000 }).catch(() => {})
      await settle(page)

      const rows = await page.evaluate(extractCards)
      let added = 0
      for (const r of rows) {
        if (!collected.has(r.sku)) {
          collected.set(r.sku, r)
          added++
        }
      }
      // The listing repeats the last page once it runs out.
      if (added === 0) break
    } catch (err) {
      console.log(`   صفحة ${p} فشلت: ${err.message.slice(0, 60)}`)
      break
    }
  }

  console.log(`   ${collected.size} منتج`)
  return [...collected.values()]
}

async function main() {
  const channel = args.channel === 'chromium' ? undefined : args.channel || 'chrome'
  let browser
  try {
    browser = await chromium.launch({
      headless: !args.headed,
      channel,
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    })
  } catch {
    console.log('Chrome unavailable, falling back to bundled Chromium')
    browser = await chromium.launch({
      headless: !args.headed,
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    })
  }

  const context = await browser.newContext({
    locale: 'ar-SA',
    timezoneId: 'Asia/Riyadh',
    viewport: { width: 1366, height: 1400 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    extraHTTPHeaders: { 'Accept-Language': 'ar-SA,ar;q=0.9,en;q=0.8' },
  })
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
  })

  const page = await context.newPage()

  console.log('استكشاف الأقسام ...')
  const cats = await discoverCategories(page)
  const LIMIT = args.limit ? parseInt(args.limit, 10) : cats.length
  const targets = cats.slice(0, LIMIT)
  console.log(`LuLu — ${targets.length} قسماً من ${cats.length}\n`)

  const all = new Map()
  const logs = []

  for (const cat of targets) {
    console.log(`${cat.name} (${cat.id}, ~${cat.count})`)
    const rows = await scrapeCategory(page, cat)
    let added = 0
    for (const r of rows) {
      if (!all.has(r.sku)) {
        all.set(r.sku, { ...r, category: cat.name })
        added++
      }
    }
    logs.push(`${cat.name}: ${rows.length} (${added} جديد)`)
  }

  await browser.close()

  let offers = [...all.values()].map(r => ({
    nameAr: r.name,
    price: r.price,
    oldPrice: r.oldPrice ?? undefined,
    discountPercent: r.discountPercent ?? undefined,
    imageUrl: r.imageUrl ?? undefined,
    sourceUrl: `${BASE}${r.url}`,
    tags: ['lulu', r.category, r.sku].join(','),
  }))

  if (DEALS_ONLY) offers = offers.filter(o => o.discountPercent || o.oldPrice)

  const discounted = offers.filter(o => o.discountPercent).length
  const withImage = offers.filter(o => o.imageUrl).length
  const pct = offers.length ? Math.round((withImage / offers.length) * 100) : 0
  console.log(
    `\nالمجموع: ${offers.length} منتجاً فريداً (${discounted} بخصم، ${withImage} بصورة — ${pct}%)`
  )

  if (offers.length === 0) {
    console.error('لا نتائج — قد تكون البنية تغيّرت. أعد التشغيل بـ --headed للفحص.')
    process.exit(1)
  }

  console.log('\nعيّنة:')
  offers
    .slice(0, 3)
    .forEach(o =>
      console.log(
        `  ${o.nameAr.slice(0, 45)} — ${o.price} ر.س${o.discountPercent ? ` (-${o.discountPercent}%)` : ''}`
      )
    )

  if (args.out) {
    writeFileSync(args.out, JSON.stringify(offers))
    console.log(`\nحُفظت ${offers.length} عرضاً في ${args.out}`)
  }

  if (DRY) {
    console.log('\n--dry: لن يتم الرفع.')
    return
  }

  console.log(`\nالرفع إلى ${SITE} ...`)
  for (let i = 0; i < offers.length; i += BATCH) {
    const chunk = offers.slice(i, i + BATCH)
    const res = await fetch(`${SITE}/api/admin/import-offers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: KEY,
        supermarket: 'lulu',
        offers: chunk,
        logs: i === 0 ? logs : [`دفعة ${i / BATCH + 1}`],
      }),
    })
    const text = await res.text()
    console.log(`  دفعة ${i / BATCH + 1} (${chunk.length}): HTTP ${res.status} — ${text.slice(0, 220)}`)
    if (!res.ok) process.exit(1)
  }
}

main().catch(err => {
  console.error('Failed:', err)
  process.exit(1)
})
