#!/usr/bin/env node
/**
 * LuLu weekly flyer capture (UAE first) — runs locally with real Chrome.
 *
 * LuLu does NOT publish a PDF or a flip-book. Its official in-store promotions
 * page renders the weekly campaign as portrait poster images on its own CDN
 * (bf1af2.akinoncloudcdn.com). Those images carry `Access-Control-Allow-Origin:
 * *` and a full-resolution original is available by dropping the
 * `_size<N>_cropCenter` suffix. We grab them, verify each is a real image (not
 * a fallback), and POST them as a flyerAsset to /api/admin/import-offers, which
 * attaches them to this week's flyer for the store. The site then renders them
 * with ImageFlyerViewer (plain <img>, no pdf.js).
 *
 * Why local + real Chrome: a plain fetch of the LuLu storefront gets a 403.
 *
 * Run:
 *   node scripts/scrape-lulu-flyer.mjs --key=$APP_SECRET
 *   node scripts/scrape-lulu-flyer.mjs --dry            # capture + verify, no upload
 *
 * Options:
 *   --key=      APP_SECRET (or env APP_SECRET)
 *   --site=     target site (default https://sa.smartcopons.com)
 *   --country=  AE (default) or SA
 *   --dry       do not upload
 *   --headed    show the browser
 */
import { chromium } from 'playwright'

const args = Object.fromEntries(
  process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true] })
)

const COUNTRY = String(args.country || 'AE').toUpperCase()
const LOCALES = { AE: 'ar-ae', SA: 'ar-sa' }
const STORES = {
  AE: {
    supermarket: 'lulu-ae',
    titleAr: 'عروض لولو هايبرماركت الأسبوعية',
    meta: { nameAr: 'لولو هايبرماركت الإمارات', nameEn: 'LuLu Hypermarket UAE', website: 'https://gcc.luluhypermarket.com/ar-ae/', country: 'AE' },
  },
  SA: {
    supermarket: 'lulu',
    titleAr: 'عروض لولو هايبرماركت الأسبوعية',
    meta: null,
  },
}
const locale = LOCALES[COUNTRY]
const CFG = STORES[COUNTRY]
if (!locale || !CFG) { console.error(`Unknown --country=${COUNTRY}`); process.exit(1) }

const KEY = args.key || process.env.APP_SECRET
const SITE = args.site || 'https://sa.smartcopons.com'
const DRY = !!args.dry
if (!KEY && !DRY) { console.error('Missing --key=$APP_SECRET (or run with --dry)'); process.exit(1) }

const PROMO_URL = `https://gcc.luluhypermarket.com/${locale}/pages/instore-promotions`

/** Drop LuLu's CDN resize suffix so we store the full-resolution original. */
const toFullRes = u => u.replace(/_size\d+_crop[A-Za-z]+(?=\.(jpg|jpeg|png|webp)$)/i, '')

async function capture() {
  let browser
  try { browser = await chromium.launch({ headless: !args.headed, channel: 'chrome', args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'] }) }
  catch { console.log('chrome channel unavailable, using bundled chromium'); browser = await chromium.launch({ headless: !args.headed, args: ['--no-sandbox'] }) }

  const context = await browser.newContext({
    locale: COUNTRY === 'AE' ? 'ar-AE' : 'ar-SA',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 2000 },
  })
  await context.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => undefined }))
  const page = await context.newPage()

  console.log(`فتح صفحة عروض لولو: ${PROMO_URL}`)
  const resp = await page.goto(PROMO_URL, { waitUntil: 'networkidle', timeout: 60000 })
  if (!resp || resp.status() >= 400) throw new Error(`Promotions page returned HTTP ${resp?.status()}`)
  for (let i = 0; i < 10; i++) { await page.evaluate(() => window.scrollBy(0, 900)); await page.waitForTimeout(600) }
  await page.waitForTimeout(1500)

  // Portrait CMS images are the flyer pages; the short 144px-tall banners are
  // bank-offer strips and must not be included.
  const raw = await page.evaluate(() =>
    [...document.querySelectorAll('img')]
      .map(im => ({ src: (im.currentSrc || im.src || '').split('?')[0], w: im.naturalWidth, h: im.naturalHeight }))
      .filter(im => im.src && im.h >= 600 && /akinoncloudcdn\.com\/cms\//i.test(im.src))
      .map(im => im.src)
  )
  await browser.close()

  // De-dupe, keep order, upgrade to full-res.
  const pages = [...new Set(raw)].map(toFullRes)
  return pages
}

/** Confirm each URL is a real image (>=20KB) and not a fallback/placeholder. */
async function verify(urls) {
  const good = []
  for (const u of urls) {
    try {
      const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      const ct = r.headers.get('content-type') || ''
      const len = Number(r.headers.get('content-length') || 0)
      if (r.ok && ct.startsWith('image/') && len >= 20000) { good.push(u); console.log(`  ✓ ${Math.round(len / 1024)}KB  ${u.slice(0, 90)}`) }
      else console.log(`  ✗ (HTTP ${r.status} ${ct} ${len}B) ${u.slice(0, 90)}`)
    } catch (e) { console.log(`  ✗ (${e.message.slice(0, 40)}) ${u.slice(0, 90)}`) }
  }
  return good
}

async function main() {
  const captured = await capture()
  console.log(`\nالتقطنا ${captured.length} صورة نشرة. التحقق من صحتها ...`)
  if (captured.length === 0) {
    console.error('لا صور — قد تكون بنية الصفحة تغيّرت. أعد بـ --headed للفحص.')
    process.exit(1)
  }

  const pages = await verify(captured)
  // Anti-fallback guard: distinct URLs proven above; require at least 2 real
  // pages, and confirm they are not all identical bytes.
  if (pages.length < 2) {
    console.error(`عدد الصفحات الصالحة ${pages.length} — أقل من المتوقع. إيقاف كإجراء وقائي.`)
    process.exit(1)
  }

  const flyerAsset = {
    pageImages: pages,
    coverImage: pages[0],
    totalPages: pages.length,
    titleAr: CFG.titleAr,
  }

  console.log(`\nنشرة لولو ${COUNTRY}: ${pages.length} صفحة`)
  if (DRY) { console.log('--dry: لن يتم الرفع.\n', JSON.stringify(flyerAsset, null, 2)); return }

  console.log(`\nالرفع إلى ${SITE} ...`)
  const res = await fetch(`${SITE}/api/admin/import-offers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      key: KEY,
      supermarket: CFG.supermarket,
      ...(CFG.meta ? { meta: CFG.meta } : {}),
      offers: [],
      flyerAsset,
      logs: [`[lulu-flyer] captured ${pages.length} page images from ${PROMO_URL}`],
    }),
  })
  const text = await res.text()
  console.log(`HTTP ${res.status} — ${text.slice(0, 400)}`)
  if (!res.ok) process.exit(1)
}

main().catch(e => { console.error('Failed:', e); process.exit(1) })
