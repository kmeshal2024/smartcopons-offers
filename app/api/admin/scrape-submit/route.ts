import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { OfferIngestService } from '@/lib/services/offer-ingest'
import { prisma } from '@/lib/db'
import type { ScrapedOffer } from '@/lib/scrapers/types'

// CORS headers for bookmarklet cross-origin requests
function corsHeaders(request: Request) {
  const origin = request.headers.get('origin') || '*'
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  }
}

// Handle CORS preflight
export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request),
  })
}

export async function POST(request: Request) {
  const headers = corsHeaders(request)

  // Auth: session cookie OR ?secret=APP_SECRET query param
  const url = new URL(request.url)
  const secret = url.searchParams.get('secret')
  if (secret === process.env.APP_SECRET) {
    // API key auth - OK
  } else {
    try {
      await requireAdmin()
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers })
    }
  }

  try {
    const body = await request.json()
    const { supermarketSlug, offers, sourceUrl } = body as {
      supermarketSlug: string
      offers: ScrapedOffer[]
      sourceUrl: string
    }

    if (!supermarketSlug || !offers || !Array.isArray(offers) || offers.length === 0) {
      return NextResponse.json(
        { error: 'Missing supermarketSlug or offers array' },
        { status: 400, headers }
      )
    }

    // Validate supermarket exists
    const supermarket = await prisma.supermarket.findUnique({
      where: { slug: supermarketSlug },
    })
    if (!supermarket) {
      return NextResponse.json(
        { error: `Supermarket "${supermarketSlug}" not found` },
        { status: 404, headers }
      )
    }

    // Normalize offers
    const normalizedOffers: ScrapedOffer[] = offers.map(o => ({
      nameAr: o.nameAr || o.nameEn || '',
      nameEn: o.nameEn || o.nameAr || '',
      brand: o.brand || undefined,
      price: typeof o.price === 'number' ? o.price : parseFloat(String(o.price)) || 0,
      oldPrice: o.oldPrice ? (typeof o.oldPrice === 'number' ? o.oldPrice : parseFloat(String(o.oldPrice))) : undefined,
      discountPercent: o.discountPercent || undefined,
      sizeText: o.sizeText || undefined,
      imageUrl: o.imageUrl || undefined,
      sourceUrl: sourceUrl || o.sourceUrl || '',
    })).filter(o => o.nameAr && o.price > 0)

    if (normalizedOffers.length === 0) {
      return NextResponse.json(
        { error: 'No valid offers after normalization (need name and price > 0)' },
        { status: 400, headers }
      )
    }

    const logs = [`[Browser] Received ${offers.length} offers, ${normalizedOffers.length} valid`]
    const ingestService = new OfferIngestService()
    const result = await ingestService.ingest(supermarketSlug, normalizedOffers, logs)

    // Save scrape log
    await prisma.scrapeLog.create({
      data: {
        supermarketSlug,
        offersFound: normalizedOffers.length,
        offersCreated: result.newOffers,
        offersSkipped: result.duplicatesSkipped,
        durationMs: 0,
        success: true,
        logs: `Browser scrape from ${sourceUrl}`,
      },
    })

    return NextResponse.json({
      success: true,
      supermarket: supermarketSlug,
      received: offers.length,
      valid: normalizedOffers.length,
      newOffers: result.newOffers,
      duplicatesSkipped: result.duplicatesSkipped,
      flyerId: result.flyerId,
    }, { headers })
  } catch (error) {
    console.error('Scrape submit error:', error)
    return NextResponse.json(
      { error: 'Failed to process offers', details: error instanceof Error ? error.message : String(error) },
      { status: 500, headers }
    )
  }
}
