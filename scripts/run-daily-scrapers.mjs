#!/usr/bin/env node
/**
 * Daily driver for the scrapers that cannot run on Vercel.
 *
 * Panda, Danube, BinDawood, Extra and Othaim are already on Vercel crons (see
 * vercel.json). Carrefour, Tamimi and LuLu are not: each needs a real browser,
 * which does not fit in a 120s serverless function. This script is what the
 * Windows scheduled task runs — see scripts/daily-scrape.cmd.
 *
 * One scraper failing must not stop the others: a retailer whose markup
 * changed overnight should cost that retailer's prices, not the whole run.
 *
 * Run:
 *   node scripts/run-daily-scrapers.mjs
 *
 * Options:
 *   --key=      APP_SECRET (otherwise read from the environment or .env.local)
 *   --only=     comma-separated subset, e.g. --only=tamimi,lulu
 *   --dry       scrape and report, do not upload
 */

import { spawn } from 'node:child_process'
import { readFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const LOG_DIR = join(ROOT, 'logs')

const SCRAPERS = [
  { name: 'tamimi', script: 'scrape-tamimi-playwright.mjs', args: [] },
  { name: 'lulu', script: 'scrape-lulu-playwright.mjs', args: ['--pages=10'] },
  { name: 'aldawaa', script: 'scrape-aldawaa-playwright.mjs', args: [] },
  { name: 'nahdi', script: 'scrape-nahdi-playwright.mjs', args: [] },
  // UAE. Same two scripts, --country=AE picks the storefront and target store.
  // Kept next to their Saudi runs so a broken selector shows up for both at
  // once. Lulu gets fewer pages than Saudi — the UAE catalogue is smaller and
  // this keeps the nightly window from stretching.
  { name: 'lulu-ae', script: 'scrape-lulu-playwright.mjs', args: ['--country=AE', '--pages=8'] },
  // LuLu's weekly flyer is page images on its own CDN, not a PDF — captured
  // separately (seconds) and attached to lulu-ae's current flyer.
  { name: 'lulu-ae-flyer', script: 'scrape-lulu-flyer.mjs', args: ['--country=AE'] },
  // Flyer-only stores (no public prices / no clean first-party flyer): their
  // full weekly leaflet is captured from ClicFlyer as page images and attached
  // to the store. Third-party hosted images — Khalid's accepted trade-off.
  { name: 'farm-flyer', script: 'scrape-aggregator-flyer.mjs',
    args: ['--url=https://clicflyer.com/shoppers/en/saudi-arabia/riyadh/retailers/farm-4', '--supermarket=farm', '--country=SA', '--nameAr=أسواق المزرعة', '--nameEn=Farm Superstores', '--website=https://www.farm.com.sa/'] },
  { name: 'unioncoop-flyer', script: 'scrape-aggregator-flyer.mjs',
    args: ['--url=https://clicflyer.com/shoppers/en/united-arab-emirates/dubai/retailers/union-coop-1071', '--supermarket=union-coop', '--country=AE', '--nameAr=يونيون كوب', '--nameEn=Union Coop', '--website=https://www.unioncoop.ae/'] },
  // Nesto publishes no public prices (login-gated store) but a full weekly
  // leaflet on ClicFlyer, so it comes in as a flyer store too.
  { name: 'nesto-flyer', script: 'scrape-aggregator-flyer.mjs',
    args: ['--url=https://clicflyer.com/shoppers/en/saudi-arabia/riyadh/retailers/nesto-17', '--supermarket=nesto', '--country=SA', '--nameAr=نستو', '--nameEn=Nesto Hypermarket', '--website=https://ksa.nesto.shop/'] },
  { name: 'nesto-ae-flyer', script: 'scrape-aggregator-flyer.mjs',
    args: ['--url=https://clicflyer.com/shoppers/en/united-arab-emirates/dubai/retailers/nesto-1100', '--supermarket=nesto-ae', '--country=AE', '--nameAr=نستو الإمارات', '--nameEn=Nesto Hypermarket UAE', '--website=https://uae.nesto.shop/'] },
  // Same flyer-only path for the UAE stores onboarded by hand from ClicFlyer
  // this round (Almaya, ADCOOP, Aswaaq, GALA, Ansar Gallery, Geant,
  // K.M Trading). Their product catalogue (name/price/crop-matched image) was
  // imported once and is kept alive by cron/refresh-imported — this only
  // recaptures the CURRENT weekly leaflet page-images so ImageFlyerViewer
  // shows this week's actual promotion, at zero cost (no product/price data).
  { name: 'almaya-flyer', script: 'scrape-aggregator-flyer.mjs',
    args: ['--url=https://clicflyer.com/shoppers/en/united-arab-emirates/dubai/retailers/almaya-1060', '--supermarket=almaya', '--country=AE', '--nameAr=الماية', '--nameEn=Almaya', '--website=https://www.almaya.ae/'] },
  { name: 'adcoop-flyer', script: 'scrape-aggregator-flyer.mjs',
    args: ['--url=https://clicflyer.com/shoppers/en/united-arab-emirates/abu-dhabi/retailers/adcoop-1059', '--supermarket=adcoop', '--country=AE', '--nameAr=تعاونية أبوظبي', '--nameEn=ADCOOP', '--website=https://corporate.adcoop.com/'] },
  { name: 'aswaaq-flyer', script: 'scrape-aggregator-flyer.mjs',
    args: ['--url=https://clicflyer.com/shoppers/en/united-arab-emirates/dubai/retailers/aswaaq-1643', '--supermarket=aswaaq', '--country=AE', '--nameAr=أسواق', '--nameEn=Aswaaq', '--website=https://aswaaq.ae/'] },
  { name: 'gala-flyer', script: 'scrape-aggregator-flyer.mjs',
    args: ['--url=https://clicflyer.com/shoppers/en/united-arab-emirates/sharjah/retailers/gala-2351', '--supermarket=gala', '--country=AE', '--nameAr=جالا', '--nameEn=GALA', '--website=https://galauae.com/'] },
  { name: 'ansar-gallery-flyer', script: 'scrape-aggregator-flyer.mjs',
    args: ['--url=https://clicflyer.com/shoppers/en/united-arab-emirates/sharjah/retailers/ansar-gallery-1137', '--supermarket=ansar-gallery', '--country=AE', '--nameAr=أنصار جاليري', '--nameEn=Ansar Gallery', '--website=https://www.ansargallery.ae/'] },
  { name: 'geant-flyer', script: 'scrape-aggregator-flyer.mjs',
    args: ['--url=https://clicflyer.com/shoppers/en/united-arab-emirates/dubai/retailers/geant-1048', '--supermarket=geant', '--country=AE', '--nameAr=جيان', '--nameEn=Geant', '--website=https://geantuae.com/'] },
  { name: 'km-trading-flyer', script: 'scrape-aggregator-flyer.mjs',
    args: ['--url=https://clicflyer.com/shoppers/en/united-arab-emirates/dubai/retailers/km-trading-1065', '--supermarket=km-trading', '--country=AE', '--nameAr=كي إم تريدنج', '--nameEn=K.M Trading', '--website=https://www.kmtrading.com/'] },
  // Carrefour last: it's the slowest (~25-30 min), so the others land first.
  { name: 'carrefour', script: 'scrape-carrefour-playwright.mjs', args: [] },
  { name: 'carrefour-ae', script: 'scrape-carrefour-playwright.mjs', args: ['--country=AE'] },
  // Then top up the Carrefour images its listing scrape couldn't capture. A
  // batch per night rather than one multi-hour pass; coverage climbs over days.
  { name: 'carrefour-images', script: 'backfill-carrefour-images.mjs', args: ['--limit=400'] },
]

/**
 * Retailers whose scrapers do run on Vercel. They already have crons in
 * vercel.json, but those are not reliable enough to be the only trigger —
 * BinDawood and Extra were both a day stale while the other three had run that
 * morning. Poking the same endpoints from here costs seconds and makes the
 * daily refresh depend on one scheduler instead of two.
 */
const REMOTE = ['panda', 'danube', 'bindawood', 'extra', 'alothaim']
const SITE = process.env.SMARTCOPONS_SITE || 'https://sa.smartcopons.com'
const REMOTE_TIMEOUT_MS = 170_000

// A run that hangs must not sit there until tomorrow's run collides with it.
// 45 minutes was too tight: Carrefour alone takes ~25-30 and was killed
// mid-category on the first scheduled run. Its 400px/350ms scroll steps are
// what make the product images load, so the time is the price of the images.
// Even at the cap, tamimi + lulu + carrefour stays inside the task's 3h limit.
const PER_SCRAPER_TIMEOUT_MS = 90 * 60_000

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? true]
  })
)

