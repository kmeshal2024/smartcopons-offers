#!/usr/bin/env node
/**
 * Al Dawaa Pharmacy scraper — runs locally, not on Vercel.
 *
 * al-dawaa.com is a client-rendered SAP Commerce storefront: a server-side
 * fetch sees no products, so this reads the rendered offer pages in a browser,
 * like the Tamimi/LuLu scrapers. The offers live under /ar/offers/c/offers plus
 * a set of offer subcategories linked from it, each an infinite-scroll grid.
 *
 * Prices and loyalty points are both numbers on the card, but only prices carry
 * two decimals ("99.95 131.88") while points are plain integers ("1,931 نقطة"),
 * so a two-decimal regex cleanly separates them.
 *
 * This retailer has no supermarket row yet, so the first import passes `meta`
 * to /api/admin/import-offers to create it.
 *
 * Run:
 *   node scripts/scrape-aldawaa-playwright.mjs --key=$APP_SECRET
 *
 * Options mirror the other scrapers: --key= --site= --dry --headed --limit=N --out=
 */

import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const BASE = 'https://www.al-dawaa.com'
const OFFERS_URL = `${BASE}/ar/offers/c/offers`

const NAV_TIMEOUT = 60_000
const MAX_SCROLLS = 30
const SCROLL_WAIT = 1300
const BATCH = 4000

const META = {
  nameAr: 'صيدليات الدواء',
  nameEn: 'Al Dawaa Pharmacy',
  logo: '/logos/aldawaa.png',
  website: 'https://www.al-dawaa.com',
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
 * Runs inside the page. Each product is an a[href*="/p/"] whose nearest
 * price-bearing ancestor reads:
 *   name / "99.95 131.88" / promo label / "احصل على N نقطة" ...
 * Points have no decimals, so /\d[\d,]*\.\d{2}/ matches only the real prices.
 */
function extractCards() {
  const out = []
  const seen = new Set()

  document.querySelectorAll('a[href*="/p/"]').forEach(a => {
    const href = a.getAttribute('href') || ''
    const code = (href.match(/\/p\/(\d+)/) || [])[1]
    if (!code || seen.has(code)) return

    let card = a
    for (let i = 0; i < 7 && card; i++) {
      if (/\d[\d,]*\.\d{2}/.test(card.innerText || '')) break
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

    // Name: the first line that is neither a price nor a loyalty-points line.
    const name = text
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
      .find(l => !/\d[\d,]*\.\d{2}/.test(l) && !/نقطة|احصل على|اشتريه/.test(l))
    if (!name || name.length < 5) return

    seen.add(code)
    out.push({
      code,
      name,
      price,
      oldPrice,
      discountPercent: oldPrice ? Math.round(((oldPrice - price) / oldPrice) * 100) : null,
      // Keep the full URL: Al Dawaa's media host returns 400 without the
      // `?context=` token, so stripping the query broke every image.
      imageUrl: card.querySelector('img')?.src || null,
      url: href.split('?')[0],
    })
  })

  return out
}

async function settle(page) {
  let prev = 0
  let stalePasses = 0
  for (let pass = 0; pass < MAX_SCROLLS; pass++) {
    // Incremental steps, not a jump to the bottom: the lazy grid loads the next
    // batch off intersection observers, and leaping straight to scrollHeight
    // skips them — that capped this scraper at the first 56 of ~216.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y)
        await new Promise(r => setTimeout(r, 250))
      }
    })
    await page.waitForTimeout(SCROLL_WAIT)
    const n = await page.evaluate(() => document.querySelectorAll('a[href*="/p/"]').length)
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
    await page.waitForSelector('a[href*="/p/"]', { timeout: 20_000 }).catch(() => {})
    // The infinite-scroll observer isn't wired up the instant the first tile
    // paints; scrolling too soon loads nothing and settle() stops at the first
    // batch (this capped the grid at 56 instead of 200+).
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

  // The main offers grid, plus the offer subcategories linked off it — one
  // grid caps at a few hundred, so the subcategories are what give coverage.
  await page.goto(OFFERS_URL, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT })
  await page.waitForTimeout(5000)
  // Offer subcategories are linked off the main grid but live under /promotions/,
  // /bundle-and-save/ and /our-selection-for-you/ — NOT under /offers/. Match the
  // promo prefixes and skip the full-catalogue categories (/c/10, /c/20…) and
  // the brands index, so this stays an *offers* scrape, not the whole store.
  const subUrls = await page.evaluate(() => {
    const set = new Set()
    document.querySelectorAll('a[href*="/c/"]').forEach(a => {
      const h = (a.getAttribute('href') || '').split('?')[0]
      const isOfferCat = /\/(promotions|bundle-and-save|our-selection-for-you|offers)\//.test(h)
      if (isOfferCat && !/\/c\/(offers|brands)$/.test(h)) set.add(h)
    })
    return [...set]
  })

  const targets = [{ url: OFFERS_URL, label: 'كل العروض' }]
  const limit = args.limit ? parseInt(args.limit, 10) : subUrls.length
  for (const h of subUrls.slice(0, limit)) {
    targets.push({ url: h.startsWith('http') ? h : BASE + h, label: h.split('/').slice(-3, -2)[0] || h.slice(-20) })
  }

  console.log(`الدواء — ${targets.length} صفحة عروض\n`)

  const all = new Map()
  const logs = []
  for (const t of targets) {
    const rows = await scrapeUrl(page, t.url, t.label)
    let added = 0
    for (const r of rows) {
      if (!all.has(r.code)) {
        all.set(r.code, r)
        added++
      }
    }
    logs.push(`${t.label}: ${rows.length} (${added} جديد)`)
  }

  await browser.close()

  const offers = [...all.values()].map(r => ({
    nameAr: r.name,
    price: r.price,
    oldPrice: r.oldPrice ?? undefined,
    discountPercent: r.discountPercent ?? undefined,
    imageUrl: r.imageUrl ?? undefined,
    sourceUrl: r.url ? `${BASE}${r.url}` : `${BASE}/ar/offers/c/offers`,
    tags: ['aldawaa', r.code].join(','),
  }))

  const discounted = offers.filter(o => o.discountPercent).length
  const withImage = offers.filter(o => o.imageUrl).length
  const pct = offers.length ? Math.round((withImage / offers.length) * 100) : 0
  console.log(`\nالمجموع: ${offers.length} منتجاً فريداً (${discounted} بخصم، ${withImage} بصورة — ${pct}%)`)

  if (offers.length === 0) {
    console.error('لا نتائج — قد تكون البنية تغيّرت. أعد التشغيل بـ --headed.')
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
        supermarket: 'aldawaa',
        meta: META, // creates the retailer row on first import (updates logo if it exists)
        // On the first batch, --replace clears the old rows so corrected image
        // URLs actually take effect (the dedup hash ignores imageUrl).
        replace: !!args.replace && i === 0,
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
