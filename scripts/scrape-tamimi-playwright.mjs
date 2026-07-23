#!/usr/bin/env node
/**
 * Tamimi Markets scraper — runs locally, not on Vercel.
 *
 * The old lib/scrapers/tamimi.ts found nothing: shop.tamimimarkets.com is a
 * client-rendered Zopsmart storefront, so a server-side fetch sees no products.
 * Its /api/product endpoint lists all 17k items but returns them *without
 * prices* (price is per-branch and only resolved in the browser), so the
 * catalogue still has to be read from the rendered page.
 *
 * Unlike Carrefour, product images sit on a public bucket that serves everyone,
 * so image coverage here is effectively complete.
 *
 * Run:
 *   node scripts/scrape-tamimi-playwright.mjs --key=$APP_SECRET
 *
 * Options:
 *   --key=      APP_SECRET (or set APP_SECRET in the environment)
 *   --site=     target site (default https://sa.smartcopons.com)
 *   --dry       scrape and print, do not upload
 *   --headed    show the browser (useful when the markup changes)
 *   --limit=N   stop after N categories
 *   --deals     keep only discounted items
 */

import { chromium } from 'playwright'

const BASE = 'https://shop.tamimimarkets.com'

const NAV_TIMEOUT = 60_000
const MAX_SCROLLS = 14
const SCROLL_WAIT = 1300
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

if (!KEY && !DRY) {
  console.error('Missing --key=$APP_SECRET (or run with --dry)')
  process.exit(1)
}

/**
 * Runs inside the page. Every product renders as
 *   div[class*="Product__StyledContainer"]
 * whose innerText is, for a discounted item:
 *   "45% خصم" / "10.95" / "19.95" / "اسم المنتج-40 X 330 مل"
 * and for a plain one just the price and the name.
 */
function extractCards() {
  const out = []

  document.querySelectorAll('[class*="Product__StyledContainer"]').forEach(card => {
    const lines = (card.innerText || '')
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
    if (!lines.length) return

    const nums = (card.innerText || '').match(/\d[\d,]*\.\d{2}/g) || []
    if (!nums.length) return

    // Current price first, struck-through original second.
    const price = parseFloat(nums[0].replace(/,/g, ''))
    if (!price || price <= 0) return
    const oldRaw = nums[1] ? parseFloat(nums[1].replace(/,/g, '')) : null
    const oldPrice = oldRaw && oldRaw > price ? oldRaw : null

    const name = [...lines]
      .reverse()
      .find(l => !/^\d[\d,]*\.\d{2}$/.test(l) && !/%/.test(l))
    if (!name || name.length < 4) return

    const disc = (card.innerText || '').match(/(\d+)\s*%/)
    const href =
      card.querySelector('a[href]')?.getAttribute('href') ||
      card.closest('a[href]')?.getAttribute('href') ||
      ''

    // Zopsmart appends the pack size to the name after the last dash:
    //   "مياه معدنية معبأة-40 X 330 مل"
    const dash = name.lastIndexOf('-')
    const tail = dash > 0 ? name.slice(dash + 1).trim() : ''
    const sizeText = /\d/.test(tail) && tail.length <= 24 ? tail : null

    out.push({
      name,
      price,
      oldPrice,
      discountPercent: disc ? parseInt(disc[1], 10) : null,
      sizeText,
      imageUrl: card.querySelector('img')?.src?.split('?')[0] || null,
      url: href.split('?')[0],
    })
  })

  return out
}

/** Category pages ignore ?page=N — they load more only on scroll. */
async function scrapeCategory(page, cat) {
  const url = `${BASE}/ar/category/${cat.slug}`
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT })
    await page
      .waitForSelector('[class*="Product__StyledContainer"]', { timeout: 20_000 })
      .catch(() => {})

    let prev = 0
    for (let i = 0; i < MAX_SCROLLS; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await page.waitForTimeout(SCROLL_WAIT)
      const n = await page.evaluate(
        () => document.querySelectorAll('[class*="Product__StyledContainer"]').length
      )
      // Two passes with no growth means the list is exhausted.
      if (n === prev && i > 1) break
      prev = n
    }

    const rows = await page.evaluate(extractCards)
    console.log(`   ${rows.length} منتج`)
    return rows
  } catch (err) {
    console.log(`   فشل: ${err.message.slice(0, 80)}`)
    return []
  }
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
  } catch (err) {
    console.log(`Chrome unavailable, falling back to bundled Chromium`)
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
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT })
  await page.waitForTimeout(5000)

  // Read the tree from the site rather than hardcoding it, so a reshuffled
  // catalogue does not silently shrink the scrape. Leaf categories page better
  // than their parents, so prefer subcategories where they exist.
  const cats = await page.evaluate(async () => {
    const j = await (await fetch('/api/category')).json()
    const top = j.data.category || j.data
    const out = []
    for (const c of top) {
      const subs = c.subCategories || []
      if (subs.length) {
        for (const s of subs) out.push({ slug: s.slug, name: s.name, n: s.productsCount || 0 })
      } else {
        out.push({ slug: c.slug, name: c.name, n: c.productsCount || 0 })
      }
    }
    return out.sort((a, b) => b.n - a.n)
  })

  const LIMIT = args.limit ? parseInt(args.limit, 10) : cats.length
  const targets = cats.slice(0, LIMIT)
  console.log(`Tamimi — ${targets.length} قسماً من ${cats.length}\n`)

  const all = new Map()
  const logs = []

  for (const cat of targets) {
    console.log(`${cat.name} (${cat.slug}, ~${cat.n})`)
    const rows = await scrapeCategory(page, cat)
    let added = 0
    for (const r of rows) {
      const key = r.url || r.name
      if (!all.has(key)) {
        all.set(key, { ...r, category: cat.name })
        added++
      }
    }
    logs.push(`${cat.name}: ${rows.length} (${added} جديد)`)
  }

  await browser.close()

  let offers = Array.from(all.values()).map(r => ({
    nameAr: r.name,
    price: r.price,
    oldPrice: r.oldPrice ?? undefined,
    discountPercent: r.discountPercent ?? undefined,
    sizeText: r.sizeText ?? undefined,
    imageUrl: r.imageUrl ?? undefined,
    sourceUrl: r.url ? `${BASE}${r.url}` : `${BASE}/ar/category`,
    tags: ['tamimi', r.category].join(','),
  }))

  if (DEALS_ONLY) offers = offers.filter(o => o.discountPercent || o.oldPrice)

  const discounted = offers.filter(o => o.discountPercent).length
  const withImage = offers.filter(o => o.imageUrl).length
  const pct = offers.length ? Math.round((withImage / offers.length) * 100) : 0
  console.log(
    `\nالمجموع: ${offers.length} منتجاً فريداً ` +
      `(${discounted} بخصم، ${withImage} بصورة — ${pct}%)`
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

  if (DRY) {
    console.log('\n--dry: لن يتم الرفع.')
    return
  }

  // The import route caps a single payload, so send in batches. Only the first
  // batch may create the flyer; the rest attach to it via the same ingest path.
  console.log(`\nالرفع إلى ${SITE} ...`)
  for (let i = 0; i < offers.length; i += BATCH) {
    const chunk = offers.slice(i, i + BATCH)
    const res = await fetch(`${SITE}/api/admin/import-offers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: KEY,
        supermarket: 'tamimi',
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
