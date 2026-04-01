import { BaseScraper } from './base-scraper'
import type { ScrapedOffer } from './types'

/**
 * Extra (eXtra) Scraper — Saudi electronics retailer
 *
 * Uses Unbxd Search API for product data
 * API Key: 21705619e273429e5767eea44ccb1ad5
 * Site Key: ss-unbxd-auk-extra-saudi-en-prod11541714990488
 */
export class ExtraScraper extends BaseScraper {
  private readonly unbxdApiKey = '21705619e273429e5767eea44ccb1ad5'
  private readonly unbxdSiteKey = 'ss-unbxd-auk-extra-saudi-en-prod11541714990488'

  constructor() {
    super({
      supermarketSlug: 'extra',
      name: 'Extra',
      nameAr: 'اكسترا',
      baseUrl: 'https://www.extra.com',
      offersUrl: 'https://search.unbxd.io',
      maxPages: 5,
      requestDelayMs: 1000,
    })
  }

  protected async extractOffers(): Promise<ScrapedOffer[]> {
    const allOffers: ScrapedOffer[] = []
    const rowsPerPage = 50

    // Search for popular product categories
    const queries = ['samsung', 'iphone', 'laptop', 'tv', 'headphone', 'tablet', 'airpods', 'playstation', 'washing machine', 'aircon', 'dyson', 'apple watch']

    for (const query of queries) {
      try {
        const url = `https://search.unbxd.io/${this.unbxdApiKey}/${this.unbxdSiteKey}/search?q=${encodeURIComponent(query)}&rows=${rowsPerPage}&format=json&fields=title,nameAr,productCode,productUrl,brandEn,price,wasPrice,priceValueDiscountPercentage,imageUrl,amplienceProductBaseUrl,allCategoriesEn`

        this.log(`Searching Unbxd for "${query}"...`)
        const response = await this.fetchWithRetry(url, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        })

        const data = await response.json()
        const products = data.response?.products || []
        this.pagesScraped++

        let added = 0
        for (const product of products) {
          const offer = this.transformProduct(product)
          if (offer) {
            // Dedup by sourceUrl
            if (!allOffers.some(o => o.sourceUrl === offer.sourceUrl)) {
              allOffers.push(offer)
              added++
            }
          }
        }

        this.log(`"${query}": ${products.length} results, ${added} new (total: ${allOffers.length})`)
        await this.delay(this.config.requestDelayMs || 1000)
      } catch (e) {
        this.logError(`Search "${query}" failed: ${e instanceof Error ? e.message : e}`)
      }
    }

    this.log(`Total extracted: ${allOffers.length}`)
    return allOffers
  }

  private transformProduct(product: any): ScrapedOffer | null {
    const titleEn = product.title || ''
    const titleAr = product.nameAr || titleEn
    if (!titleEn || titleEn.length < 3) return null

    const price = parseFloat(product.price) || parseFloat(product.sellingPrice) || 0
    if (price <= 0) return null

    const wasPrice = parseFloat(product.wasPrice) || 0
    const oldPrice = wasPrice > price ? wasPrice : undefined
    const discountPercent = parseFloat(product.priceValueDiscountPercentage) || undefined

    // Image URL - try direct imageUrl first, then Amplience CDN
    let imageUrl: string | undefined
    const rawImg = product.imageUrl
    if (rawImg && typeof rawImg === 'string') {
      imageUrl = rawImg
    }
    if (!imageUrl) {
      const baseUrl = product.amplienceProductBaseUrl
      if (baseUrl && typeof baseUrl === 'string') {
        imageUrl = baseUrl.startsWith('//') ? `https:${baseUrl}` : baseUrl.startsWith('http') ? baseUrl : `https://media.extra.com/s/aurora/${baseUrl}`
      }
    }
    if (imageUrl && typeof imageUrl === 'string' && !imageUrl.startsWith('http')) {
      imageUrl = `https://media.extra.com${imageUrl}`
    }
    if (!imageUrl) return null

    const productUrl = product.productUrl || ''
    const sourceUrl = productUrl.startsWith('http')
      ? productUrl
      : `https://www.extra.com${productUrl}`

    const brand = product.brandEn || undefined
    const categories = product.allCategoriesEn
    const categoryTag = Array.isArray(categories) ? categories[0] : undefined

    return {
      nameAr: titleAr,
      nameEn: titleEn,
      price,
      oldPrice,
      discountPercent,
      imageUrl,
      sourceUrl,
      brand,
      tags: ['extra', categoryTag].filter(Boolean).join(','),
    }
  }
}
