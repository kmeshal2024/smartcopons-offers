#!/usr/bin/env node
/**
 * Nahdi Pharmacy scraper — runs locally, not on Vercel.
 *
 * nahdionline.com is client-rendered: category and offer data load through a
 * SKU-tile proxy, so a server fetch and even the top-level /offers URL show
 * nothing. The browseable offers live on PLP pages linked off the homepage —
 * /ar-sa/plp/<name>-offers — which DO render a product grid, so this reads
 * those in a browser like the Al Dawaa scraper.
 *
 * Card text is: "وفر 44 %" / name / "49.94" / "89.70" / "Express" / rating.
 * Prices carry two decimals; discount is "وفر N %".
 *
 * Nahdi has no supermarket row yet, so the first import passes `meta` to create
 * it (see /api/admin/import-offers).
 *
 * Run:
 *   node scripts/scrape-nahdi-playwright.mjs --key=$APP_SECRET
 *
 * Options mirror the other scrapers: --key= --site= --dry --headed --limit=N --out=
 */

import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const BASE = 'https://www.nahdionline.com'
const HOME = `${BASE}/ar-sa/`

const NAV_TIMEOUT = 60_000
const MAX_SCROLLS = 25
const SCROLL_WAIT = 1200
const MAX_PER_PLP = 300 // one offers PLP can hold 2000+; cap it so a run stays sane
const BATCH = 4000

const META = {
  nameAr: 'صيدليات النهدي',
  nameEn: 'Nahdi Pharmacy',
  logo: '/logos/nahdi.png',
  website: 'https://www.nahdionline.com',
}

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? true]
  })
)

const KEY = args.key || process.env.APP_SECRET
const SITE = args.site || 'https://sa.smartcopons.com'
const DRY = !!args.dry

if (!KEY && !DRY) {
  console.error('Missing --key=$APP_SECRET (or run with --dry)')
  process.exit(1)
}

/**
 * Runs inside the page. Each product is an a[href*="/pdp/"]; the nearest
 * price-bearing ancestor reads: discount / name / price / oldPrice / Express /
 * rating. Prices carry two decimals; the rating "3.6(19)" does too, so the
 * price must be read positionally (first two decimals), not "any decimal".
 */
function extractCards() {
  const out = []
  const seen = new Set()

  document.querySelectorAll('a[href*="/pdp/"]').forEach(a => {
    const href = a.getAttribute('href') || ''
    const sku = (href.match(/\/pdp\/(\d+)/) || [])[1]
    if (!sku || seen.has(sku)) return

    let card = a
    for (let i = 0; i < 7 && card; i++) {
      if (/\d+\.\d{2}/.test(card.innerText || '')) break
      card = card.parentElement
    }
    if (!card) return

    const lines = (card.innerText || '')
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)

    // Prices: two-decimal tokens that are NOT the rating "3.6(19)".
    const priceLines = lines.filter(l => /^\d[\d,]*\.\d{2}$/.test(l))
    if (!priceLines.length) return
    const price = parseFloat(priceLines[0].replace(/,/g, ''))
    if (!price || price <= 0) return
    const oldRaw = priceLines[1] ? parseFloat(priceLines[1].replace(/,/g, '')) : null
    const oldPrice = oldRaw && oldRaw > price ? oldRaw : null

    // Discount: explicit "وفر N %", else derived from old/new.
    const discM = (card.innerText || '').match(/وفر\s*(\d+)\s*%/)
    const discountPercent = discM
      ? parseInt(discM[1], 10)
      : oldPrice
        ? Math.round(((oldPrice - price) / oldPrice) * 100)
        : null

    // Name: the longest line that is not a price, discount, rating, or badge.
    const name = lines
      .filter(l =>
        !/^\d[\d,]*\.\d{2}$/.test(l) &&
        !/وفر\s*\d+\s*%|^Express$|^\d\.\d\(\d+\)$|^\(\d+\)$/.test(l)
      )
      .sort((x, y) => y.length - x.length)[0]
    if (!name || name.length < 5) return

    seen.add(sku)
    out.push({
      sku,
      name,
      price,
      oldPrice,
      discountPercent,
      imageUrl: card.querySelector('img')?.src?.split('?')[0] || null,
      url: href.split('?')[0],
    })
  })

  return out
}

