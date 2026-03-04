import * as cheerio from 'cheerio'
import { BaseScraper } from './base-scraper'
import type { ScrapedOffer } from './types'

export class DanubeScraper extends BaseScraper {
  constructor() {
    super({
      supermarketSlug: 'danube',
      name: 'Danube',
      nameAr: 'الدانوب',
      baseUrl: 'https://www.danube.sa',
      offersUrl: 'https://www.danube.sa/en/offers',
      maxPages: 3,
      requestDelayMs: 2000,
    })
  }

  // Multiple URLs to try — Danube/BinDawood has changed domains
  private readonly fallbackUrls = [
    'https://www.danube.sa/en/offers',
    'https://www.bindawood.com/en/offers',
    'https://danube.sa/en/promotions',
    'https://www.danubeco.com/en/offers',
  ]

  protected async extractOffers(): Promise<ScrapedOffer[]> {
    for (const url of this.fallbackUrls) {
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

    this.logError('All Danube URLs failed to return products')
    return []
  }

  private async scrapeUrl(url: string): Promise<ScrapedOffer[]> {
    const response = await this.fetchWithRetry(url)
    const html = await response.text()
    this.pagesScraped++
    this.log(`Fetched: ${html.length} chars`)

    const $ = cheerio.load(html)
    const offers: ScrapedOffer[] = []

    // Strategy 1: Product cards
    $('[class*="product"], [class*="offer"], [class*="item-card"], [class*="deal"]').each((_, el) => {
      try {
        const $el = $(el)
        const offer = this.extractProduct($, $el, url)
        if (offer) offers.push(offer)
      } catch { /* skip */ }
    })

    // Strategy 2: Check for __NEXT_DATA__
    if (offers.length === 0) {
      const nextData = $('#__NEXT_DATA__')
      if (nextData.length) {
        try {
          const data = JSON.parse(nextData.text())
          offers.push(...this.extractFromJSON(data, url))
        } catch { /* skip */ }
      }
    }

    // Strategy 3: Look for JSON-LD structured data
    if (offers.length === 0) {
      $('script[type="application/ld+json"]').each((_, script) => {
        try {
          const data = JSON.parse($(script).text())
          if (data['@type'] === 'ItemList' || data['@type'] === 'OfferCatalog') {
            const items = data.itemListElement || data.offers || []
            for (const item of items) {
              const product = item.item || item
              if (product.name && product.offers?.price) {
                offers.push({
                  nameAr: product.name,
                  nameEn: product.name,
                  price: parseFloat(product.offers.price),
                  oldPrice: product.offers.highPrice ? parseFloat(product.offers.highPrice) : undefined,
                  imageUrl: product.image,
                  sourceUrl: url,
                  tags: 'danube,offers',
                })
              }
            }
          }
        } catch { /* skip */ }
      })
    }

    // Strategy 4: Generic price scraping
    if (offers.length === 0) {
      const priceRegex = /(\d+\.?\d*)\s*(SAR|ر\.س|ريال)/g
      const bodyText = $('body').text()
      let match
      while ((match = priceRegex.exec(bodyText)) !== null) {
        const price = parseFloat(match[1])
        if (price > 0 && price < 10000) {
          offers.push({
            nameAr: `Danube Offer`,
            price,
            sourceUrl: url,
            tags: 'danube,offers',
          })
        }
        if (offers.length > 50) break
      }
    }

    return offers
  }

  private extractProduct(
    $: cheerio.CheerioAPI,
    $card: cheerio.Cheerio<cheerio.AnyNode>,
    sourceUrl: string
  ): ScrapedOffer | null {
    const name = $card.find('[class*="name"], [class*="title"], h2, h3, h4, [class*="line-clamp"]')
      .first().text().trim()
    if (!name || name.length < 3) return null

    let price = 0
    $card.find('[class*="price"], [class*="Price"]').each((_, el) => {
      const text = $(el).text()
      const m = text.match(/(\d+\.?\d*)/)
      if (m && price === 0) price = parseFloat(m[1])
    })
    if (price <= 0) return null

    let oldPrice: number | undefined
    const strikeText = $card.find('.line-through, [class*="old"], [class*="was"], del, s').first().text()
    const oldMatch = strikeText.match(/(\d+\.?\d*)/)
    if (oldMatch) oldPrice = parseFloat(oldMatch[1])

    let discountPercent: number | undefined
    const discountText = $card.find('[class*="discount"], [class*="save"], [class*="off"]').first().text()
    const dMatch = discountText.match(/(\d+)\s*%/)
    if (dMatch) discountPercent = parseInt(dMatch[1])

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
      tags: 'danube,offers',
    }
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
        tags: 'danube,offers',
      })
    }

    for (const key of Object.keys(data)) {
      offers.push(...this.extractFromJSON(data[key], sourceUrl, depth + 1))
    }
    return offers
  }
}
