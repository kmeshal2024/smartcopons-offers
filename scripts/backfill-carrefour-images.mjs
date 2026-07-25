#!/usr/bin/env node
/**
 * Fill in the Carrefour product images the catalogue scrape misses.
 *
 * Carrefour image URLs carry a per-product timestamp that cannot be derived:
 *   https://cdn.mafrservices.com/pim-content/SAU/media/product/{sku}/{ts}/{sku}_main.jpg
 * The listing pages only request the image for rows the scroll actually reaches,
 * so scrape-carrefour-playwright.mjs lands around 40%. Each product PAGE, on the
 * other hand, always carries the full URL in its og:image — so this walks the
 * products still missing one and reads it from there.
 *
 * Deliberately incremental: it processes a batch, uploads, and stops. Run it
 * nightly (it is part of run-daily-scrapers.mjs) and coverage climbs over a few
 * days instead of blocking one very long run.
 *
 * Run:
 *   node scripts/backfill-carrefour-images.mjs --key=$APP_SECRET --limit=300
 *
 * Options:
 *   --key=      APP_SECRET (or set APP_SECRET in the environment)
 *   --site=     target site (default https://sa.smartcopons.com)
 *   --limit=N   how many products to attempt this run (default 300)
 *   --headed    show the browser
 */

import { chromium } from 'playwright'

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? true]
  })
)

const KEY = args.key || process.env.APP_SECRET
const SITE = args.site || 'https://sa.smartcopons.com'
const LIMIT = args.limit ? parseInt(args.limit, 10) : 300
const NAV_TIMEOUT = 25_000
const UPLOAD_EVERY = 50

if (!KEY) {
  console.error('Missing --key=$APP_SECRET')
  process.exit(1)
}

async function upload(images) {
  if (!images.length) return 0
  const res = await fetch(`${SITE}/api/admin/product-images`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: KEY, images }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.log(`  رفع فشل: HTTP ${res.status} ${JSON.stringify(body).slice(0, 120)}`)
    return 0
  }
  return body.updated || 0
}

async function main() {
  const listRes = await fetch(
    `${SITE}/api/admin/product-images?key=${encodeURIComponent(KEY)}&supermarket=carrefour&limit=${LIMIT}`
  )
  if (!listRes.ok) {
    console.error(`تعذّر جلب القائمة: HTTP ${listRes.status}`)
    process.exit(1)
  }
  const { products, remaining } = await listRes.json()
  console.log(`بلا صورة: ${remaining} — سنعالج ${products.length} في هذه الجولة\n`)
  if (!products.length) return

  // Real Chrome: Akamai refuses the bundled headless shell (ERR_HTTP2_PROTOCOL_ERROR).
  const channel = args.channel === 'chromium' ? undefined : args.channel || 'chrome'
  let browser
  try {
    browser = await chromium.launch({
      headless: !args.headed,
      channel,
      args: ['--disable-blink-features=AutomationControlled', '--disable-http2', '--no-sandbox'],
    })
  } catch {
    browser = await chromium.launch({
      headless: !args.headed,
      args: ['--disable-blink-features=AutomationControlled', '--disable-http2', '--no-sandbox'],
    })
  }

  const context = await browser.newContext({
    locale: 'ar-SA',
    timezoneId: 'Asia/Riyadh',
    viewport: { width: 1280, height: 900 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    extraHTTPHeaders: { 'Accept-Language': 'ar-SA,ar;q=0.9,en;q=0.8' },
  })
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
  })
  // Don't download the images themselves — we only need their URLs.
  await context.route('**/*.{png,jpg,jpeg,webp,gif,svg,woff,woff2,css}', r => r.abort())

  const page = await context.newPage()
  let found = 0
  let uploaded = 0
  let pending = []

  for (let i = 0; i < products.length; i++) {
    const p = products[i]
    if (!p.sourceUrl) continue
    try {
      await page.goto(p.sourceUrl, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT })
      const img = await page.evaluate(() => {
        // Carrefour serves product images from two different paths on the same
        // CDN — /pim-content/SAU/media/product/... on listings and
        // /sys-master-root/... on product pages. Accept either; an earlier
        // version only matched pim-content and threw away 80% of valid hits.
        const ok = u => /cdn\.mafrservices\.com/.test(u) && /\.(jpg|jpeg|png|webp)/i.test(u)
        const og = document.querySelector('meta[property="og:image"]')?.getAttribute('content')
        if (og && ok(og)) return og.split('?')[0]
        for (const s of Array.from(document.querySelectorAll('script[type="application/ld+json"]'))) {
          const m = (s.textContent || '').match(
            /https:[^"'\s]*cdn\.mafrservices\.com[^"'\s]*\.(?:jpg|jpeg|png|webp)/i
          )
          if (m) return m[0].replace(/\\\//g, '/').split('?')[0]
        }
        const el = Array.from(document.querySelectorAll('img')).find(x => ok(x.getAttribute('src') || ''))
        return el ? (el.getAttribute('src') || '').split('?')[0] : null
      })
      if (img) {
        pending.push({ id: p.id, imageUrl: img })
        found++
      }
    } catch {
      /* one bad page must not end the run */
    }

    if (pending.length >= UPLOAD_EVERY) {
      uploaded += await upload(pending)
      pending = []
    }
    if ((i + 1) % 25 === 0) {
      console.log(`   ${i + 1}/${products.length} — وُجدت ${found} صورة`)
    }

    // Pace the requests. Hammering product pages back-to-back gets throttled:
    // an unpaced 500-page run scored 98% for the first 300 and then collapsed
    // to ~5%, ending at 61% overall. A short gap keeps the hit rate high.
    await new Promise(r => setTimeout(r, 400 + Math.floor(Math.random() * 400)))
  }

  uploaded += await upload(pending)
  await browser.close()

  const pct = products.length ? Math.round((found / products.length) * 100) : 0
  console.log(`\nوُجدت ${found}/${products.length} صورة (${pct}%) — حُفظت ${uploaded}`)
  console.log(`متبقٍ بلا صورة: ${Math.max(0, remaining - uploaded)}`)
}

main().catch(err => {
  console.error('Failed:', err)
  process.exit(1)
})
