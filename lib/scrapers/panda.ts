import { BaseScraper } from './base-scraper'
import type { ScrapedOffer } from './types'
import { generateArabicTags } from './grocery-tags'

/**
 * Panda (بنده) Scraper — uses the clean JSON deals API
 *
 * Endpoint: https://panda.sa/api/products?deals=1&per_page=60&page=N
 * Returns: { products: { status, data: { total_records, next_page, products[] } } }
 *
 * Each product has varieties[] with price, undiscounted_price, discount_label, images.
 * Only fetches deals (deals=1 filter) — no full catalog.
 */
export class PandaScraper extends BaseScraper {
  private static readonly API_URL = 'https://panda.sa/api/products'
  private static readonly PER_PAGE = 60
  private static readonly MAX_PAGES = 15 // safety cap: 15 * 60 = 900 max offers

  constructor() {
    super({
      supermarketSlug: 'panda',
      name: 'Panda',
      nameAr: 'بنده',
      baseUrl: 'https://panda.sa',
      offersUrl: 'https://panda.sa/api/products?deals=1',
      maxPages: PandaScraper.MAX_PAGES,
      requestDelayMs: 1500,
    })
  }

  protected async extractOffers(): Promise<ScrapedOffer[]> {
    const allOffers: ScrapedOffer[] = []
    let page = 1
    let hasNext = true

    while (hasNext && page <= PandaScraper.MAX_PAGES) {
      const url = `${PandaScraper.API_URL}?deals=1&per_page=${PandaScraper.PER_PAGE}&page=${page}`
      this.log(`Fetching page ${page}: ${url}`)

      try {
        const response = await this.fetchWithRetry(url, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        })

        const json = await response.json()
        const data = json?.products?.data

        if (!data || !Array.isArray(data.products)) {
          this.logError(`Unexpected API response on page ${page}`)
          break
        }

        this.pagesScraped++
        const totalRecords = data.total_records || 0

        if (page === 1) {
          this.log(`Total deals available: ${totalRecords}`)
        }

        const pageOffers = this.mapProducts(data.products)
        allOffers.push(...pageOffers)
        this.log(`Page ${page}: ${pageOffers.length} deals mapped (running total: ${allOffers.length})`)

        hasNext = !!data.next_page
        page++

        // Rate limit: polite delay between pages
        if (hasNext) {
          await this.delay(this.config.requestDelayMs || 1500)
        }
      } catch (error) {
        this.logError(`Page ${page} failed: ${error instanceof Error ? error.message : String(error)}`)
        break
      }
    }

    this.log(`Scrape complete: ${allOffers.length} total deals from ${this.pagesScraped} pages`)
    return allOffers
  }

  private mapProducts(products: any[]): ScrapedOffer[] {
    const offers: ScrapedOffer[] = []

    for (const product of products) {
      try {
        const variety = product.varieties?.[0]
        if (!variety) continue

        const name = product.name?.trim()
        if (!name || name.length < 3) continue

        const price = parseFloat(variety.price)
        if (!price || price <= 0) continue

        // Only include actual deals
        if (!variety.show_discount) continue

        const oldPrice = variety.undiscounted_price
          ? parseFloat(variety.undiscounted_price)
          : undefined

        // Parse discount percent from label like "26% Off"
        let discountPercent: number | undefined
        const discountLabel = variety.discount_label || ''
        const percentMatch = discountLabel.match(/(\d+)%/)
        if (percentMatch) {
          discountPercent = parseInt(percentMatch[1])
        } else if (oldPrice && oldPrice > price) {
          // Calculate if not in label (e.g. "Any 2 for 12.99 SR")
          discountPercent = Math.round(((oldPrice - price) / oldPrice) * 100)
        }

        // Get best image URL (large version)
        let imageUrl: string | undefined
        if (variety.images?.[0]?.[1]) {
          imageUrl = variety.images[0][1] // large image
        } else if (variety.images?.[0]?.[0]) {
          imageUrl = variety.images[0][0] // original image
        } else if (variety.imageURL) {
          imageUrl = variety.imageURL // thumbnail fallback
        }

        const brand = product.brand?.name || undefined
        const category = product.category?.name || undefined
        const size = variety.size && variety.unit
          ? `${variety.size} ${variety.unit}`
          : undefined

        const baseTags = [
          'panda',
          'deals',
          category ? category.toLowerCase() : undefined,
          discountLabel.includes('Any') ? 'bundle-deal' : undefined,
        ].filter(Boolean).join(',')

        const arabicTags = generateArabicTags(name, baseTags)

        offers.push({
          nameAr: name,     // Panda API only has English names
          nameEn: name,
          brand,
          price,
          oldPrice,
          discountPercent,
          sizeText: size,
          imageUrl,
          sourceUrl: `https://panda.sa/en/plp?deals=1`,
          tags: arabicTags ? `${baseTags},${arabicTags}` : baseTags,
        })
      } catch {
        // Skip malformed products
      }
    }

    return offers
  }
}
