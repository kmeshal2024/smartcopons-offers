import { BaseScraper } from './base-scraper'
import type { ScrapedOffer } from './types'

/**
 * BinDawood Scraper — Uses its own Algolia Search API (separate from Danube)
 *
 * Algolia App: KBGHG5MR5E, Index: spree_products, tenant_key: BIN, tenant_id: 2
 * 21,525 total products with full data: name_en, name_ar, price, image (S3), url_en
 */
export class BinDawoodScraper extends BaseScraper {
  constructor() {
    super({
      supermarketSlug: 'bindawood',
      name: 'BinDawood',
      nameAr: 'بن داود',
      baseUrl: 'https://www.bindawood.sa',
      offersUrl: 'https://kbghg5mr5e-dsn.algolia.net/1/indexes/spree_products/query',
      maxPages: 10,
      requestDelayMs: 500,
    })
  }

  private readonly algoliaAppId = 'KBGHG5MR5E'
  private readonly algoliaApiKey = '8c6b85b7bdebb06d260ccde6b810884b'

  protected async extractOffers(): Promise<ScrapedOffer[]> {
    const allOffers: ScrapedOffer[] = []
    const hitsPerPage = 50
    const url = `https://${this.algoliaAppId.toLowerCase()}-dsn.algolia.net/1/indexes/spree_products/query`
    const headers = {
      'X-Algolia-Application-Id': this.algoliaAppId,
      'X-Algolia-API-Key': this.algoliaApiKey,
      'Content-Type': 'application/json',
    }

    // Strategy 1: Try on_sale items
    try {
      const response = await this.fetchWithRetry(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          params: `hitsPerPage=${hitsPerPage}&page=0&filters=tenant_id%20%3D%202%20AND%20on_sale%20%3D%201`,
        }),
      })
      const data = await response.json()
      if (data.nbHits > 0) {
        this.log(`Found ${data.nbHits} on_sale items`)
        for (const hit of data.hits) {
          const offer = this.transformHit(hit)
          if (offer) allOffers.push(offer)
        }
      }
    } catch (e) {
      this.log(`on_sale query failed: ${e instanceof Error ? e.message : e}`)
    }

    // Strategy 2: Search for promotional keywords
    const queries = ['عرض', 'offer', 'خصم', 'تخفيض', 'sale']
    for (const q of queries) {
      try {
        const response = await this.fetchWithRetry(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            params: `hitsPerPage=${hitsPerPage}&page=0&query=${encodeURIComponent(q)}&filters=tenant_id%20%3D%202`,
          }),
        })
        const data = await response.json()
        if (data.hits && data.hits.length > 0) {
          this.log(`Query "${q}": ${data.nbHits} hits`)
          for (const hit of data.hits) {
            const offer = this.transformHit(hit)
            if (offer) allOffers.push(offer)
          }
        }
        await this.delay(300)
      } catch { /* skip */ }
    }

    // Strategy 3: Import popular products with images (paginated)
    {
      const maxPages = this.config.maxPages || 10
      const seenUrls = new Set(allOffers.map(o => o.sourceUrl))
      for (let page = 0; page < maxPages; page++) {
        try {
          this.log(`Fetching all products page ${page + 1}/${maxPages}...`)
          const response = await this.fetchWithRetry(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              params: `hitsPerPage=${hitsPerPage}&page=${page}&filters=tenant_id%20%3D%202`,
            }),
          })
          const data = await response.json()
          const hits = data.hits || []
          if (hits.length === 0) break

          this.pagesScraped++
          for (const hit of hits) {
            const offer = this.transformHit(hit)
            if (offer && !seenUrls.has(offer.sourceUrl)) {
              seenUrls.add(offer.sourceUrl)
              allOffers.push(offer)
            }
          }
          this.log(`Page ${page + 1}: ${hits.length} products, ${allOffers.length} total`)
          if (hits.length < hitsPerPage) break
          await this.delay(this.config.requestDelayMs || 500)
        } catch (e) {
          this.logError(`Page ${page + 1} failed: ${e instanceof Error ? e.message : e}`)
          break
        }
      }
    }

    this.log(`Total extracted: ${allOffers.length}`)
    return allOffers
  }

  private transformHit(hit: any): ScrapedOffer | null {
    const price = parseFloat(hit.price) || 0
    if (price <= 0) return null

    const nameEn = hit.name_en || hit.full_name_en || ''
    const nameAr = hit.name_ar || hit.full_name_ar || nameEn
    if (!nameAr && !nameEn) return null

    const origPrice = parseFloat(hit.original_price) || 0
    const oldPrice = origPrice > price ? origPrice : undefined
    let discountPercent: number | undefined
    if (oldPrice) {
      discountPercent = Math.round(((oldPrice - price) / oldPrice) * 100)
    }

    // BinDawood uses S3 images
    let imageUrl: string | undefined = hit.image || undefined
    if (imageUrl && !imageUrl.startsWith('http')) {
      imageUrl = `https://www.bindawood.sa${imageUrl}`
    }
    if (!imageUrl) return null

    const sizeMatch = (nameEn || nameAr).match(/(\d+(?:\.\d+)?\s*(?:kg|g|ml|l|ltr|litre|pcs?|pack)\b)/i)

    const sourceUrl = hit.url_en
      ? `https://www.bindawood.sa${hit.url_en}`
      : `https://www.bindawood.sa/en/products/${hit.objectID}`

    return {
      nameAr,
      nameEn: nameEn || undefined,
      price,
      oldPrice,
      discountPercent,
      imageUrl,
      sourceUrl,
      sizeText: sizeMatch ? sizeMatch[1] : undefined,
      brand: hit.brand_en || hit.brand_ar || undefined,
    }
  }
}