async function settle(page) {
  let prev = 0
  let stalePasses = 0
  for (let pass = 0; pass < MAX_SCROLLS; pass++) {
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y)
        await new Promise(r => setTimeout(r, 250))
      }
    })
    await page.waitForTimeout(SCROLL_WAIT)
    const n = await page.evaluate(() => document.querySelectorAll('a[href*="/pdp/"]').length)
    if (n >= MAX_PER_PLP) break
    if (n === prev) {
      if (++stalePasses >= 2) break
    } else {
      stalePasses = 0
    }
    prev = n
  }
}

async function scrapeUrl(page, url, label) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT })
    await page.waitForSelector('a[href*="/pdp/"]', { timeout: 20_000 }).catch(() => {})
    // The tile grid isn't wired to its scroll observers the instant it paints.
    await page.waitForTimeout(5000)
    await settle(page)
    const rows = await page.evaluate(extractCards)
    console.log(`   ${label}: ${rows.length} منتج`)
    return rows
  } catch (err) {
    console.log(`   ${label}: فشل — ${err.message.slice(0, 70)}`)
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

  // Offer PLPs are linked off the homepage as /ar-sa/plp/<name>-offers.
  await page.goto(HOME, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT })
  await page.waitForTimeout(6000)
  await page.evaluate(async () => {
    for (let y = 0; y < 5000; y += 600) {
      window.scrollTo(0, y)
      await new Promise(r => setTimeout(r, 300))
    }
  })
  const plps = await page.evaluate(() => {
    const set = new Set()
    document.querySelectorAll('a[href*="/plp/"]').forEach(a => {
      const h = (a.getAttribute('href') || '').split('?')[0]
      if (/offer|عرو|deal|promo/i.test(h)) set.add(h)
    })
    return [...set]
  })

  if (plps.length === 0) {
    console.error('لم يُعثر على صفحات عروض — قد تكون البنية تغيّرت. أعد التشغيل بـ --headed.')
    await browser.close()
    process.exit(1)
  }

  const limit = args.limit ? parseInt(args.limit, 10) : plps.length
  const targets = plps.slice(0, limit)
  console.log(`النهدي — ${targets.length} صفحة عروض\n`)

  const all = new Map()
  const logs = []
  for (const h of targets) {
    const url = h.startsWith('http') ? h : BASE + h
    const label = h.split('/').pop() || h
    const rows = await scrapeUrl(page, url, label)
    let added = 0
    for (const r of rows) {
      if (!all.has(r.sku)) {
        all.set(r.sku, r)
        added++
      }
    }
    logs.push(`${label}: ${rows.length} (${added} جديد)`)
  }

  await browser.close()

  const offers = [...all.values()].map(r => ({
    nameAr: r.name,
    price: r.price,
    oldPrice: r.oldPrice ?? undefined,
    discountPercent: r.discountPercent ?? undefined,
    imageUrl: r.imageUrl ?? undefined,
    sourceUrl: r.url ? `${BASE}${r.url}` : HOME,
    tags: ['nahdi', r.sku].join(','),
  }))

  const discounted = offers.filter(o => o.discountPercent).length
  const withImage = offers.filter(o => o.imageUrl).length
  const pct = offers.length ? Math.round((withImage / offers.length) * 100) : 0
  console.log(`\nالمجموع: ${offers.length} منتجاً فريداً (${discounted} بخصم، ${withImage} بصورة — ${pct}%)`)

  if (offers.length === 0) {
    console.error('لا نتائج.')
    process.exit(1)
  }

  console.log('\nعيّنة:')
  offers.slice(0, 3).forEach(o =>
    console.log(`  ${o.nameAr.slice(0, 45)} — ${o.price} ر.س${o.discountPercent ? ` (-${o.discountPercent}%)` : ''}`)
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
        supermarket: 'nahdi',
        meta: META,
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
