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
  { name: 'carrefour', script: 'scrape-carrefour-playwright.mjs', args: [] },
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
const PER_SCRAPER_TIMEOUT_MS = 45 * 60_000

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

function log(line) {
  const text = `[${stamp()}] ${line}`
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
      const uploaded = uploads
        .filter(u => u[2] === '200')
        .reduce((a, u) => a + Number(u[1]), 0)
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
