import { BaseScraper } from './base-scraper'
import type { ScrapedOffer } from './types'

/**
 * Carrefour KSA Scraper — multi-strategy approach
 *
 * Strategy 1: RSC payload extraction from HTML page
 * Strategy 2: Arabic page fallback (different Akamai rules)
 * Strategy 3: Search API endpoint
 *
 * Anti-bot: Akamai Bot Manager — uses browser-like headers.
 * NOTE: May fail from cloud IPs (Vercel/AWS). Works from residential IPs.
 */
export class CarrefourScraper extends BaseScraper {
  private static readonly BASE_URL = 'https://www.carrefourksa.com'
  private static readonly PAGE_SIZE = 60
  private static readonly MAX_PAGES = 20

  constructor() {
    super({
      supermarketSlug: 'carrefour',
      name: 'Carrefour KSA',
      nameAr: 'كارفور',
      baseUrl: CarrefourScraper.BASE_URL,
      offersUrl: `${CarrefourScraper.BASE_URL}/mafsau/en/c/offers`,
      maxPages: CarrefourScraper.MAX_PAGES,
      requestDelayMs: 2000,
    })
  }

  private getHeaders(referer?: string): Record<string, string> {
    return {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'ar-SA,ar;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': referer ? 'same-origin' : 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      ...(referer ? { 'Referer': referer } : {}),
    }
  }

  protected async extractOffers(): Promise<ScrapedOffer[]> {
    // Try multiple deal page URLs
    const dealPages = [
      '/mafsau/en/c/offers',
      '/mafsau/en/c/ksa-best-dealss',
      '/mafsau/ar/c/offers',
      '/mafsau/ar/c/ksa-best-dealss',
    ]

    for (const path of dealPages) {
      try {
        this.log(`Trying ${path}...`)
        const offers = await this.scrapeDealsPage(path)
        if (offers.length > 0) {
          this.log(`Success with ${path}: ${offers.length} offers`)
          return offers
        }
      } catch (e) {
        this.log(`${path} failed: ${e instanceof Error ? e.message : e}`)
      }
    }

    // Strategy 2: Try search API
    try {
      this.log('Trying search API fallback...')
      const offers = await this.trySearchApi()
      if (offers.length > 0) return offers
    } catch (e) {
      this.logError(`Search API failed: ${e instanceof Error ? e.message : e}`)
    }

    this.logError('All Carrefour strategies failed — site may be blocking cloud IPs')
    return []
  }

  private async scrapeDealsPage(path: string): Promise<ScrapedOffer[]> {
    const allOffers: ScrapedOffer[] = []
    let page = 0
    let totalProducts = -1
    let hasMore = true

    while (hasMore && page < CarrefourScraper.MAX_PAGES) {
      const url = `${CarrefourScraper.BASE_URL}${path}?currentPage=${page}&pageSize=${CarrefourScraper.PAGE_SIZE}`

      const response = await this.fetchWithRetry(url, {
        headers: this.getHeaders(page > 0 ? `${CarrefourScraper.BASE_URL}${path}` : undefined),
      })

      const html = await response.text()
      this.log(`Page ${page + 1}: ${html.length} chars`)

      if (html.length < 500) {
        this.logError(`Page ${page + 1}: Akamai blocked (${html.length} chars)`)
        break
      }

      const { products, total } = this.extractProductsFromRSC(html)
      this.pagesScraped++

      if (page === 0 && total > 0) {
        totalProducts = total
        this.log(`Total deals: ${totalProducts}`)
      }

      if (products.length === 0) break

      const pageOffers = this.mapProducts(products)
      allOffers.push(...pageOffers)
      this.log(`Page ${page + 1}: ${pageOffers.length} mapped (total: ${allOffers.length})`)

      const expectedTotal = totalProducts > 0 ? totalProducts : Infinity
      hasMore = allOffers.length < expectedTotal && products.length >= CarrefourScraper.PAGE_SIZE
      page++

      if (hasMore) await this.delay(this.config.requestDelayMs || 2000)
    }

    return allOffers
  }

  private async trySearchApi(): Promise<ScrapedOffer[]> {
    // Try the internal search/product API
    const searchUrls = [
      `${CarrefourScraper.BASE_URL}/api/v1/page/CATEGORY_PAGE?slug=/mafsau/en/c/offers&currentPage=0&pageSize=60&lang=en`,
      `${CarrefourScraper.BASE_URL}/mafsau/en/v4/search?keyword=&currentPage=0&pageSize=60&sortBy=relevance&filter=promotions&lang=en`,
    ]

    for (const url of searchUrls) {
      try {
        const response = await this.fetchWithRetry(url, {
          headers: {
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'ar-SA,ar;q=0.9,en;q=0.8',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Referer': `${CarrefourScraper.BASE_URL}/mafsau/en/c/offers`,
          },
        })

        const data = await response.json()
        const products = data?.products || data?.data?.products || data?.hits || []

        if (Array.isArray(products) && products.length > 0) {
          this.log(`Search API returned ${products.length} products`)
          this.pagesScraped++
          return this.mapProducts(products)
        }
      } catch {
        continue
      }
    }

    return []
  }

