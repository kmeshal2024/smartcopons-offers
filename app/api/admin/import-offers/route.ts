import { NextResponse } from 'next/server'
import { OfferIngestService } from '@/lib/services/offer-ingest'
import { prisma } from '@/lib/db'
import type { ScrapedOffer, ScrapedFlyerAsset } from '@/lib/scrapers/types'
import { resolveCountry } from '@/lib/countries'

/**
 * Accept offers collected by a scraper running outside this deployment.
 *
 * Some retailers (Carrefour) sit behind Akamai and only serve their catalogue
 * to a real browser — server-side fetches get a 53-byte shell. Running a full
 * browser inside a serverless function is impractical (bundle size, and a
 * page render alone eats much of the 120s limit), so the browser part runs
 * locally via scripts/scrape-carrefour-playwright.mjs and posts its results
 * here.
 *
 * Reuses OfferIngestService, so imports get the same treatment as cron
 * scrapes: dedup, re-attaching still-offered products to the current flyer,
 * and rejection of placeholder rows.
 *
 * Guarded by APP_SECRET, the same secret the cron routes use.
 *
 *   POST /api/admin/import-offers
 *   { "key": "...", "supermarket": "carrefour", "offers": [ ... ] }
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const MAX_OFFERS = 5000

export async function POST(request: Request) {
  const startedAt = Date.now()

  try {
    const body = await request.json().catch(() => ({}))
    const { key, supermarket, offers = [], logs, meta, replace, flyerAsset } = body as {
      key?: string
      supermarket?: string
      offers?: ScrapedOffer[]
      logs?: string[]
      // Weekly flyer brochure/pages, attached to this week's flyer. May arrive
      // on its own (offers omitted) to refresh only the flyer, or alongside a
      // full product scrape.
      flyerAsset?: ScrapedFlyerAsset
      // Supplied only when onboarding a new retailer (e.g. a pharmacy that has
      // no supermarket row yet). Present → create the row; absent → a missing
      // slug stays a 404, so a typo never silently spawns a store. On an
      // existing store it refreshes the logo/website.
      meta?: { nameAr?: string; nameEn?: string; logo?: string; website?: string; country?: string }
      // Delete this retailer's existing offers before importing. The dedup hash
      // ignores imageUrl/discount, so a plain re-import can't fix a bad image
      // URL — replace forces a clean rebuild.
      replace?: boolean
    }

    const appSecret = process.env.APP_SECRET
    if (!appSecret || key !== appSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!supermarket || !Array.isArray(offers)) {
      return NextResponse.json(
        { error: 'supermarket and offers[] are required' },
        { status: 400 }
      )
    }

    // A flyer-only import (attach/refresh the weekly flyer without re-scraping
    // the whole catalogue) is valid: offers may be empty when flyerAsset is set.
    const hasFlyerAsset = !!(flyerAsset && (flyerAsset.pdfUrl || (flyerAsset.pageImages && flyerAsset.pageImages.length)))
    if (offers.length === 0 && !hasFlyerAsset) {
      return NextResponse.json({ error: 'offers[] is empty (and no flyerAsset)' }, { status: 400 })
    }

    if (offers.length > MAX_OFFERS) {
      return NextResponse.json(
        { error: `Too many offers in one request (max ${MAX_OFFERS}) — send in batches` },
        { status: 413 }
      )
    }

    let store = await prisma.supermarket.findUnique({
      where: { slug: supermarket },
      select: { id: true, nameAr: true, country: true },
    })
    if (!store && meta?.nameAr) {
      // Onboard a new retailer on first import.
      store = await prisma.supermarket.create({
        data: {
          slug: supermarket,
          nameAr: meta.nameAr,
          name: meta.nameEn || meta.nameAr,
          logo: meta.logo,
          website: meta.website,
          country: resolveCountry(meta.country).code,
        },
        select: { id: true, nameAr: true, country: true },
      })
    } else if (store && meta && (meta.logo || meta.website)) {
      // Existing store: let meta refresh the logo/website (e.g. a fixed logo).
      await prisma.supermarket.update({
        where: { id: store.id },
        data: {
          ...(meta.logo && { logo: meta.logo }),
          ...(meta.website && { website: meta.website }),
        },
      })
    }
    if (!store) {
      const known = await prisma.supermarket.findMany({ select: { slug: true } })
      return NextResponse.json(
        { error: `Unknown supermarket: ${supermarket} (pass meta.nameAr to create it)`, known: known.map(s => s.slug) },
        { status: 404 }
      )
    }

    // Normalise: the payload comes from outside, so coerce the numeric fields
    // rather than trusting them.
    const clean: ScrapedOffer[] = offers
      .map(o => ({
        nameAr: String(o.nameAr || '').trim(),
        nameEn: o.nameEn ? String(o.nameEn).trim() : undefined,
        brand: o.brand ? String(o.brand).trim() : undefined,
        price: Number(o.price),
        oldPrice: o.oldPrice != null ? Number(o.oldPrice) : undefined,
        discountPercent: o.discountPercent != null ? Number(o.discountPercent) : undefined,
        sizeText: o.sizeText ? String(o.sizeText).trim() : undefined,
        imageUrl: o.imageUrl ? String(o.imageUrl) : undefined,
        sourceUrl: String(o.sourceUrl || ''),
        tags: o.tags ? String(o.tags) : undefined,
      }))
      .filter(o => o.nameAr.length >= 8 && Number.isFinite(o.price) && o.price > 0)

    if (clean.length === 0 && !hasFlyerAsset) {
      return NextResponse.json(
        { error: 'No usable offers after validation (need nameAr >= 8 chars and price > 0)' },
        { status: 400 }
      )
    }

    // Clean rebuild: drop this retailer's rows so corrected fields (e.g. image
    // URLs) aren't masked by the imageUrl-blind dedup hash.
    let deleted = 0
    if (replace) {
      const res = await prisma.productOffer.deleteMany({ where: { supermarketId: store.id } })
      deleted = res.count
    }

    const ingestService = new OfferIngestService()
    const result = await ingestService.ingest(
      supermarket,
      clean,
      [
        `[import] Received ${offers.length} offers from an external scraper`,
        `[import] ${clean.length} passed validation`,
        ...(hasFlyerAsset ? [`[import] Attaching flyer asset (${flyerAsset!.pageImages?.length || 0} page images${flyerAsset!.pdfUrl ? ', +pdf' : ''})`] : []),
        ...(logs || []).slice(0, 50),
      ],
      hasFlyerAsset ? flyerAsset : undefined
    )

    await prisma.scrapeLog
      .create({
        data: {
          supermarketSlug: supermarket,
          offersFound: offers.length,
          offersCreated: result.newOffers,
          offersSkipped: result.duplicatesSkipped,
          durationMs: Date.now() - startedAt,
          success: true,
          logs: `External import: ${clean.length}/${offers.length} usable`,
        },
      })
      .catch(() => {})

    return NextResponse.json({
      success: true,
      supermarket,
      deleted,
      received: offers.length,
      usable: clean.length,
      newOffers: result.newOffers,
      refreshedOffers: result.refreshedOffers,
      duplicatesSkipped: result.duplicatesSkipped,
      flyerId: result.flyerId,
      flyerAttached: hasFlyerAsset ? { pageImages: flyerAsset!.pageImages?.length || 0, pdf: !!flyerAsset!.pdfUrl } : null,
      durationMs: Date.now() - startedAt,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Offer import failed:', error)
    return NextResponse.json({ error: 'Import failed', details: message }, { status: 500 })
  }
}
