import { BaseScraper } from './base-scraper'
import type { ScrapedOffer } from './types'

/**
 * Tamimi Markets Scraper
 *
 * Target: shop.tamimimarkets.com
 * Strategy: Fetch product data from Tamimi's online shop API.
 *
 * Tamimi Markets (التميمي) is one of the largest Saudi supermarket chains,
 * primarily in Riyadh, Eastern Province, and Jeddah.
 *
 * NOTE: This is a starter implementation. The scraper fetches from Tamimi's
 * public-facing shop API. If the API structure changes, the transform logic
 * will need updating.
 */
export class TamimiScraper extends BaseScraper {
  constructor() {
    super({
      supermarketSlug: 'tamimi',
      name: 'Tamimi Markets',
      nameAr: 'أسواق التميمي',
      baseUrl: 'https://shop.tamimimarkets.com',
      offersUrl: 'https://shop.tamimimarkets.com/api/products/offers',
      maxPages: 3,
      requestDelayMs: 1000,
    })
  }

  protected async extractOffers(): Promise<ScrapedOffer[]> {
    const allOffers: ScrapedOffer[] = []

    // Strategy 1: Try the shop API for promotions/offers
    try {
      this.log('Attempting to fetch Tamimi offers via shop API...')
      const offers = await this.fetchFromShopApi()
      if (offers.length > 0) {
        allOffers.push(...offers)
        this.log(`Shop API: ${offers.length} offers found`)
        return allOffers
      }
    } catch (e) {
      this.logError(`Shop API failed: ${e instanceof Error ? e.message : e}`)
    }

    // Strategy 2: Scrape the offers/promotions page
    try {
      this.log('Fallback: scraping Tamimi promotions page...')
      const offers = await this.scrapePromotionsPage()
      allOffers.push(...offers)
      this.log(`Promotions page: ${offers.length} offers found`)
    } catch (e) {
      this.logError(`Promotions page scrape failed: ${e instanceof Error ? e.message : e}`)
    }

    this.log(`Total Tamimi offers: ${allOffers.length}`)
    return allOffers
  }

  private async fetchFromShopApi(): Promise<ScrapedOffer[]> {
    const url = 'https://shop.tamimimarkets.com/api/products?on_sale=true&per_page=50'

    const response = await this.fetchWithRetry(url, {
      headers: {
        'Accept': 'application/json',
      },
    })

    const data = await response.json()
    const products = data.products || data.data || data.items || []
    this.pagesScraped++

    return products
      .map((p: any) => this.transformProduct(p))
      .filter((o: ScrapedOffer | null): o is ScrapedOffer => o !== null)
  }

  private async scrapePromotionsPage(): Promise<ScrapedOffer[]> {
    // Tamimi may have an offers page we can parse
    const url = 'https://shop.tamimimarkets.com/offers'
    const response = await this.fetchWithRetry(url, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
      },
    })

    const html = await response.text()
    this.pagesScraped++

    // Try to extract __NEXT_DATA__ or similar embedded JSON
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1])
        const products = nextData?.props?.pageProps?.products ||
          nextData?.props?.pageProps?.offers ||
          nextData?.props?.pageProps?.data?.products || []

        return products
          .map((p: any) => this.transformProduct(p))
          .filter((o: ScrapedOffer | null): o is ScrapedOffer => o !== null)
      } catch {
        this.log('Could not parse __NEXT_DATA__')
      }
    }

    return []
  }

  private transformProduct(p: any): ScrapedOffer | null {
    const name = p.name || p.title || ''
    const nameAr = p.name_ar || p.nameAr || p.arabic_name || name
    const nameEn = p.name_en || p.nameEn || p.english_name || name

    if (!nameAr && !nameEn) return null

    const price = parseFloat(p.price || p.sale_price || p.current_price || 0)
    if (price <= 0) return null

    const originalPrice = parseFloat(p.original_price || p.compare_at_price || p.old_price || 0)
    const oldPrice = originalPrice > price ? originalPrice : undefined

    let discountPercent: number | undefined
    if (oldPrice && oldPrice > price) {
      discountPercent = Math.round(((oldPrice - price) / oldPrice) * 100)
    }

    // Only include discounted items
    if (!discountPercent || discountPercent < 5) return null

    let imageUrl = p.image_url || p.imageUrl || p.image || p.thumbnail || undefined
    if (imageUrl && !imageUrl.startsWith('http')) {
      imageUrl = `https://shop.tamimimarkets.com${imageUrl}`
    }

    const slug = p.slug || p.id || ''
    return {
      nameAr: nameAr || nameEn,
      nameEn: nameEn || undefined,
      price,
      oldPrice,
      discountPercent,
      imageUrl,
      sourceUrl: slug
        ? `https://shop.tamimimarkets.com/products/${slug}`
        : `https://shop.tamimimarkets.com`,
      brand: p.brand || p.brand_name || undefined,
    }
  }
}
