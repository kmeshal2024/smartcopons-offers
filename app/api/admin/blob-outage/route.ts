import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { invalidateOffers } from '@/lib/cache-invalidation'

/**
 * Damage control for a Vercel Blob store suspension (hit 2026-08-20: quota
 * exceeded mid-rollout; every blob URL started returning 403).
 *
 * What breaks when Blob is down, and what this does about it:
 *  - Flyer.pdfUrl -> the "تحميل PDF" button serves a 403 XML page on click.
 *    `null-pdfs` clears every blob-hosted pdfUrl so the button disappears;
 *    build-flyer-pdfs regenerates them all in minutes once Blob is back.
 *  - ProductOffer.imageUrl -> deliberately LEFT ALONE. ProductCard's onError
 *    already degrades to the clean placeholder, and keeping the URLs means all
 *    mirrored images come back by themselves the moment the store is restored.
 *    Nulling them would permanently lose the mapping (the original retailer
 *    URL was overwritten by the mirror).
 *
 *  `status` reports how much DB state currently points at blob, plus a live
 *  probe of one blob URL so you can see whether the store is back.
 *
 *   curl -X POST .../api/admin/blob-outage -H "Authorization: Bearer $APP_SECRET" \
 *     -H "Content-Type: application/json" -d '{"action":"status"}'   # or "null-pdfs"
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const BLOB_HOST = '.blob.vercel-storage.com'

export async function POST(request: Request) {
  const secret = process.env.APP_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await request.json().catch(() => ({}))
  const action = body?.action

  if (action === 'null-pdfs') {
    const res = await prisma.flyer.updateMany({
      where: { pdfUrl: { contains: BLOB_HOST } },
      data: { pdfUrl: null },
    })
    invalidateOffers()
    return NextResponse.json({ cleared: res.count })
  }

  if (action === 'status') {
    const [pdfCount, imgCount, probeRow] = await Promise.all([
      prisma.flyer.count({ where: { pdfUrl: { contains: BLOB_HOST } } }),
      prisma.productOffer.count({ where: { imageUrl: { contains: BLOB_HOST } } }),
      prisma.productOffer.findFirst({
        where: { imageUrl: { contains: BLOB_HOST } },
        select: { imageUrl: true },
      }),
    ])
    let probe: number | string = 'no blob url in DB'
    if (probeRow?.imageUrl) {
      try {
        const r = await fetch(probeRow.imageUrl, { method: 'HEAD', signal: AbortSignal.timeout(8000) })
        probe = r.status
      } catch (e: any) {
        probe = String(e?.message).slice(0, 80)
      }
    }
    return NextResponse.json({ blobPdfUrls: pdfCount, blobImageUrls: imgCount, probeStatus: probe })
  }

  return NextResponse.json({ error: 'action must be "status" or "null-pdfs"' }, { status: 400 })
}
