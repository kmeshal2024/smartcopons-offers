import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { invalidateOffers } from '@/lib/cache-invalidation'

/**
 * One-shot scrubber for ClicFlyer references left on flyer records.
 *
 * The ingest layer used to add to flyer assets rather than replace them, so a
 * first-party scraper attaching a new PDF left any pageImages from a previous
 * scrape untouched — and because the retailer page renders ImageFlyerViewer
 * whenever pageImages is populated, the shopper saw the old (competitor's)
 * images instead of the new PDF. That merge rule is fixed in offer-ingest, but
 * flyers scraped BEFORE the fix still carry the leftover URLs and there is no
 * new scrape to overwrite them for retailers without a first-party source.
 *
 * This route finds every flyer whose pageImages or coverImage still points at
 * cdn.clicflyer.net and clears ONLY those fields. Nothing else is touched:
 * pdfUrl (if any), status, dates, and the flyer row itself are preserved, so
 * this is reversible and cannot delete offer data.
 *
 * Idempotent: a second run finds nothing to clear.
 *
 *   curl -X POST https://sa.smartcopons.com/api/admin/scrub-clicflyer \
 *        -H "Authorization: Bearer $APP_SECRET"
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 120

async function run() {
  const flyers = await prisma.flyer.findMany({
    where: {
      OR: [
        { pageImages: { contains: 'clicflyer' } },
        { coverImage: { contains: 'clicflyer' } },
      ],
    },
    select: {
      id: true,
      pageImages: true,
      coverImage: true,
      supermarket: { select: { slug: true } },
    },
  })

  const results: Array<Record<string, unknown>> = []

  for (const f of flyers) {
    // Preserve any non-ClicFlyer URLs already in the array. In practice these
    // records were entirely ClicFlyer, but filtering is safer than blanking.
    let keptImages: string[] = []
    try {
      const arr = JSON.parse(f.pageImages || '[]')
      if (Array.isArray(arr)) {
        keptImages = arr.filter(
          (u): u is string => typeof u === 'string' && !/clicflyer/i.test(u)
        )
      }
    } catch {
      /* malformed JSON — treat as fully cleared */
    }

    const cover =
      f.coverImage && !/clicflyer/i.test(f.coverImage) ? f.coverImage : null

    await prisma.flyer.update({
      where: { id: f.id },
      data: {
        pageImages: keptImages.length ? JSON.stringify(keptImages) : null,
        coverImage: cover,
      },
    })

    results.push({
      flyerId: f.id,
      retailer: f.supermarket?.slug ?? null,
      imagesBefore: (() => {
        try {
          const a = JSON.parse(f.pageImages || '[]')
          return Array.isArray(a) ? a.length : 0
        } catch {
          return 0
        }
      })(),
      imagesAfter: keptImages.length,
      coverCleared: !!f.coverImage && !cover,
    })
  }

  if (flyers.length > 0) invalidateOffers()

  return { scrubbed: flyers.length, results }
}

export async function POST(request: Request) {
  const secret = process.env.APP_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json(await run())
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method Not Allowed. Use POST with an Authorization: Bearer header.' },
    { status: 405, headers: { Allow: 'POST' } }
  )
}
