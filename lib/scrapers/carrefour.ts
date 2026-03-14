import { BaseScraper } from './base-scraper'
import type { ScrapedOffer } from './types'

/**
 * Carrefour KSA Scraper — extracts deals from RSC (React Server Components) payload
 *
 * Page URL: https://www.carrefourksa.com/mafsau/en/c/ksa-best-dealss?currentPage=N&pageSize=60
 * Data is embedded in self.__next_f.push([1,"..."]) script blocks in the HTML.
 * Products contain: name, price.price, price.discount.price, price.discount.value (%), images.
 *
 * Anti-bot: Akamai Bot Manager — bypassed with proper Sec-Fetch-* headers (no JS execution needed).
 */
export class CarrefourScraper extends BaseScraper {
  private static readonly BASE_URL = 'https://www.carrefourksa.com'
  private static readonly DEALS_PATH = '/mafsau/en/c/ksa-best-dealss'
  private static readonly PAGE_SIZE = 60
  private static readonly MAX_PAGES = 20 // safety cap: 20 * 60 = 1200 max offers

  /** Headers required to bypass Akamai Bot Manager */
  private static readonly REQUIRED_HEADERS: Record<string, string> = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  }

  constructor() {
    super({
      supermarketSlug: 'carrefour',
      name: 'Carrefour KSA',
      nameAr: 'كارفور',
      baseUrl: CarrefourScraper.BASE_URL,
      offersUrl: `${CarrefourScraper.BASE_URL}${CarrefourScraper.DEALS_PATH}`,
      maxPages: CarrefourScraper.MAX_PAGES,
      requestDelayMs: 2000,
    })
  }

  protected async extractOffers(): Promise<ScrapedOffer[]> {
    const allOffers: ScrapedOffer[] = []
    let page = 0 // Carrefour uses 0-indexed pages
    let totalProducts = -1
    let hasMore = true

    while (hasMore && page < CarrefourScraper.MAX_PAGES) {
      const url = `${CarrefourScraper.BASE_URL}${CarrefourScraper.DEALS_PATH}?currentPage=${page}&pageSize=${CarrefourScraper.PAGE_SIZE}`
      this.log(`Fetching page ${page + 1}: ${url}`)

      try {
        const response = await this.fetchWithRetry(url, {
          headers: CarrefourScraper.REQUIRED_HEADERS,
        })

        const html = await response.text()
        this.log(`Page ${page + 1}: received ${html.length} chars`)

        // Check for Akamai block (empty HTML shell)
        if (html.length < 500) {
          this.logError(`Page ${page + 1}: Akamai blocked (${html.length} chars) — stopping`)
          break
        }

        // Extract products from RSC payload
        const { products, total } = this.extractProductsFromRSC(html)
        this.pagesScraped++

        if (page === 0 && total > 0) {
          totalProducts = total
          this.log(`Total deals available: ${totalProducts}`)
        }

        if (products.length === 0) {
          this.log(`Page ${page + 1}: no products found — stopping`)
          break
        }

        const pageOffers = this.mapProducts(products)
        allOffers.push(...pageOffers)
        this.log(`Page ${page + 1}: ${pageOffers.length} deals mapped (running total: ${allOffers.length})`)

        // Check if more pages
        const expectedTotal = totalProducts > 0 ? totalProducts : Infinity
        hasMore = allOffers.length < expectedTotal && products.length >= CarrefourScraper.PAGE_SIZE
        page++

        // Polite delay between pages
        if (hasMore) {
          await this.delay(this.config.requestDelayMs || 2000)
        }
      } catch (error) {
        this.logError(`Page ${page + 1} failed: ${error instanceof Error ? error.message : String(error)}`)
        break
      }
    }

    this.log(`Scrape complete: ${allOffers.length} total deals from ${this.pagesScraped} pages`)
    return allOffers
  }

  /**
   * Extract products JSON array from the Next.js RSC flight payload.
   *
   * The HTML contains script blocks like:
   *   self.__next_f.push([1,"...escaped JSON..."])
   *
   * We find the one containing "products", unescape it via JSON.parse,
   * then extract the products array.
   */
  private extractProductsFromRSC(html: string): { products: any[]; total: number } {
    try {
      // Find all self.__next_f.push blocks and look for the one with product data
      const pushPattern = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g
      let match: RegExpExecArray | null
      let productsData: any[] = []
      let totalProducts = 0

      while ((match = pushPattern.exec(html)) !== null) {
        const escaped = match[1]

        // Quick check: does this chunk contain product data markers?
        if (!escaped.includes('\\"products\\"') && !escaped.includes('\\\"products\\\"')) {
          continue
        }

        // Unescape the RSC stream
        let rscStream: string
        try {
          rscStream = JSON.parse(`"${escaped}"`)
        } catch {
          continue
        }

        // Extract totalProducts count
        const totalMatch = rscStream.match(/"totalProducts":\s*(\d+)/)
        if (totalMatch) {
          totalProducts = parseInt(totalMatch[1])
        }

        // Extract products array
        const productsStart = rscStream.indexOf('"products":[')
        if (productsStart === -1) continue

        // Find the matching closing bracket for the products array
        const arrayStart = productsStart + '"products":'.length
        const arrayContent = this.extractJSONArray(rscStream, arrayStart)
        if (!arrayContent) continue

        try {
          productsData = JSON.parse(arrayContent)
          if (Array.isArray(productsData) && productsData.length > 0) {
            this.log(`RSC extraction: found ${productsData.length} products`)
            break
          }
        } catch {
          // Try next push block
          continue
        }
      }

      return { products: productsData, total: totalProducts }
    } catch (error) {
      this.logError(`RSC extraction failed: ${error instanceof Error ? error.message : String(error)}`)
      return { products: [], total: 0 }
    }
  }

  /**
   * Extract a JSON array starting at the given position by tracking bracket depth.
   * More robust than relying on a specific end marker.
   */
  private extractJSONArray(str: string, startPos: number): string | null {
    if (str[startPos] !== '[') return null

    let depth = 0
    let inString = false
    let escape = false

    for (let i = startPos; i < str.length; i++) {
      const ch = str[i]

      if (escape) {
        escape = false
        continue
      }

      if (ch === '\\') {
        escape = true
        continue
      }

      if (ch === '"') {
        inString = !inString
        continue
      }

      if (inString) continue

      if (ch === '[') depth++
      else if (ch === ']') {
        depth--
        if (depth === 0) {
          return str.substring(startPos, i + 1)
        }
      }
    }

    return null
  }

  /**
   * Map raw Carrefour product objects to ScrapedOffer format.
   *
   * Product structure:
   * - name: string
   * - price.price: number (original price)
   * - price.discount.price: number (sale price)
   * - price.discount.value: number (discount %)
   * - links.defaultImages[0]: string (full-size image URL)
   * - links.images[0].href: string (thumbnail URL)
   * - brand.name: string | null
   * - productCategoriesHearchi: string (e.g. "Fruits & Vegetables/Vegetables/Tomato")
   * - type: "FOOD" | "NON_FOOD" etc.
   */
  private mapProducts(products: any[]): ScrapedOffer[] {
    const offers: ScrapedOffer[] = []

    for (const product of products) {
      try {
        const name = product.name?.trim()
        if (!name || name.length < 2) continue

        // Get pricing
        const priceObj = product.price
        if (!priceObj) continue

        // The sale/current price is discount.price if on sale, otherwise price.price
        const hasDiscount = priceObj.discount && priceObj.discount.price !== undefined
        const currentPrice = hasDiscount
          ? parseFloat(priceObj.discount.price)
          : parseFloat(priceObj.price)

        if (!currentPrice || currentPrice <= 0) continue

        // Original (old) price is always price.price
        const oldPrice = hasDiscount ? parseFloat(priceObj.price) : undefined

        // Discount percentage
        let discountPercent: number | undefined
        if (hasDiscount && priceObj.discount.value) {
          discountPercent = Math.round(parseFloat(priceObj.discount.value))
        } else if (oldPrice && oldPrice > currentPrice) {
          discountPercent = Math.round(((oldPrice - currentPrice) / oldPrice) * 100)
        }

        // Only include products with actual discounts
        if (!hasDiscount) continue

        // Image URL — prefer large defaultImages, fall back to thumbnail
        let imageUrl: string | undefined
        if (product.links?.defaultImages?.[0]) {
          imageUrl = product.links.defaultImages[0]
        } else if (product.links?.images?.[0]?.href) {
          imageUrl = product.links.images[0].href
        }

        // Resize to 400px for consistency
        if (imageUrl && imageUrl.includes('im=Resize=')) {
          imageUrl = imageUrl.replace(/im=Resize=\d+/, 'im=Resize=400')
        } else if (imageUrl && !imageUrl.includes('im=Resize')) {
          imageUrl = `${imageUrl}?im=Resize=400`
        }

        // Brand and category
        const brand = product.brand?.name || undefined
        const categoryPath = product.productCategoriesHearchi || ''
        const categoryParts = categoryPath.split('/')
        const category = categoryParts[0]?.trim() || undefined

        // Size/weight from name or attributes
        const sizeMatch = name.match(/(\d+(?:\.\d+)?\s*(?:ml|l|kg|g|pcs?|pack|rolls?)\b)/i)
        const sizeText = sizeMatch ? sizeMatch[1] : undefined

        offers.push({
          nameAr: name,     // English names from en locale
          nameEn: name,
          brand,
          price: currentPrice,
          oldPrice,
          discountPercent,
          sizeText,
          imageUrl,
          sourceUrl: `${CarrefourScraper.BASE_URL}${CarrefourScraper.DEALS_PATH}`,
          tags: [
            'carrefour',
            'deals',
            category ? category.toLowerCase().replace(/\s+&\s+/g, '-') : undefined,
            product.type === 'NON_FOOD' ? 'non-food' : undefined,
          ].filter(Boolean).join(','),
        })
      } catch {
        // Skip malformed products
      }
    }

    return offers
  }
}