  private extractProductsFromRSC(html: string): { products: any[]; total: number } {
    try {
      const pushPattern = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g
      let match: RegExpExecArray | null
      let productsData: any[] = []
      let totalProducts = 0

      while ((match = pushPattern.exec(html)) !== null) {
        const escaped = match[1]
        if (!escaped.includes('\\"products\\"') && !escaped.includes('\\\"products\\\"')) continue

        let rscStream: string
        try { rscStream = JSON.parse(`"${escaped}"`) } catch { continue }

        const totalMatch = rscStream.match(/"totalProducts":\s*(\d+)/)
        if (totalMatch) totalProducts = parseInt(totalMatch[1])

        const productsStart = rscStream.indexOf('"products":[')
        if (productsStart === -1) continue

        const arrayStart = productsStart + '"products":'.length
        const arrayContent = this.extractJSONArray(rscStream, arrayStart)
        if (!arrayContent) continue

        try {
          productsData = JSON.parse(arrayContent)
          if (Array.isArray(productsData) && productsData.length > 0) break
        } catch { continue }
      }

      return { products: productsData, total: totalProducts }
    } catch (error) {
      this.logError(`RSC extraction failed: ${error instanceof Error ? error.message : String(error)}`)
      return { products: [], total: 0 }
    }
  }

  private extractJSONArray(str: string, startPos: number): string | null {
    if (str[startPos] !== '[') return null
    let depth = 0, inString = false, escape = false

    for (let i = startPos; i < str.length; i++) {
      const ch = str[i]
      if (escape) { escape = false; continue }
      if (ch === '\\') { escape = true; continue }
      if (ch === '"') { inString = !inString; continue }
      if (inString) continue
      if (ch === '[') depth++
      else if (ch === ']') { depth--; if (depth === 0) return str.substring(startPos, i + 1) }
    }
    return null
  }

  private mapProducts(products: any[]): ScrapedOffer[] {
    const offers: ScrapedOffer[] = []

    for (const product of products) {
      try {
        const name = product.name?.trim()
        if (!name || name.length < 2) continue

        const priceObj = product.price
        if (!priceObj) continue

        const hasDiscount = priceObj.discount && priceObj.discount.price !== undefined
        const currentPrice = hasDiscount ? parseFloat(priceObj.discount.price) : parseFloat(priceObj.price)
        if (!currentPrice || currentPrice <= 0) continue

        const oldPrice = hasDiscount ? parseFloat(priceObj.price) : undefined

        let discountPercent: number | undefined
        if (hasDiscount && priceObj.discount.value) {
          discountPercent = Math.round(parseFloat(priceObj.discount.value))
        } else if (oldPrice && oldPrice > currentPrice) {
          discountPercent = Math.round(((oldPrice - currentPrice) / oldPrice) * 100)
        }

        if (!hasDiscount) continue

        let imageUrl: string | undefined
        if (product.links?.defaultImages?.[0]) imageUrl = product.links.defaultImages[0]
        else if (product.links?.images?.[0]?.href) imageUrl = product.links.images[0].href

        if (imageUrl && imageUrl.includes('im=Resize=')) {
          imageUrl = imageUrl.replace(/im=Resize=\d+/, 'im=Resize=400')
        } else if (imageUrl && !imageUrl.includes('im=Resize')) {
          imageUrl = `${imageUrl}?im=Resize=400`
        }

        const brand = product.brand?.name || undefined
        const sizeMatch = name.match(/(\d+(?:\.\d+)?\s*(?:ml|l|kg|g|pcs?|pack|rolls?)\b)/i)

        offers.push({
          nameAr: name,
          nameEn: name,
          brand,
          price: currentPrice,
          oldPrice,
          discountPercent,
          sizeText: sizeMatch ? sizeMatch[1] : undefined,
          imageUrl,
          sourceUrl: `${CarrefourScraper.BASE_URL}/mafsau/en/c/offers`,
          tags: ['carrefour', 'deals'].filter(Boolean).join(','),
        })
      } catch { /* skip */ }
    }

    return offers
  }
}
