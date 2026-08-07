#!/usr/bin/env node
/**
 * Capture a retailer's full weekly leaflet (page images) from ClicFlyer and
 * attach it to a store on SmartCopons via the flyer-only import path.
 *
 * Used for retailers that publish NO clean first-party flyer (Al Sadhan, Farm,
 * Union Coop). ClicFlyer hosts the full multi-page leaflet as page images
 * (cdn.clicflyer.net/appimages/flyerpages/<hash>_compressed.webp); dropping the
 * `_compressed` suffix yields the full-resolution original. These are THIRD-
 * PARTY hosted images (accepted trade-off — Khalid's call).
 *
 * Runs locally with real Chrome (ClicFlyer is JS-heavy). The images render via
 * plain <img> in ImageFlyerViewer, so no CORS is needed.
 *
 * Run:
 *   node scripts/scrape-aggregator-flyer.mjs \
 *     --url="https://clicflyer.com/shoppers/en/.../retailers/union-coop-1071" \
 *     --supermarket=union-coop --country=AE \
 *     --nameAr="يونيون كوب" --nameEn="Union Coop" \
 *     --website="https://www.unioncoop.ae/" --key=$APP_SECRET
 *
 *   ... --dry   to capture + verify without uploading
 */
import { chromium } from 'playwright'

const args = Object.fromEntries(
  process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.length ? v.join('=') : true] })
)

const URL_IN = args.url
const SUPERMARKET = args.supermarket
const COUNTRY = String(args.country || 'SA').toUpperCase()
const NAME_AR = args.nameAr
const NAME_EN = args.nameEn || args.nameAr
const WEBSITE = args.website || ''
const KEY = args.key || process.env.APP_SECRET
const SITE = args.site || 'https://sa.smartcopons.com'
const DRY = !!args.dry

if (!URL_IN || !SUPERMARKET || !NAME_AR) {
  console.error('Missing --url, --supermarket, or --nameAr'); process.exit(1)
}
if (!KEY && !DRY) { console.error('Missing --key=$APP_SECRET (or --dry)'); process.exit(1) }

/** ClicFlyer serves resized variants; the un-suffixed hash is the original. */
const toFullRes = u => u.replace(/_(compressed|\d+x\d+)(?=\.webp$)/i, '')

async function capture() {
  let browser
  try { browser = await chromium.launch({ headless: !args.headed, channel: 'chrome', args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'] }) }
  catch { console.log('chrome channel unavailable, bundled chromium'); browser = await chromium.launch({ headless: !args.headed, args: ['--no-sandbox'] }) }
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 2400 },
  })
  await ctx.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => undefined }))
  const page = await ctx.newPage()

  let url = URL_IN
  console.log(`فتح ${url}`)
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(3500)

  // A retailer page → jump into its current (first) flyer viewer. The flyer
  // cards lazy-load, so scroll and wait before looking for the link.
  if (!/\/flyers\//.test(url)) {
    let link = null
    for (let i = 0; i < 8 && !link; i++) {
      await page.evaluate(() => window.scrollBy(0, 900)).catch(() => {})
      await page.waitForTimeout(1200)
      link = await page.evaluate(() => [...document.querySelectorAll('a[href*="/flyers/"]')][0]?.href || null)
    }
    if (!link) throw new Error('no /flyers/ link on the retailer page (retailer may have only single offers, not a leaflet)')
    url = link
    console.log(`النشرة الحالية: ${url}`)
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForTimeout(3500)
  }

  // Flyer viewers lazy-load pages on scroll.
  for (let i = 0; i < 30; i++) { await page.evaluate(() => window.scrollBy(0, 1200)).catch(() => {}); await page.waitForTimeout(450) }

  const raw = await page.evaluate(() =>
    [...document.querySelectorAll('img')]
      .map(im => (im.currentSrc || im.src || im.getAttribute('data-src') || '').split('?')[0])
      .filter(s => /appimages\/flyerpages/i.test(s))
  )
  await browser.close()
  // De-dupe, keep DOM order (= page order), upgrade to full-res.
  return [...new Set(raw)].map(toFullRes)
}

/** Confirm each URL is a real image (>= 30KB). */
async function verify(urls) {
  const good = []
  for (const u of urls) {
    try {
      const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      const ct = r.headers.get('content-type') || ''
      const len = Number(r.headers.get('content-length') || 0)
      if (r.ok && ct.startsWith('image/') && len >= 30000) good.push(u)
    } catch {}
  }
  return good
}

async function main() {
  const captured = await capture()
  console.log(`التقطنا ${captured.length} صفحة. التحقق ...`)
  if (captured.length < 3) { console.error('عدد الصفحات أقل من 3 — قد تكون الصفحة تغيّرت.'); process.exit(1) }

  const pages = await verify(captured)
  console.log(`صفحات صالحة: ${pages.length}`)
  if (pages.length < 3) { console.error('صفحات صالحة قليلة — إيقاف وقائي.'); process.exit(1) }

  const flyerAsset = { pageImages: pages, coverImage: pages[0], totalPages: pages.length, titleAr: `عروض ${NAME_AR} الأسبوعية` }
  const meta = { nameAr: NAME_AR, nameEn: NAME_EN, website: WEBSITE, country: COUNTRY }

  console.log(`\n${NAME_AR} (${SUPERMARKET}, ${COUNTRY}): ${pages.length} صفحة`)
  console.log('عيّنة:', pages.slice(0, 2).join('\n        '))
  if (DRY) { console.log('\n--dry: لن يُرفع.'); return }

  console.log(`\nالرفع إلى ${SITE} ...`)
  const res = await fetch(`${SITE}/api/admin/import-offers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: KEY, supermarket: SUPERMARKET, meta, offers: [], flyerAsset, logs: [`[aggregator-flyer] ${pages.length} pages from ${URL_IN}`] }),
  })
  const text = await res.text()
  console.log(`HTTP ${res.status} — ${text.slice(0, 400)}`)
  if (!res.ok) process.exit(1)
  console.log(`حُفظت ${pages.length} صفحة نشرة`)
}

main().catch(e => { console.error('Failed:', e); process.exit(1) })
