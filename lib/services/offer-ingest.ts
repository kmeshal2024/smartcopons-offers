import { prisma } from '@/lib/db'
import { CategoryMapper } from './category-mapper'
import type { ScrapedOffer } from '@/lib/scrapers/types'
import { createHash } from 'crypto'

interface IngestResult {
  supermarket: string
  totalScraped: number
  newOffers: number
  duplicatesSkipped: number
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
    logs: string[]
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

    // Compute hashes for dedup
    const offerHashes = offers.map(o => ({
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
    for (const { offer, hash } of offerHashes) {
      if (existingHashes.has(hash)) continue

      try {
        const categoryId = await categoryMapper.mapToCategory(
          offer.nameAr || offer.nameEn || ''
        )

        await prisma.productOffer.create({
          data: {
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
          },
        })
        created++
      } catch (error) {
        console.error('Error creating product:', error)
      }
    }

    // Update flyer log
    await prisma.flyer.update({
      where: { id: flyer.id },
      data: {
        extractedAt: new Date(),
        extractionLog: logs.join('\n'),
      },
    })

    return {
      supermarket: supermarketSlug,
      totalScraped: offers.length,
      newOffers: created,
      duplicatesSkipped: offers.length - created,
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
