import * as cheerio from 'cheerio'
import { BaseScraper } from './base-scraper'
import type { ScrapedOffer } from './types'

/**
 * LuLu Hypermarket Scraper — multi-strategy approach
 *
 * LuLu blocks most server-side requests with 403.
 * Strategies:
 * 1. Try main site with browser-like headers
 * 2. Try mobile/API endpoints
 * 3. Try alternate domain patterns
 */
export class LuluScraper extends BaseScraper {
  constructor() {
    super({
      supermarketSlug: 'lulu',
      name: 'LuLu Hypermarket',
      nameAr: 'لولو هايبرماركت',
      baseUrl: 'https://www.luluhypermarket.com',
      offersUrl: 'https://www.luluhypermarket.com/en-sa/offers',
      maxPages: 3,
      requestDelayMs: 2000,
    })
  }

  private getBrowserHeaders(referer?: string): Record<string, string> {
    return {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'ar-SA,ar;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124"',
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
    const allOffers: ScrapedOffer[] = []

    // Try multiple LuLu page patterns
    const urls = [
      'https://www.luluhypermarket.com/en-sa/offers',
      'https://www.luluhypermarket.com/en-sa/deals',
      'https://www.luluhypermarket.com/en-sa/hot-deals',
      'https://gcc.luluhypermarket.com/en-sa/offers',
      'https://gcc.luluhypermarket.com/en-sa/deals/',
      'https://www.luluhypermarket.com/en-sa/promotions',
    ]

    for (const url of urls) {
      try {
        const offers = await this.scrapeOffersPage(url)
        allOffers.push(...offers)
        if (allOffers.length > 0) {
          this.log(`Found ${allOffers.length} offers from ${url}`)
          break
        }
      } catch (e) {
        this.logError(`${url} failed: ${e instanceof Error ? e.message : e}`)
      }
    }

    // Strategy 2: Try search/product API endpoints
    if (allOffers.length === 0) {
      const apiUrls = [
        'https://www.luluhypermarket.com/api/search/product?q=*&start=0&rows=50&f.discountedPrice=[*+TO+*]',
        'https://www.luluhypermarket.com/en-sa/api/products?on_sale=true&per_page=50',
      ]

      for (const url of apiUrls) {
        try {
          const response = await this.fetchWithRetry(url, {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            },
          })
          const data = await response.json()
          const products = data.products || data.data || data.response?.docs || []
          if (Array.isArray(products) && products.length > 0) {
            const offers = this.mapApiProducts(products)
            allOffers.push(...offers)
            this.log(`API returned ${offers.length} offers`)
            break
          }
        } catch (e) {
          this.log(`API ${url} failed: ${e instanceof Error ? e.message : e}`)
        }
      }
    }

    if (allOffers.length === 0) {
      this.logError('All LuLu strategies failed — site blocks server-side requests')
    }

    this.log(`Total extracted: ${allOffers.length} offers from LuLu`)
    return allOffers
  }

  private async scrapeOffersPage(url: string): Promise<ScrapedOffer[]> {
    const response = await this.fetchWithRetry(url, {
      headers: this.getBrowserHeaders(),
    })
    const html = await response.text()
    this.pagesScraped++
    this.log(`Fetched ${url}: ${html.length} chars`)

    if (html.length < 200) {
      this.log('Response too short — likely blocked')
      return []
    }

    const $ = cheerio.load(html)
    const offers: ScrapedOffer[] = []

    // Strategy 1: Product cards
    $('[class*="product-card"], [class*="product-item"], [class*="ProductCard"], [data-testid*="product"]').each((_, el) => {
      const offer = this.extractFromCard($, $(el), url)
      if (offer) offers.push(offer)
    })

    // Strategy 2: Generic price elements
    if (offers.length === 0) {
      $('*').each((_, el) => {
        const $el = $(el)
        const text = $el.text()
        if (text.includes('SAR') && /\d+\.\d{2}/.test(text) && text.length < 200) {
          const $parent = $el.closest('[class*="card"], [class*="item"], [class*="product"], li, article')
          if ($parent.length) {
            const offer = this.extractFromCard($, $parent, url)
            if (offer) offers.push(offer)
          }
        }
      })
    }

    // Strategy 3: __NEXT_DATA__
    if (offers.length === 0) {
      const nextDataEl = $('#__NEXT_DATA__')
      if (nextDataEl.length) {
        try {
          const data = JSON.parse(nextDataEl.text())
          offers.push(...this.extractFromNextData(data, url))
        } catch { /* skip */ }
      }
    }

    // Strategy 4: Inline script JSON
    if (offers.length === 0) {
      $('script').each((_, script) => {
        const text = $(script).text()
        if (text.includes('"price"') && text.includes('"name"')) {
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
        }
      })
    }

    return offers
  }

  private extractFromCard($: cheerio.CheerioAPI, $card: cheerio.Cheerio<any>, sourceUrl: string): ScrapedOffer | null {
    const name = $card.find('[class*="name"], [class*="title"], h3, h4, [class*="line-clamp"]').first().text().trim()
    if (!name || name.length < 3) return null

    let price = 0
    const priceText = $card.find('[class*="price"], [class*="Price"]').first().text()
    const priceMatch = priceText.match(/(\d+\.?\d*)/)
    if (priceMatch) price = parseFloat(priceMatch[1])
    if (price <= 0) return null

    let oldPrice: number | undefined
    const oldPriceText = $card.find('[class*="old-price"], [class*="was-price"], .line-through, [class*="strike"]').first().text()
    const oldMatch = oldPriceText.match(/(\d+\.?\d*)/)
    if (oldMatch) oldPrice = parseFloat(oldMatch[1])

    let discountPercent: number | undefined
    const discountText = $card.find('[class*="discount"], [class*="save"], [class*="off"]').first().text()
    const discountMatch = discountText.match(/(\d+)%/)
    if (discountMatch) discountPercent = parseInt(discountMatch[1])

    const img = $card.find('img').first()
    const imageUrl = img.attr('src') || img.attr('data-src') || undefined

    return { nameAr: name, nameEn: name, price, oldPrice, discountPercent, imageUrl, sourceUrl, tags: 'lulu,offers' }
  }

  private mapApiProducts(products: any[]): ScrapedOffer[] {
    return products.map((p: any) => {
      const name = p.name || p.title || p.product_name || ''
      const price = parseFloat(p.price || p.sale_price || p.discountedPrice || 0)
      if (!name || price <= 0) return null

      const oldPrice = parseFloat(p.original_price || p.compare_at_price || p.mrp || 0)
      let discountPercent: number | undefined
      if (oldPrice > price) discountPercent = Math.round(((oldPrice - price) / oldPrice) * 100)

      return {
        nameAr: name,
        nameEn: name,
        price,
        oldPrice: oldPrice > price ? oldPrice : undefined,
        discountPercent,
        imageUrl: p.image_url || p.imageUrl || p.image || undefined,
        sourceUrl: 'https://www.luluhypermarket.com/en-sa/offers',
        tags: 'lulu,offers',
      } as ScrapedOffer
    }).filter((o): o is ScrapedOffer => o !== null)
  }

  private extractFromNextData(data: any, sourceUrl: string): ScrapedOffer[] {
    const offers: ScrapedOffer[] = []
    const findProducts = (obj: any, depth = 0): void => {
      if (depth > 10 || !obj) return
      if (Array.isArray(obj)) { for (const item of obj) findProducts(item, depth + 1); return }
      if (typeof obj !== 'object') return
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
      for (const key of Object.keys(obj)) findProducts(obj[key], depth + 1)
    }
    findProducts(data)
    return offers
  }
}
