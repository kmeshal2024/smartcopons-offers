#!/usr/bin/env node
/**
 * Carrefour KSA scraper — runs locally, not on Vercel.
 *
 * Carrefour sits behind Akamai: a server-side fetch returns a 53-byte HTML
 * shell, so the catalogue is only reachable from a real browser. Running
 * Chromium inside a serverless function is impractical (bundle size, and one
 * page render alone eats much of the 120s limit), so this part runs on a
 * machine with a browser and posts the results to /api/admin/import-offers.
 *
 * Setup (once):
 *   npm i -D playwright
 *   npx playwright install chromium
 *
 * Run:
 *   node scripts/scrape-carrefour-playwright.mjs --key=$APP_SECRET
 *
 * Options:
 *   --key=      APP_SECRET (or set APP_SECRET in the environment)
 *   --site=     target site (default https://sa.smartcopons.com)
 *   --dry       scrape and print, do not upload
 *   --headed    show the browser (useful when the markup changes)
 *   --limit=N   stop after N categories
 */

import { chromium } from 'playwright'

const BASE = 'https://www.carrefourksa.com'

// Category landing pages. Carrefour paginates with ?currentPage=N (0-based).
const CATEGORIES = [
  { slug: 'FKSA1000000', name: 'مستلزمات الأطفال' },
  { slug: 'FKSA1500000', name: 'المواد الغذائية' },
  { slug: 'FKSA1600000', name: 'الطازج' },
  { slug: 'FKSA1660000', name: 'المخبوزات' },
  { slug: 'FKSA1700000', name: 'المشروبات' },
  { slug: 'NFKSA2000000', name: 'العناية الشخصية' },
  { slug: 'NFKSA3000000', name: 'المنزل' },
  { slug: 'FKSA6000000', name: 'عروض' },
]

const PAGES_PER_CATEGORY = 3
const NAV_TIMEOUT = 45_000

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? true]
  })
)

const KEY = args.key || process.env.APP_SECRET
const SITE = args.site || 'https://sa.smartcopons.com'
const DRY = !!args.dry
const LIMIT = args.limit ? parseInt(args.limit, 10) : CATEGORIES.length

if (!KEY && !DRY) {
  console.error('Missing --key=$APP_SECRET (or run with --dry)')
  process.exit(1)
}

/**
 * Runs inside the page. Carrefour renders each product as:
 *   a[href*="/p/"]  ->  parent  ->  parent = the card holding price/discount.
 * Verified against the live DOM; if Carrefour restyles, this is what to fix.
 */
function extractOffers() {
  const rows = []
  const seen = new Set()

  // Product images are not <img src> on the listing — they arrive inside the
  // RSC payload and hydrate on scroll. Build a SKU -> image map from both the
  // raw HTML and whatever has actually rendered.
  //
  // The path carries a per-product timestamp that cannot be guessed:
  //   /pim-content/SAU/media/product/{sku}/{ts}/{sku}_main.jpg
  // Akamai serves these to browsers but returns a 53-byte shell to curl —
  // which is fine, since it is the shopper's browser that loads them.
  const imageBySku = {}
  const html = document.documentElement.outerHTML
  const paths = html.match(/pim-content\\?\/SAU\\?\/media\\?\/product\\?\/\d+\\?\/\d+\\?\/\d+_main\.jpg/g) || []
  for (const p of paths) {
    const clean = p.replace(/\\/g, '')
    const m = clean.match(/product\/(\d+)\//)
    if (m) imageBySku[m[1]] = 'https://cdn.mafrservices.com/' + clean
  }
  document.querySelectorAll('img').forEach(i => {
    const s = i.currentSrc || i.src || ''
    const m = s.match(/product\/(\d+)\/(\d+)\/\1_main\.jpg/)
    if (m) imageBySku[m[1]] = s.split('?')[0]
  })

  document.querySelectorAll('a[href*="/p/"]').forEach(a => {
    const card = a.parentElement?.parentElement
    if (!card) return

    const href = a.getAttribute('href') || ''
    const sku = (href.match(/\/p\/(\d+)/) || [])[1]
    const name = (a.innerText || '').trim()
    if (!sku || !name || seen.has(sku)) return

    const text = (card.innerText || '').replace(/‏|‎/g, '')

    // Current price renders split, e.g. "19 .15 SAR"
    const cur = text.match(/(\d[\d,]*)\s*\.\s*(\d{2})\s*SAR/)
    if (!cur) return
    const price = parseFloat(cur[1].replace(/,/g, '') + '.' + cur[2])
    if (!price || price <= 0) return

    // Struck-through original renders as "SAR 23.95"
    const old = text.match(/SAR\s*([\d,]+\.?\d*)/)
    const oldPrice = old ? parseFloat(old[1].replace(/,/g, '')) : null

    const disc = text.match(/(\d+)%\s*OFF/i)
    const size = (text.match(/\n\s*(\d+(?:\.\d+)?\s*(?:ml|ML|g|G|kg|KG|L|ltr)[^\n]{0,10})\s*\n/) || [])[1]

    seen.add(sku)
    rows.push({
      sku,
      nameAr: name,
      price,
      oldPrice: oldPrice && oldPrice > price ? oldPrice : null,
      discountPercent: disc ? parseInt(disc[1], 10) : null,
      sizeText: size ? size.trim() : null,
      imageUrl: imageBySku[sku] || null,
      url: href.split('?')[0],
    })
  })

  return rows
}

async function scrapeCategory(page, category, imageBySku) {
  const collected = new Map()

  for (let p = 0; p < PAGES_PER_CATEGORY; p++) {
    const url = `${BASE}/mafsau/ar/c/${category.slug}?currentPage=${p}`
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT })
      // Products hydrate after load; wait for the first product link.
      await page.waitForSelector('a[href*="/p/"]', { timeout: 15_000 }).catch(() => {})

      // Walk down the page so lazy-loaded product images actually render —
      // without this pass most rows come back with no image.
      await page.evaluate(async () => {
        // Smaller steps than feel necessary: each one is what triggers the
        // image request we listen for, so scrolling too fast loses images.
        const step = 400
        for (let y = 0; y < document.body.scrollHeight; y += step) {
          window.scrollTo(0, y)
          await new Promise(r => setTimeout(r, 350))
        }
        window.scrollTo(0, document.body.scrollHeight)
        await new Promise(r => setTimeout(r, 1200))
      })
      // Let the last batch of image requests land before extracting.
      await page.waitForTimeout(1200)

      const rows = await page.evaluate(extractOffers)
      let added = 0
      for (const r of rows) {
        if (!collected.has(r.sku)) {
          collected.set(r.sku, r)
          added++
        }
      }
      console.log(`   page ${p + 1}: ${rows.length} found, ${added} new (total ${collected.size})`)

      // No new products means we ran past the last page.
      if (added === 0 && p > 0) break
    } catch (err) {
      console.log(`   page ${p + 1} failed: ${err.message.slice(0, 80)}`)
      break
    }
  }

  return Array.from(collected.values()).map(r => ({
    nameAr: r.nameAr,
    price: r.price,
    oldPrice: r.oldPrice ?? undefined,
    discountPercent: r.discountPercent ?? undefined,
    sizeText: r.sizeText ?? undefined,
    // Prefer the URL seen on the wire: the browser requests the image even
    // when the <img> element still shows a placeholder, so this catches far
    // more than reading the DOM alone.
    imageUrl: imageBySku.get(r.sku) || r.imageUrl || undefined,
    sourceUrl: `${BASE}${r.url}`,
    tags: ['carrefour', category.name, r.sku].join(','),
  }))
}

