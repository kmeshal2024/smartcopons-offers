import { prisma } from '@/lib/db'
import { CategoryMapper } from './category-mapper'
import type { ScrapedOffer, ScrapedFlyerAsset } from '@/lib/scrapers/types'
import { createHash } from 'crypto'

interface IngestResult {
  supermarket: string
  totalScraped: number
  /** Rows that passed the product sanity check (price > 0, real name). */
  usableOffers: number
  newOffers: number
  duplicatesSkipped: number
  /** Existing products seen again and moved onto the current flyer. */
  refreshedOffers: number
  flyerId: string
}

function computeOfferHash(
  supermarketId: string,
  nameAr: string,
  price: number,
  sourceUrl: string
): string {
  const input = `${supermarketId}|${nameAr}|${price}|${sourceUrl}`
  return createHash('sha256').update(input).digest('hex').substring(0, 32)
}

export class OfferIngestService {
  async ingest(
    supermarketSlug: string,
    offers: ScrapedOffer[],
    logs: string[],
    flyerAsset?: ScrapedFlyerAsset
  ): Promise<IngestResult> {
    const supermarket = await prisma.supermarket.findUnique({
      where: { slug: supermarketSlug },
    })
    if (!supermarket) throw new Error(`Supermarket ${supermarketSlug} not found`)

    // Find or create weekly flyer
    const flyer = await this.findOrCreateWeeklyFlyer(supermarket.id, supermarket.name, supermarket.nameAr)

    // Init category mapper
    const categoryMapper = new CategoryMapper()
    await categoryMapper.initialize()

    // Reject rows that are not really products. The flyer scrapers emit
    // placeholder entries (price 0, generic names like "العروض") to represent a
    // brochure; those now travel as a ScrapedFlyerAsset instead, so they must
    // not reach the catalogue and show up as 0.00 ر.س product cards.
    const usable = offers.filter(
      o => o.price > 0 && (o.nameAr || o.nameEn || '').trim().length >= 8
    )
    const rejected = offers.length - usable.length
    if (rejected > 0) {
      logs.push(`[ingest] Rejected ${rejected} non-product rows (price 0 or generic name)`)
    }

    // Compute hashes for dedup
    const offerHashes = usable.map(o => ({
      offer: o,
      hash: computeOfferHash(supermarket.id, o.nameAr, o.price, o.sourceUrl),
    }))

    // Check existing
    const existingHashes = new Set(
      (await prisma.productOffer.findMany({
        where: { sourceHash: { in: offerHashes.map(h => h.hash) } },
        select: { sourceHash: true },
      })).map(p => p.sourceHash)
    )

    // Create new offers
    let created = 0
    // Products seen again in this run are still on offer — they must move to the
    // current flyer. Previously they were simply skipped, which left them
    // attached to the first flyer they ever appeared in. Once that flyer ended
    // they vanished from the site even though the retailer still sells them at
    // that price, which is why stores with thousands of scraped products were
    // showing almost none.
    const stillOffered: string[] = []

    // Build the rows first, then insert in batches. One `create` per offer meant
    // a database round trip per product; a full catalogue run (~1200 offers)
    // took long enough to push the cron against its 120s limit.
    const rows: any[] = []
    const seenHashes = new Set<string>()

    for (const { offer, hash } of offerHashes) {
      if (existingHashes.has(hash)) {
        stillOffered.push(hash)
        continue
      }
      // A single scrape can return the same item twice (e.g. listed under two
      // categories). sourceHash is only indexed, not unique, so the database
      // would happily store both — dedupe in memory instead.
      if (seenHashes.has(hash)) continue
      seenHashes.add(hash)

      const categoryId = await categoryMapper.mapToCategory(
        offer.nameAr || offer.nameEn || ''
      )

      rows.push({
        flyerId: flyer.id,
        supermarketId: supermarket.id,
        categoryId,
        nameAr: offer.nameAr || null,
        nameEn: offer.nameEn || null,
        brand: offer.brand || null,
        price: offer.price,
        oldPrice: offer.oldPrice || null,
        discountPercent: offer.discountPercent || null,
        sizeText: offer.sizeText || null,
        imageUrl: offer.imageUrl || null,
        sourceUrl: offer.sourceUrl,
        sourceHash: hash,
        pageNumber: offer.pageNumber || 1,
        tags: offer.tags || null,
        confidence: 0.7,
        isHidden: false,
      })
    }

    for (let i = 0; i < rows.length; i += 500) {
      try {
        const res = await prisma.productOffer.createMany({
          data: rows.slice(i, i + 500),
        })
        created += res.count
      } catch (error) {
        console.error('Error creating product batch:', error)
      }
    }

    // Re-attach still-offered products to this week's flyer so they stay live.
    // Chunked because `in` lists get large for a full catalogue scrape.
    let refreshed = 0
    for (let i = 0; i < stillOffered.length; i += 500) {
      const batch = stillOffered.slice(i, i + 500)
      const res = await prisma.productOffer.updateMany({
        where: { sourceHash: { in: batch }, supermarketId: supermarket.id },
        data: { flyerId: flyer.id },
      })
      refreshed += res.count
    }
    if (refreshed > 0) {
      logs.push(`[ingest] Re-attached ${refreshed} still-offered products to the current flyer`)
    }

    // Update flyer log, and attach the brochure assets when the scraper found
    // one so FlyerViewer has a PDF to render.
    await prisma.flyer.update({
      where: { id: flyer.id },
      data: {
        extractedAt: new Date(),
        extractionLog: logs.join('\n'),
        ...(flyerAsset?.pdfUrl ? { pdfUrl: flyerAsset.pdfUrl } : {}),
        ...(flyerAsset?.coverImage ? { coverImage: flyerAsset.coverImage } : {}),
        ...(flyerAsset?.totalPages ? { totalPages: flyerAsset.totalPages } : {}),
        ...(flyerAsset?.titleAr ? { titleAr: flyerAsset.titleAr } : {}),
      },
    })

    return {
      supermarket: supermarketSlug,
      totalScraped: offers.length,
      usableOffers: usable.length,
      newOffers: created,
      duplicatesSkipped: usable.length - created,
      refreshedOffers: refreshed,
      flyerId: flyer.id,
    }
  }

  private async findOrCreateWeeklyFlyer(
    supermarketId: string,
    name: string,
    nameAr: string
  ) {
    const today = new Date()
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay())
    startOfWeek.setHours(0, 0, 0, 0)

    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6)
    endOfWeek.setHours(23, 59, 59, 999)

    const existing = await prisma.flyer.findFirst({
      where: {
        supermarketId,
        startDate: { gte: startOfWeek },
        endDate: { lte: endOfWeek },
        status: { in: ['ACTIVE', 'DRAFT'] },
      },
    })

    if (existing) return existing

    const weekStr = today.toISOString().split('T')[0]
    return prisma.flyer.create({
      data: {
        supermarketId,
        title: `${name} Offers - Week of ${weekStr}`,
        titleAr: `عروض ${nameAr} - ${weekStr}`,
        startDate: startOfWeek,
        endDate: endOfWeek,
        status: 'ACTIVE',
      },
    })
  }
}
