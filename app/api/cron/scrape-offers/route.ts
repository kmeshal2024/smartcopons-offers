import { NextResponse } from 'next/server'
import { getScraper, getAllScraperSlugs } from '@/lib/scrapers/registry'
import { OfferIngestService } from '@/lib/services/offer-ingest'
import { prisma } from '@/lib/db'

export const maxDuration = 120 // 2 minutes max per supermarket

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const key = searchParams.get('key')
  const supermarketSlug = searchParams.get('supermarket')

  // Auth: support both manual key and Vercel cron header
  const cronSecret = process.env.APP_SECRET
  const authHeader = request.headers.get('authorization')
  const isVercelCron = authHeader === `Bearer ${process.env.CRON_SECRET}`
  const isKeyAuth = cronSecret && key === cronSecret

  if (!isVercelCron && !isKeyAuth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // If no supermarket specified, return list of available scrapers
  if (!supermarketSlug) {
    return NextResponse.json({
      availableScrapers: getAllScraperSlugs(),
      usage: 'Add ?supermarket=slug to run a specific scraper',
    })
  }

  const scraper = getScraper(supermarketSlug)
  if (!scraper) {
    return NextResponse.json(
      { error: `Unknown supermarket: ${supermarketSlug}`, available: getAllScraperSlugs() },
      { status: 400 }
    )
  }

  const startTime = Date.now()

  try {
    // Run the scraper
    console.log(`[Cron] Starting scrape for ${supermarketSlug}...`)
    const result = await scraper.scrape()

    let ingestResult = null

    if (result.offers.length > 0) {
      // Ingest into DB
      const ingestService = new OfferIngestService()
      ingestResult = await ingestService.ingest(
        supermarketSlug,
        result.offers,
        result.logs
      )
    }

    // Save scrape log
    await prisma.scrapeLog.create({
      data: {
        supermarketSlug,
        offersFound: result.offers.length,
        offersCreated: ingestResult?.newOffers || 0,
        offersSkipped: ingestResult?.duplicatesSkipped || 0,
        durationMs: Date.now() - startTime,
        success: result.success,
        errorMessage: result.errors.length > 0 ? result.errors.join('\n') : null,
        logs: result.logs.join('\n'),
      },
    })

    console.log(`[Cron] ${supermarketSlug}: ${result.offers.length} found, ${ingestResult?.newOffers || 0} new`)

    return NextResponse.json({
      success: true,
      supermarket: supermarketSlug,
      offersFound: result.offers.length,
      offersCreated: ingestResult?.newOffers || 0,
      duplicatesSkipped: ingestResult?.duplicatesSkipped || 0,
      flyerId: ingestResult?.flyerId || null,
      scraperErrors: result.errors,
      durationMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error(`[Cron] Scrape failed for ${supermarketSlug}:`, error)

    // Save failure log
    try {
      await prisma.scrapeLog.create({
        data: {
          supermarketSlug,
          durationMs: Date.now() - startTime,
          success: false,
          errorMessage: errorMsg,
        },
      })
    } catch { /* don't fail on log save */ }

    return NextResponse.json(
      { error: 'Scrape failed', details: errorMsg },
      { status: 500 }
    )
  }
}
