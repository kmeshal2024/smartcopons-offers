import { BaseScraper } from './base-scraper'
import type { ScrapedOffer } from './types'

export class DanubeScraper extends BaseScraper {
  constructor() {
    super({
      supermarketSlug: 'danube',
      name: 'Danube',
      nameAr: 'الدانوب',
      baseUrl: 'https://www.danube.sa',
      offersUrl: 'https://www.danube.sa/api/products',
      maxPages: 10,
      requestDelayMs: 1000,
    })
  }

  // Danube uses Spree Commerce — we can fetch products directly from their JSON API
  private readonly apiUrl = 'https://www.danube.sa/api/products'

  protected async extractOffers(): Promise<ScrapedOffer[]> {
    const allOffers: ScrapedOffer[] = []

    for (let page = 1; page <= (this.config.maxPages || 10); page++) {
      try {
        const url = `${this.apiUrl}?page=${page}&per_page=50&q[s]=updated_at+desc`
        this.log(`Fetching page ${page}...`)

        const response = await this.fetchWithRetry(url)
        const data = await response.json()
        const products = data.products || []

        if (products.length === 0) {
          this.log(`Page ${page}: empty, stopping`)
          break
        }

        this.pagesScraped++
        this.log(`Page ${page}: ${products.length} products`)

        for (const p of products) {
          const offer = this.transformProduct(p)
          if (offer) allOffers.push(offer)
        }

        await this.delay(this.config.requestDelayMs || 1000)
      } catch (e) {
        this.logError(`Page ${page} failed: ${e instanceof Error ? e.message : e}`)
        break
      }
    }

    this.log(`Total offers extracted: ${allOffers.length}`)
    return allOffers
  }

  private transformProduct(p: any): ScrapedOffer | null {
    const name = p.name || ''
    const nameAr = p.name_ar || p.meta_description_ar || ''
    if (!name && !nameAr) return null

    const price = parseFloat(p.price) || 0
    if (price <= 0) return null

    const originalPrice = parseFloat(p.original_price) || 0
    const oldPrice = originalPrice > price ? originalPrice : undefined

    // Calculate discount
    let discountPercent: number | undefined
    if (oldPrice && oldPrice > price) {
      discountPercent = Math.round(((oldPrice - price) / oldPrice) * 100)
    }

    // Get image URL
    let imageUrl: string | undefined
    if (p.images && p.images.length > 0) {
      imageUrl = p.images[0].product_url || p.images[0].large_url || p.images[0].small_url
    }

    return {
      nameEn: name,
      nameAr: nameAr || name,
      price,
      oldPrice,
      discountPercent,
      imageUrl,
      sourceUrl: `https://www.danube.sa/en/products/${p.slug || p.id}`,
    }
  }
}
