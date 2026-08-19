#!/usr/bin/env node
/**
 * Drive /api/admin/mirror-images in a loop until the active set is fully
 * self-hosted on Vercel Blob (or --max batches is reached).
 *
 * The route does the work server-side (fetch retailer image -> sharp/webp ->
 * Blob -> repoint imageUrl; dead 403/404 -> null). This just paces the batches
 * and prints progress, the same shape as backfill-carrefour-images.mjs.
 *
 * Run:
 *   node scripts/mirror-images.mjs --key=$APP_SECRET                 # all retailers
 *   node scripts/mirror-images.mjs --supermarket=danube --key=…      # one store
 *   node scripts/mirror-images.mjs --key=… --limit=60 --max=500      # tune batch/cap
 */
const args = Object.fromEntries(
  process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.length ? v.join('=') : true] })
)
const SITE = args.site || process.env.SMARTCOPONS_SITE || 'https://sa.smartcopons.com'
const KEY = args.key || process.env.APP_SECRET
const SLUG = args.supermarket || null
const LIMIT = Number(args.limit) || 60
const MAX = Number(args.max) || 100000
if (!KEY) { console.error('Missing --key=$APP_SECRET'); process.exit(1) }

let mirrored = 0, nulled = 0, failed = 0, batches = 0
const started = Date.now()

while (batches < MAX) {
  let body
  try {
    const res = await fetch(`${SITE}/api/admin/mirror-images`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({ ...(SLUG ? { supermarket: SLUG } : {}), limit: LIMIT }),
      signal: AbortSignal.timeout(180000),
    })
    body = await res.json().catch(() => ({}))
    if (!res.ok) { console.error(`HTTP ${res.status}: ${body.error || ''}`); break }
  } catch (e) {
    console.error(`batch ${batches + 1} failed: ${e.message} — retrying once`)
    continue
  }

  batches++
  mirrored += body.mirrored || 0
  nulled += body.nulled || 0
  failed += body.failed || 0
  const mins = ((Date.now() - started) / 60000).toFixed(1)
  console.log(
    `batch ${batches}: +${body.mirrored || 0} mirrored, +${body.nulled || 0} nulled, ` +
    `${body.failed || 0} failed | totals ${mirrored}/${nulled} | ~${body.remainingApprox} left | ${mins}m`
  )

  // Nothing actionable happened (all skipped/failed) or the set is drained.
  if ((body.processed || 0) === 0 || (body.remainingApprox || 0) === 0) break
  if ((body.mirrored || 0) === 0 && (body.nulled || 0) === 0 && (body.failed || 0) > 0) {
    // A whole batch of transient failures — back off briefly, don't hammer.
    await new Promise(r => setTimeout(r, 3000))
  }
}

console.log(`\nDONE: ${mirrored} mirrored, ${nulled} nulled (dead), ${failed} transient failures across ${batches} batches`)
