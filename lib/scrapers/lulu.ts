import * as cheerio from 'cheerio'
import { BaseScraper } from './base-scraper'
import type { ScrapedOffer } from './types'

export class LuluScraper extends BaseScraper {
  constructor() {
    super({
      supermarketSlug: 'lulu',
      name: 'LuLu Hypermarket',
      nameAr: 'لولو هايبرماركت',
      baseUrl: 'https://gcc.luluhypermarket.com',
      offersUrl: 'https://gcc.luluhypermarket.com/en-sa/offers',
      maxPages: 3,
      requestDelayMs: 2000,
    })
  }

  protected async extractOffers(): Promise<ScrapedOffer[]> {
    const allOffers: ScrapedOffer[] = []

    // Try main offers page
    try {
      const offers = await this.scrapeOffersPage(this.config.offersUrl)
      allOffers.push(...offers)
    } catch (e) {
      this.logError(`Main page failed: ${e instanceof Error ? e.message : e}`)
    }

    // Try promotions page
    if (allOffers.length === 0) {
      try {
        const offers = await this.scrapeOffersPage(
          'https://gcc.luluhypermarket.com/en-sa/promotions'
        )
        allOffers.push(...offers)
      } catch (e) {
        this.logError(`Promotions page failed: ${e instanceof Error ? e.message : e}`)
      }
    }

    // Try hot deals
    if (allOffers.length === 0) {
      try {
        const offers = await this.scrapeOffersPage(
          'https://gcc.luluhypermarket.com/en-sa/hot-deals'
        )
        allOffers.push(...offers)
      } catch (e) {
        this.logError(`Hot deals page failed: ${e instanceof Error ? e.message : e}`)
      }
    }

    this.log(`Total extracted: ${allOffers.length} offers from LuLu`)
    return allOffers
  }

  private async scrapeOffersPage(url: string): Promise<ScrapedOffer[]> {
    const response = await this.fetchWithRetry(url)
    const html = await response.text()
    this.pagesScraped++
    this.log(`Fetched ${url}: ${html.length} chars`)

    const $ = cheerio.load(html)
    const offers: ScrapedOffer[] = []

    // Strategy 1: Look for product cards with price data
    // LuLu typically uses product-card or item-card classes
    $('[class*="product-card"], [class*="product-item"], [class*="ProductCard"], [data-testid*="product"]').each((_, el) => {
      try {
        const $el = $(el)
        const offer = this.extractFromCard($, $el, url)
        if (offer) offers.push(offer)
      } catch (e) { /* skip */ }
    })

    // Strategy 2: Look for any element structure with price + name
    if (offers.length === 0) {
      this.log('Trying generic product extraction...')
      // Find elements with SAR price text
      $('*').each((_, el) => {
        const $el = $(el)
        const text = $el.text()
        if (text.includes('SAR') && /\d+\.\d{2}/.test(text) && text.length < 200) {
          // This might be a product card
          const $parent = $el.closest('[class*="card"], [class*="item"], [class*="product"], li, article')
          if ($parent.length) {
            const offer = this.extractFromCard($, $parent, url)
            if (offer) offers.push(offer)
          }
        }
      })
    }

    // Strategy 3: Check for __NEXT_DATA__ or embedded JSON
    if (offers.length === 0) {
      const nextDataEl = $('#__NEXT_DATA__')
      if (nextDataEl.length) {
        try {
          const data = JSON.parse(nextDataEl.text())
          offers.push(...this.extractFromNextData(data, url))
        } catch (e) {
          this.logError('Failed to parse __NEXT_DATA__')
        }
      }
    }

    // Strategy 4: Find product data in inline scripts
    if (offers.length === 0) {
      $('script').each((_, script) => {
        const text = $(script).text()
        if (text.includes('"price"') && text.includes('"name"')) {
          try {
            // Try to extract JSON objects
            const jsonMatches = text.match(/\{[^{}]*"name"[^{}]*"price"[^{}]*\}/g)
            if (jsonMatches) {
              for (const jsonStr of jsonMatches.slice(0, 100)) {
                try {
                  const obj = JSON.parse(jsonStr)
                  if (obj.name && obj.price) {
                    offers.push({
                      nameAr: obj.name,
                      nameEn: obj.name,
                      price: parseFloat(obj.price),
                      oldPrice: obj.originalPrice ? parseFloat(obj.originalPrice) : undefined,
                      imageUrl: obj.image || obj.imageUrl || undefined,
                      sourceUrl: url,
                      tags: 'lulu,offers',
                    })
                  }
                } catch { /* skip */ }
              }
            }
          } catch { /* skip */ }
        }
      })
    }

    return offers
  }

  private extractFromCard(
    $: cheerio.CheerioAPI,
    $card: cheerio.Cheerio<any>,
    sourceUrl: string
  ): ScrapedOffer | null {
    // Name
    const name = $card.find('[class*="name"], [class*="title"], h3, h4, [class*="line-clamp"]')
      .first().text().trim()
    if (!name || name.length < 3) return null

    // Price
    let price = 0
    const priceText = $card.find('[class*="price"], [class*="Price"]').first().text()
    const priceMatch = priceText.match(/(\d+\.?\d*)/)
    if (priceMatch) price = parseFloat(priceMatch[1])
    if (price <= 0) return null

    // Old price
    let oldPrice: number | undefined
    const oldPriceText = $card.find('[class*="old-price"], [class*="was-price"], .line-through, [class*="strike"]').first().text()
    const oldMatch = oldPriceText.match(/(\d+\.?\d*)/)
    if (oldMatch) oldPrice = parseFloat(oldMatch[1])

    // Discount
    let discountPercent: number | undefined
    const discountText = $card.find('[class*="discount"], [class*="save"], [class*="off"]').first().text()
    const discountMatch = discountText.match(/(\d+)%/)
    if (discountMatch) discountPercent = parseInt(discountMatch[1])

    // Image
    const img = $card.find('img').first()
    const imageUrl = img.attr('src') || img.attr('data-src') || undefined

    return {
      nameAr: name,
      nameEn: name,
      price,
      oldPrice,
      discountPercent,
      imageUrl,
      sourceUrl,
      tags: 'lulu,offers',
    }
  }

  private extractFromNextData(data: any, sourceUrl: string): ScrapedOffer[] {
    const offers: ScrapedOffer[] = []

    const findProducts = (obj: any, depth = 0): void => {
      if (depth > 10 || !obj) return
      if (Array.isArray(obj)) {
        for (const item of obj) findProducts(item, depth + 1)
        return
      }
      if (typeof obj !== 'object') return

      // Check if this looks like a product
      if (obj.name && (obj.price || obj.salePrice)) {
        offers.push({
          nameAr: obj.name || obj.title,
          nameEn: obj.name || obj.title,
          price: parseFloat(obj.salePrice || obj.price),
          oldPrice: obj.price && obj.salePrice ? parseFloat(obj.price) : undefined,
          discountPercent: obj.discountPercent ? parseInt(obj.discountPercent) : undefined,
          imageUrl: obj.image || obj.imageUrl || obj.img,
          sourceUrl,
          tags: 'lulu,offers',
        })
      }

      for (const key of Object.keys(obj)) {
        findProducts(obj[key], depth + 1)
      }
    }

    findProducts(data)
    this.log(`__NEXT_DATA__ extraction found ${offers.length} products`)
    return offers
  }
}