async function main() {
  console.log(`Carrefour KSA scrape — ${CATEGORIES.slice(0, LIMIT).length} categories\n`)

  // Akamai fingerprints the client. The bundled headless shell gets refused
  // with ERR_HTTP2_PROTOCOL_ERROR, so use the full Chromium build, keep the
  // automation flag off, and let it negotiate HTTP/1.1.
  // Default to the installed Chrome: the bundled headless shell is refused
  // with ERR_HTTP2_PROTOCOL_ERROR, while real Chrome gets through. Pass
  // --channel=chromium to fall back to the bundled build.
  const channel = args.channel === 'chromium' ? undefined : args.channel || 'chrome'
  let browser
  try {
    browser = await chromium.launch({
      headless: !args.headed,
      channel,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-http2',
        '--no-sandbox',
      ],
    })
  } catch (err) {
    console.log(`Chrome unavailable (${err.message.split('\n')[0].slice(0, 60)}), falling back to bundled Chromium`)
    browser = await chromium.launch({
      headless: !args.headed,
      args: ['--disable-blink-features=AutomationControlled', '--disable-http2', '--no-sandbox'],
    })
  }
  const context = await browser.newContext({
    locale: 'ar-SA',
    timezoneId: 'Asia/Riyadh',
    viewport: { width: 1366, height: 900 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    extraHTTPHeaders: {
      'Accept-Language': 'ar-SA,ar;q=0.9,en;q=0.8',
    },
  })

  // navigator.webdriver is the cheapest automation tell.
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
  })

  const page = await context.newPage()

  // Product images never appear as a usable <img src> on listing pages, but the
  // browser still requests them — so read the URLs off the network instead.
  // This lifted image coverage from 8% to 42% at no extra cost.
  const imageBySku = new Map()
  page.on('request', req => {
    const m = req.url().match(/product\/(\d+)\/(\d+)\/\1_main\.jpg/)
    if (m) imageBySku.set(m[1], req.url().split('?')[0])
  })

  const all = new Map()
  const logs = []

  for (const category of CATEGORIES.slice(0, LIMIT)) {
    console.log(`\n${category.name} (${category.slug})`)
    const offers = await scrapeCategory(page, category, imageBySku)
    for (const o of offers) {
      if (!all.has(o.sourceUrl)) all.set(o.sourceUrl, o)
    }
    logs.push(`${category.name}: ${offers.length}`)
  }

  await browser.close()

  const offers = Array.from(all.values())
  const discounted = offers.filter(o => o.discountPercent).length
  const withImage = offers.filter(o => o.imageUrl).length
  const imgPct = offers.length ? Math.round((withImage / offers.length) * 100) : 0
  console.log(
    `\nTotal: ${offers.length} unique products ` +
    `(${discounted} discounted, ${withImage} with an image — ${imgPct}%)`
  )

  if (offers.length === 0) {
    console.error('Nothing collected — the markup may have changed. Re-run with --headed to inspect.')
    process.exit(1)
  }

  console.log('\nSample:')
  offers.slice(0, 3).forEach(o =>
    console.log(`  ${o.nameAr.slice(0, 45)} — ${o.price} SAR${o.discountPercent ? ` (-${o.discountPercent}%)` : ''}`)
  )

  if (DRY) {
    console.log('\n--dry: not uploading.')
    return
  }

  console.log(`\nUploading to ${SITE} ...`)
  const res = await fetch(`${SITE}/api/admin/import-offers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: KEY, supermarket: 'carrefour', offers, logs }),
  })

  const text = await res.text()
  console.log(`HTTP ${res.status}`)
  console.log(text.slice(0, 500))
  if (!res.ok) process.exit(1)
}

main().catch(err => {
  console.error('Failed:', err)
  process.exit(1)
})