/** APP_SECRET, in order of preference: flag, environment, .env.local. */
function resolveKey() {
  if (args.key) return args.key
  if (process.env.APP_SECRET) return process.env.APP_SECRET
  for (const f of ['.env.local', '.env']) {
    const p = join(ROOT, f)
    if (!existsSync(p)) continue
    const m = readFileSync(p, 'utf8').match(/^APP_SECRET\s*=\s*"?([^"\r\n]+)"?/m)
    if (m) return m[1]
  }
  return null
}

// Local time, not ISO: the log is read next to Task Scheduler's own "last run"
// column, and a UTC stamp three hours behind it just looks like a failed run.
const pad = n => String(n).padStart(2, '0')
const localDate = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const stamp = () => {
  const d = new Date()
  return `${localDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
const dayFile = () => join(LOG_DIR, `scrape-${localDate()}.log`)

// The scheduled task and a manual run share one day's log file, and their
// lines interleave. Tag each with the pid so a run can be read as a unit.
const RUN_ID = String(process.pid).padStart(5, '0')

function log(line) {
  const text = `[${stamp()} #${RUN_ID}] ${line}`
  console.log(text)
  try {
    appendFileSync(dayFile(), text + '\n')
  } catch {
    /* logging must never take the run down */
  }
}

function runOne(s, key) {
  return new Promise(resolve => {
    const argv = [join(ROOT, 'scripts', s.script), ...s.args]
    if (args.dry) argv.push('--dry')
    else argv.push(`--key=${key}`)

    const started = Date.now()
    const child = spawn(process.execPath, argv, { cwd: ROOT, windowsHide: true })

    let tail = ''
    const keep = chunk => {
      tail = (tail + chunk.toString()).slice(-4000)
    }
    child.stdout.on('data', keep)
    child.stderr.on('data', keep)

    const killer = setTimeout(() => {
      log(`${s.name}: تجاوز المهلة (${PER_SCRAPER_TIMEOUT_MS / 60000} دقيقة) — إيقاف`)
      child.kill('SIGKILL')
    }, PER_SCRAPER_TIMEOUT_MS)

    child.on('close', code => {
      clearTimeout(killer)
      const mins = Math.round((Date.now() - started) / 60000)

      // The scrapers print their own summary line; surface it rather than the
      // whole log, so one day's entry stays readable.
      const total = tail.match(/المجموع:\s*(\d+)[^\n]*/)?.[0]
      const uploads = [...tail.matchAll(/(?:دفعة|batch)\s*\d+\s*\((\d+)\):\s*HTTP\s*(\d+)/g)]
      // The image backfill doesn't upload offers in batches — it reports how
      // many image URLs it saved. Count that as work done too, or a good run
      // would be logged as a failure.
      const savedImages = Number(tail.match(/حُفظت\s+(\d+)/)?.[1] || 0)
      const uploaded =
        uploads.filter(u => u[2] === '200').reduce((a, u) => a + Number(u[1]), 0) + savedImages
      const failed = uploads.filter(u => u[2] !== '200')

      if (code === 0 && uploaded > 0) {
        log(`${s.name}: تم — ${uploaded} عرضاً مرفوعاً في ${mins}د. ${total || ''}`)
      } else if (code === 0 && args.dry) {
        log(`${s.name}: تجربة جافة — ${total || 'لا ملخّص'} (${mins}د)`)
      } else {
        log(
          `${s.name}: فشل (exit ${code}) بعد ${mins}د` +
            (failed.length ? ` — رفض الرفع: HTTP ${failed.map(f => f[2]).join(',')}` : '') +
            `\n${tail.split('\n').slice(-6).join('\n')}`
        )
      }

      resolve({ name: s.name, ok: code === 0 && (uploaded > 0 || !!args.dry), uploaded, mins })
    })

    child.on('error', err => {
      clearTimeout(killer)
      log(`${s.name}: تعذّر التشغيل — ${err.message}`)
      resolve({ name: s.name, ok: false, uploaded: 0, mins: 0 })
    })
  })
}

/**
 * Trigger a Vercel-side scraper. APP_SECRET contains characters that are not
 * URL-safe, so it has to go through URLSearchParams — appending it raw silently
 * produces a 401 that looks like a wrong secret.
 */
async function runRemote(slug, key) {
  const qs = new URLSearchParams({ key, supermarket: slug })
  const started = Date.now()
  try {
    const res = await fetch(`${SITE}/api/cron/scrape-offers?${qs}`, {
      signal: AbortSignal.timeout(REMOTE_TIMEOUT_MS),
    })
    const body = await res.json().catch(() => ({}))
    const mins = ((Date.now() - started) / 60000).toFixed(1)

    if (!res.ok || body.error) {
      log(`${slug}: فشل (HTTP ${res.status}) ${body.error || ''}`)
      return { name: slug, ok: false, uploaded: 0 }
    }
    const usable = body.usableOffers ?? body.offersFound ?? 0
    // A 200 with nothing in it is not a success — it is the shape a broken
    // scraper takes once a retailer changes its markup, and it would otherwise
    // read as "fine" in the summary for weeks.
    if (usable === 0 && !body.flyerPdfUrl) {
      log(`${slug}: لم يُرجع أي عرض (HTTP 200) — يحتاج فحصاً`)
      return { name: slug, ok: false, uploaded: 0 }
    }
    log(
      `${slug}: تم — ${usable} عرضاً ` +
        `(${body.offersCreated ?? 0} جديد، ${body.refreshedOffers ?? 0} محدّث) في ${mins}د`
    )
    return { name: slug, ok: true, uploaded: usable }
  } catch (err) {
    // A timeout here is expected for the slower stores: the function keeps
    // running server-side and its data still lands, so do not call it a failure.
    const why = err.name === 'TimeoutError' ? 'انقطع الاتصال (قد يكون أكمل على الخادم)' : err.message
    log(`${slug}: ${why}`)
    return { name: slug, ok: false, uploaded: 0 }
  }
}

async function main() {
  mkdirSync(LOG_DIR, { recursive: true })

  const key = resolveKey()
  if (!key && !args.dry) {
    log('لا يوجد APP_SECRET — ضعه في .env.local أو مرّره بـ --key=')
    process.exit(1)
  }

  const only = args.only ? String(args.only).split(',').map(s => s.trim()) : null
  const targets = only ? SCRAPERS.filter(s => only.includes(s.name)) : SCRAPERS
  const remotes = only ? REMOTE.filter(s => only.includes(s)) : REMOTE

  log(`=== بدء التحديث اليومي — ${[...targets.map(t => t.name), ...remotes].join(', ')} ===`)

  const results = []

  // Remote first: they are quick, and finishing them before the browser work
  // means a machine that gets shut down mid-run still refreshed five stores.
  if (!args.dry) {
    for (const slug of remotes) results.push(await runRemote(slug, key))
  } else if (remotes.length) {
    log(`تخطّي ${remotes.length} متجراً على الخادم (--dry)`)
  }

  // Sequential on purpose: three headless Chrome instances on one machine
  // starve each other, and a slow scroll is what makes the images load.
  for (const s of targets) results.push(await runOne(s, key))

  // Self-hosted PDF copies for any active image flyer that lacks one (new
  // leaflets landed by the flyer scrapers above). One flyer per call — the
  // endpoint's time budget — so loop until it reports nothing pending. The
  // iteration cap keeps a permanently failing flyer from looping forever.
  if (!args.dry) {
    for (let i = 0; i < 12; i++) {
      try {
        const res = await fetch(`${SITE}/api/admin/build-flyer-pdfs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({}),
          signal: AbortSignal.timeout(180000),
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) { log(`flyer-pdf: HTTP ${res.status} ${body.error || ''}`); break }
        for (const b of body.built || []) log(`flyer-pdf: ${b.slug} ${b.date} — ${b.pages} صفحة، ${b.sizeKB}KB`)
        for (const f of body.failed || []) log(`flyer-pdf: ${f.slug} فشل — ${f.error}`)
        if (!body.remaining || !(body.built || []).length) break
      } catch (err) {
        log(`flyer-pdf: ${err.message}`)
        break
      }
    }
  }

  const ok = results.filter(r => r.ok)
  const total = results.reduce((a, r) => a + r.uploaded, 0)
  log(`=== انتهى — ${ok.length}/${results.length} نجح، ${total} عرضاً إجمالاً ===`)

  // Non-zero only if every scraper failed: a partial run still refreshed
  // prices, and Task Scheduler's "last result" should not cry wolf.
  process.exit(ok.length === 0 ? 1 : 0)
}

main().catch(err => {
  log(`سقوط غير متوقّع: ${err.message}`)
  process.exit(1)
})
