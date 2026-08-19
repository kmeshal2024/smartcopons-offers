import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { put } from '@vercel/blob'
import sharp from 'sharp'
import { invalidateOffers } from '@/lib/cache-invalidation'

/**
 * Self-host product images on Vercel Blob so a card never depends on the
 * retailer's own CDN.
 *
 * WHY. Product images are hotlinked straight from each retailer (Danube ->
 * CloudFront, BinDawood -> a raw S3 bucket, Carrefour -> mafrservices, …). Two
 * failure modes follow: a slice of objects return 403 AccessDenied because the
 * retailer removed or locked them (verified: ~4.5% of Danube images, dead to
 * everyone — no referer trick recovers them), and any retailer can start
 * hotlink-blocking at any time. Both show the shopper a broken image.
 *
 * WHAT. For each active offer whose image is still a retailer URL:
 *  - fetch it once, server-side;
 *  - a real image  -> re-encode (sharp, 500px webp) and PUT to Blob at a stable
 *    path, then repoint imageUrl at the Blob copy — now immune to the retailer;
 *  - a definitive 403/404 (the object is gone) -> null imageUrl, so the card
 *    shows the clean placeholder and the existing image-backfill can refill it
 *    from the product page later;
 *  - a transient failure (timeout/5xx) -> left untouched, retried next batch.
 *
 * SCOPE. Only ACTIVE offers (flyer not ended) — the set that actually renders.
 * Expired stock is never mirrored. Most-viewed first, so what shoppers see most
 * is protected soonest. One bounded batch per call (120s budget); callers loop
 * on `remaining`. Idempotent: a Blob-hosted image is skipped, so re-runs only
 * pick up what is still retailer-hosted.
 *
 *   curl -X POST .../api/admin/mirror-images \
 *     -H "Authorization: Bearer $APP_SECRET" -H "Content-Type: application/json" \
 *     -d '{"limit":40}'                 # next 40 active retailer-hosted images
 *     -d '{"supermarket":"danube","limit":40}'
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const CONCURRENCY = 6
const TARGET_WIDTH = 500

const isBlob = (u: string) => u.includes('.blob.vercel-storage.com')

type Job = { id: string; imageUrl: string; slug: string }
type Result = 'mirrored' | 'nulled' | 'skipped' | 'failed'

async function processOne(job: Job): Promise<Result> {
  let res: Response
  try {
    res = await fetch(job.imageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      // Short: a healthy retailer image responds in well under a second, and a
      // whole batch of these fetches (6-wide) must finish inside the 120s
      // function budget. A slow one is almost always a dead/hanging object —
      // let it fail fast and be retried next batch rather than 504 the batch.
      signal: AbortSignal.timeout(8000),
    })
  } catch {
    return 'failed' // network/timeout — retry next batch, keep the URL
  }

  // Object is gone for good: drop the dead link so the card shows a placeholder
  // rather than a broken image, and the backfill can refill it later.
  if (res.status === 403 || res.status === 404 || res.status === 410) {
    await prisma.productOffer.update({ where: { id: job.id }, data: { imageUrl: null } })
    return 'nulled'
  }
  if (!res.ok) return 'failed'

  const ct = res.headers.get('content-type') || ''
  const raw = Buffer.from(await res.arrayBuffer())
  if (!ct.startsWith('image/') || raw.length < 500) {
    // Not really an image (an HTML error page slipped a 200) — treat as dead.
    await prisma.productOffer.update({ where: { id: job.id }, data: { imageUrl: null } })
    return 'nulled'
  }

  let webp: Buffer
  try {
    webp = await sharp(raw)
      .resize({ width: TARGET_WIDTH, withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer()
  } catch {
    return 'failed' // undecodable — leave as-is, may be a format sharp rejects
  }

  const blob = await put(`product-images/${job.slug}/${job.id}.webp`, webp, {
    access: 'public',
    contentType: 'image/webp',
    addRandomSuffix: false,
    allowOverwrite: true,
  })
  await prisma.productOffer.update({ where: { id: job.id }, data: { imageUrl: blob.url } })
  return 'mirrored'
}

export async function POST(request: Request) {
  const secret = process.env.APP_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const slug = typeof body?.supermarket === 'string' ? body.supermarket : undefined
  const limit = Math.min(Math.max(Number(body?.limit) || 40, 1), 80)

  const where: any = {
    isHidden: false,
    price: { gt: 0 },
    flyer: { endDate: { gte: new Date() } },
    imageUrl: { not: null },
    // Only rows still pointing at a retailer host. Excluding already-Blob rows
    // in SQL is essential: without it the most-viewed window fills with rows we
    // already mirrored, the JS filter empties the batch, and the loop stalls at
    // the top of the viewCount order instead of advancing through the backlog.
    NOT: { imageUrl: { contains: '.blob.vercel-storage.com' } },
    ...(slug ? { supermarket: { slug } } : {}),
  }

  const candidates = await prisma.productOffer.findMany({
    where,
    select: { id: true, imageUrl: true, supermarket: { select: { slug: true } } },
    orderBy: { viewCount: 'desc' },
    take: limit,
  })

  const jobs: Job[] = candidates
    .filter(c => c.imageUrl && !isBlob(c.imageUrl))
    .map(c => ({ id: c.id, imageUrl: c.imageUrl as string, slug: c.supermarket.slug }))

  const tally: Record<Result, number> = { mirrored: 0, nulled: 0, skipped: 0, failed: 0 }
  for (let i = 0; i < jobs.length; i += CONCURRENCY) {
    const batch = jobs.slice(i, i + CONCURRENCY)
    const results = await Promise.all(batch.map(processOne))
    for (const r of results) tally[r]++
  }

  if (tally.mirrored || tally.nulled) invalidateOffers()

  // A precise remaining count for the whole active set (cheap: it's an index
  // count, not a scan of image bodies).
  const totalActiveWithImage = await prisma.productOffer.count({ where })
  return NextResponse.json({
    processed: jobs.length,
    ...tally,
    // Rows still retailer-hosted after this batch (approx — the count includes
    // any Blob-hosted rows the where can't exclude, but those shrink to zero).
    remainingApprox: Math.max(0, totalActiveWithImage - tally.mirrored - tally.nulled),
  })
}
