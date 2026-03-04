import * as cheerio from 'cheerio'
import { BaseScraper } from './base-scraper'
import type { ScrapedOffer } from './types'

export class PandaScraper extends BaseScraper {
  constructor() {
    super({
      supermarketSlug: 'panda',
      name: 'Panda',
      nameAr: 'بنده',
      baseUrl: 'https://panda.sa',
      offersUrl: 'https://panda.sa/en/plp?category_id=468&deals=1',
      maxPages: 3,
      requestDelayMs: 2000,
    })
  }

  // Panda/HyperPanda — try multiple known domains
  private readonly urls = [
    'https://panda.sa/en/plp?category_id=468&deals=1',
    'https://panda.sa/en/collections?parent_id=1003&type=huge_discounts',
    'https://www.panda.com.sa/en/promotions',
    'https://www.panda.com.sa/offers',
  ]

  protected async extractOffers(): Promise<ScrapedOffer[]> {
    for (const url of this.urls) {
      try {
        this.log(`Trying ${url}...`)
        const offers = await this.scrapeUrl(url)
        if (offers.length > 0) {
          this.log(`Found ${offers.length} offers from ${url}`)
          return offers
        }
      } catch (e) {
        this.log(`${url} failed: ${e instanceof Error ? e.message : e}`)
        await this.delay(this.config.requestDelayMs || 2000)
      }
    }

    this.logError('All Panda URLs failed to return products')
    return []
  }

  private async scrapeUrl(url: string): Promise<ScrapedOffer[]> {
    const response = await this.fetchWithRetry(url, undefined, 1)
    const html = await response.text()
    this.pagesScraped++
    this.log(`Fetched: ${html.length} chars`)

    const $ = cheerio.load(html)
    const offers: ScrapedOffer[] = []

    // Strategy 1: Product cards with price
    $('[class*="product"], [class*="offer"], [class*="item"], [class*="card"], article').each((_, el) => {
      try {
        const $el = $(el)
        const name = $el.find('[class*="name"], [class*="title"], h2, h3, h4, [class*="line-clamp"]')
          .first().text().trim()
        if (!name || name.length < 3) return

        let price = 0
        const priceText = $el.text()
        const priceMatch = priceText.match(/(\d+\.?\d*)\s*(SAR|ر\.س|ريال)/)
        if (priceMatch) price = parseFloat(priceMatch[1])
        if (price <= 0) {
          // Try just number.decimal pattern
          const numMatch = $el.find('[class*="price"]').first().text().match(/(\d+\.?\d*)/)
          if (numMatch) price = parseFloat(numMatch[1])
        }
        if (price <= 0) return

        let oldPrice: number | undefined
        const oldText = $el.find('.line-through, del, s, [class*="old"], [class*="was"]').first().text()
        const oldMatch = oldText.match(/(\d+\.?\d*)/)
        if (oldMatch) oldPrice = parseFloat(oldMatch[1])

        let discountPercent: number | undefined
        const discountText = $el.find('[class*="discount"], [class*="save"], [class*="badge"]').first().text()
        const dMatch = discountText.match(/(\d+)\s*%/)
        if (dMatch) discountPercent = parseInt(dMatch[1])

        const img = $el.find('img').first()
        const imageUrl = img.attr('src') || img.attr('data-src') || undefined

        offers.push({
          nameAr: name,
          nameEn: name,
          price,
          oldPrice,
          discountPercent,
          imageUrl: imageUrl?.startsWith('http') ? imageUrl : undefined,
          sourceUrl: url,
          tags: 'panda,offers',
        })
      } catch { /* skip */ }
    })

    // Strategy 2: __NEXT_DATA__
    if (offers.length === 0) {
      const nextData = $('#__NEXT_DATA__')
      if (nextData.length) {
        try {
          const data = JSON.parse(nextData.text())
          offers.push(...this.extractFromJSON(data, url))
        } catch { /* skip */ }
      }
    }

    // Strategy 3: JSON-LD
    if (offers.length === 0) {
      $('script[type="application/ld+json"]').each((_, script) => {
        try {
          const data = JSON.parse($(script).text())
          if (data.itemListElement) {
            for (const item of data.itemListElement) {
              const p = item.item || item
              if (p.name && p.offers) {
                offers.push({
                  nameAr: p.name,
                  nameEn: p.name,
                  price: parseFloat(p.offers.price || p.offers.lowPrice),
                  imageUrl: p.image,
                  sourceUrl: url,
                  tags: 'panda,offers',
                })
              }
            }
          }
        } catch { /* skip */ }
      })
    }

    return offers
  }

  private extractFromJSON(data: any, sourceUrl: string, depth = 0): ScrapedOffer[] {
    const offers: ScrapedOffer[] = []
    if (depth > 8 || !data) return offers
    if (Array.isArray(data)) {
      for (const item of data) offers.push(...this.extractFromJSON(item, sourceUrl, depth + 1))
      return offers
    }
    if (typeof data !== 'object') return offers

    if (data.name && (data.price || data.salePrice)) {
      offers.push({
        nameAr: data.name,
        nameEn: data.name,
        price: parseFloat(data.salePrice || data.price),
        oldPrice: data.price && data.salePrice ? parseFloat(data.price) : undefined,
        imageUrl: data.image || data.imageUrl,
        sourceUrl,
        tags: 'panda,offers',
      })
    }

    for (const key of Object.keys(data)) {
      offers.push(...this.extractFromJSON(data[key], sourceUrl, depth + 1))
    }
    return offers
  }
}
