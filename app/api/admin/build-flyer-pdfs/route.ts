import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { put } from '@vercel/blob'
import { PDFDocument } from 'pdf-lib'
import sharp from 'sharp'
import { parsePageImages } from '@/lib/flyer-query'

/**
 * Assemble a self-hosted PDF for image flyers and store it on Vercel Blob.
 *
 * The aggregator flyers (Farm, Nesto, Union Coop…) live as ClicFlyer CDN page
 * images in `Flyer.pageImages`. That works for on-site viewing but the pages
 * are third-party hosted (link-rot risk) and there is nothing a shopper can
 * download or share as one file. This route fetches the pages server-side,
 * re-encodes them (sharp → JPEG, capped width) and binds them into a PDF with
 * pdf-lib, uploads it to Blob under a STABLE path (flyers/<slug>/<date>.pdf,
 * overwritten on rebuild — no orphan blobs week over week), then sets
 * `Flyer.pdfUrl` so FlyerScreen can offer a download button.
 *
 * One flyer per call by default: a 60-page leaflet is ~45–90s of fetching +
 * encoding, and the 120s function budget must never be shared by two. Callers
 * loop until `remaining` is 0 (the daily runner does this).
 *
 *   curl -X POST .../api/admin/build-flyer-pdfs \
 *     -H "Authorization: Bearer $APP_SECRET" -H "Content-Type: application/json" \
 *     -d '{}'                       # next pending active image-flyer
 *     -d '{"flyerId":"…"}'          # one specific flyer
 *     -d '{"force":true}'           # rebuild even when a pdfUrl exists
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 120

/** Cap page width — full-res ClicFlyer pages are ~1500-2000px and the PDF would pass 25MB. */
const MAX_WIDTH = 1200
const JPEG_QUALITY = 72
const FETCH_CONCURRENCY = 6

async function fetchPageAsJpeg(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) return null
    const raw = Buffer.from(await res.arrayBuffer())
    if (raw.length < 10_000) return null // placeholder / error body, not a page
    return await sharp(raw)
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer()
  } catch {
    return null
  }
}

async function buildPdf(pageUrls: string[]): Promise<{ pdf: Buffer; pages: number; skipped: number }> {
  const jpegs: (Buffer | null)[] = new Array(pageUrls.length).fill(null)
  for (let i = 0; i < pageUrls.length; i += FETCH_CONCURRENCY) {
    const batch = pageUrls.slice(i, i + FETCH_CONCURRENCY)
    const results = await Promise.all(batch.map(fetchPageAsJpeg))
    results.forEach((buf, j) => (jpegs[i + j] = buf))
  }

  const doc = await PDFDocument.create()
  let pages = 0
  for (const jpeg of jpegs) {
    if (!jpeg) continue
    const img = await doc.embedJpg(jpeg)
    const page = doc.addPage([img.width, img.height])
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height })
    pages++
  }
  const bytes = await doc.save()
  return { pdf: Buffer.from(bytes), pages, skipped: pageUrls.length - pages }
}

export async function POST(request: Request) {
  const secret = process.env.APP_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const { flyerId, force, limit } = body as { flyerId?: string; force?: boolean; limit?: number }
  const take = Math.min(Math.max(Number(limit) || 1, 1), 3)

  const pendingWhere = {
    status: 'ACTIVE' as const,
    endDate: { gte: new Date() },
    pageImages: { not: null },
    ...(flyerId ? { id: flyerId } : {}),
    ...(force ? {} : { OR: [{ pdfUrl: null }, { pdfUrl: '' }] }),
  }

  const candidates = await prisma.flyer.findMany({
    where: pendingWhere,
    include: { supermarket: { select: { slug: true, nameAr: true } } },
    orderBy: { endDate: 'asc' },
    take: take + 20, // the surplus is only counted, not processed
  })

  const built: Array<Record<string, unknown>> = []
  const failed: Array<Record<string, unknown>> = []

  for (const flyer of candidates.slice(0, take)) {
    const pageUrls = parsePageImages(flyer.pageImages)
    if (pageUrls.length < 3) {
      failed.push({ id: flyer.id, slug: flyer.supermarket.slug, error: `only ${pageUrls.length} page images` })
      continue
    }

    try {
      const { pdf, pages, skipped } = await buildPdf(pageUrls)
      if (pages < 3) {
        failed.push({ id: flyer.id, slug: flyer.supermarket.slug, error: `only ${pages} pages fetched OK` })
        continue
      }

      const date = flyer.startDate.toISOString().slice(0, 10)
      const blob = await put(`flyers/${flyer.supermarket.slug}/${date}.pdf`, pdf, {
        access: 'public',
        contentType: 'application/pdf',
        addRandomSuffix: false,
        allowOverwrite: true,
      })

      await prisma.flyer.update({ where: { id: flyer.id }, data: { pdfUrl: blob.url } })
      built.push({
        id: flyer.id,
        slug: flyer.supermarket.slug,
        date,
        pages,
        skippedPages: skipped,
        sizeKB: Math.round(pdf.length / 1024),
        pdfUrl: blob.url,
      })
    } catch (e: any) {
      failed.push({ id: flyer.id, slug: flyer.supermarket.slug, error: String(e?.message).slice(0, 200) })
    }
  }

  // Failures stay pending (pdfUrl still null), so report them as remaining too —
  // but a caller loop must not retry a permanently failing flyer forever; the
  // daily runner caps its iterations.
  const remaining = candidates.length - built.length

  return NextResponse.json({ built, failed, remaining: Math.max(0, remaining) })
}
