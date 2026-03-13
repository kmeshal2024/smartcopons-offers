import { BaseScraper } from './base-scraper'
import type { ScrapedOffer } from './types'

/**
 * Danube Scraper — Uses Algolia Search API for reliable product data.
 *
 * Strategy: Query Algolia index for products, filter for discounted items only
 * (where compare_at_price > price). This ensures we import DEALS, not the full catalog.
 *
 * Algolia provides: Arabic + English names, prices, discount info, images, categories.
 */
export class DanubeScraper extends BaseScraper {
  constructor() {
    super({
      supermarketSlug: 'danube',
      name: 'Danube',
      nameAr: 'الدانوب',
      baseUrl: 'https://www.danube.sa',
      offersUrl: 'https://1d2iewlqad-dsn.algolia.net/1/indexes/spree_products/query',
      maxPages: 5,
      requestDelayMs: 500,
    })
  }

  private readonly algoliaAppId = '1D2IEWLQAD'
  private readonly algoliaApiKey = '87ca3b6b2ce56f0bb76fc194a8d170e2'
  private readonly algoliaIndex = 'spree_products'

  protected async extractOffers(): Promise<ScrapedOffer[]> {
    const allOffers: ScrapedOffer[] = []
    const maxPages = this.config.maxPages || 5
    const hitsPerPage = 50

    for (let page = 0; page < maxPages; page++) {
      try {
        this.log(`Fetching Algolia page ${page + 1}/${maxPages}...`)

        const url = `https://${this.algoliaAppId.toLowerCase()}-dsn.algolia.net/1/indexes/${this.algoliaIndex}/query`

        const response = await this.fetchWithRetry(url, {
          method: 'POST',
          headers: {
            'X-Algolia-Application-Id': this.algoliaAppId,
            'X-Algolia-API-Key': this.algoliaApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            params: `hitsPerPage=${hitsPerPage}&page=${page}`,
          }),
        })

        const data = await response.json()
        const hits = data.hits || []

        if (hits.length === 0) {
          this.log(`Page ${page + 1}: empty, stopping`)
          break
        }

        this.pagesScraped++
        let dealsOnPage = 0

        for (const hit of hits) {
          const offer = this.transformHit(hit)
          if (offer) {
            allOffers.push(offer)
            dealsOnPage++
          }
        }

        this.log(`Page ${page + 1}: ${hits.length} products, ${dealsOnPage} deals extracted`)

        // Stop if we've reached the end
        if (hits.length < hitsPerPage) break

        await this.delay(this.config.requestDelayMs || 500)
      } catch (e) {
        this.logError(`Algolia page ${page + 1} failed: ${e instanceof Error ? e.message : e}`)
        break
      }
    }

    this.log(`Total deals extracted: ${allOffers.length}`)
    return allOffers
  }

  private transformHit(hit: any): ScrapedOffer | null {
    const price = parseFloat(hit.price) || 0
    if (price <= 0) return null

    // Get names
    const nameEn = hit.name || ''
    const nameAr = hit.name_ar || hit.name || ''
    if (!nameAr && !nameEn) return null

    // Calculate discount — only include products with actual deals
    const compareAt = parseFloat(hit.compare_at_price) || 0
    const oldPrice = compareAt > price ? compareAt : undefined
    let discountPercent: number | undefined

    if (oldPrice && oldPrice > price) {
      discountPercent = Math.round(((oldPrice - price) / oldPrice) * 100)
    }

    // DEALS FILTER: only include items with a discount OR featured/promotional items
    // Skip full-price catalog items to keep the database focused on deals
    const hasDiscount = discountPercent && discountPercent >= 5
    const isFeatured = hit.featured || hit.on_sale || hit.is_promoted

    if (!hasDiscount && !isFeatured) {
      // Still include items without explicit discount if they appear to be weekly deals
      // (items recently updated or with promotional tags)
      const hasPromoTag = (hit.tag_list || []).some((t: string) =>
        /offer|sale|deal|عرض|خصم|تخفيض/i.test(t)
      )
      if (!hasPromoTag) return null
    }

    // Get image URL from Algolia hit
    let imageUrl: string | undefined
    if (hit.image_url) {
      imageUrl = hit.image_url
    } else if (hit.images && hit.images.length > 0) {
      imageUrl = hit.images[0].product_url || hit.images[0].large_url || hit.images[0].small_url
    } else if (hit.master_images && hit.master_images.length > 0) {
      imageUrl = hit.master_images[0]
    }

    // Ensure absolute URL
    if (imageUrl && !imageUrl.startsWith('http')) {
      imageUrl = `https://www.danube.sa${imageUrl}`
    }

    // Validate image host
    if (imageUrl) {
      try {
        const host = new URL(imageUrl).hostname
        const allowed = ['d1c124wpoew66.cloudfront.net', 'www.danube.sa', 'danube.sa', 'cdn.danube.sa']
        if (!allowed.some(h => host.includes(h))) {
          imageUrl = undefined
        }
      } catch {
        imageUrl = undefined
      }
    }

    // Extract size/weight from name
    const sizeMatch = (nameEn || nameAr).match(/(\d+(?:\.\d+)?\s*(?:kg|g|ml|l|ltr|litre|pcs?|pack)\b)/i)
    const sizeText = sizeMatch ? sizeMatch[1] : undefined

    // Build source URL
    const slug = hit.slug || hit.objectID
    const sourceUrl = slug
      ? `https://www.danube.sa/en/products/${slug}`
      : `https://www.danube.sa/en/products/${hit.objectID}`

    return {
      nameAr,
      nameEn: nameEn || undefined,
      price,
      oldPrice,
      discountPercent,
      imageUrl,
      sourceUrl,
      sizeText,
      brand: hit.brand_name || undefined,
      tags: (hit.tag_list || []).join(',') || undefined,
    }
  }
}
