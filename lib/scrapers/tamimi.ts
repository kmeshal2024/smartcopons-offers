import * as cheerio from 'cheerio'
import { BaseScraper } from './base-scraper'
import type { ScrapedOffer } from './types'

/**
 * Tamimi Markets Scraper
 *
 * Tamimi's website (tamimimarkets.com) loads offers via iframes/templates.
 * Their old shop API (shop.tamimimarkets.com) is no longer available.
 *
 * Strategy:
 * 1. Scrape main offers page for structured data
 * 2. Try the online shop subdomain
 * 3. Parse any embedded iframe offer URLs
 */
export class TamimiScraper extends BaseScraper {
  constructor() {
    super({
      supermarketSlug: 'tamimi',
      name: 'Tamimi Markets',
      nameAr: 'أسواق التميمي',
      baseUrl: 'https://www.tamimimarkets.com',
      offersUrl: 'https://www.tamimimarkets.com/Offers',
      maxPages: 3,
      requestDelayMs: 1000,
    })
  }

  protected async extractOffers(): Promise<ScrapedOffer[]> {
    const allOffers: ScrapedOffer[] = []

    // Strategy 1: Try the main website offers page
    try {
      this.log('Fetching Tamimi offers page...')
      const offers = await this.scrapeOffersPage()
      allOffers.push(...offers)
    } catch (e) {
      this.logError(`Offers page failed: ${e instanceof Error ? e.message : e}`)
    }

    // Strategy 2: Try the online shop
    if (allOffers.length === 0) {
      const shopUrls = [
        'https://shop.tamimimarkets.com/offers',
        'https://shop.tamimimarkets.com/en/offers',
        'https://shop.tamimimarkets.com/promotions',
        'https://www.tamimimarkets.com/en/Offers',
      ]

      for (const url of shopUrls) {
        try {
          this.log(`Trying ${url}...`)
          const response = await this.fetchWithRetry(url, {
            headers: {
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            },
          })
          const html = await response.text()
          this.pagesScraped++

          if (html.length < 200) continue

          const $ = cheerio.load(html)
          const offers = this.extractFromHtml($, url)
          if (offers.length > 0) {
            allOffers.push(...offers)
            this.log(`Found ${offers.length} offers from ${url}`)
            break
          }

          // Try __NEXT_DATA__
          const nextData = $('#__NEXT_DATA__')
          if (nextData.length) {
            try {
              const data = JSON.parse(nextData.text())
              const products = this.findProducts(data)
              const mapped = products.map(p => this.transformProduct(p)).filter((o): o is ScrapedOffer => o !== null)
              if (mapped.length > 0) {
                allOffers.push(...mapped)
                break
              }
            } catch { /* skip */ }
          }
        } catch (e) {
          this.log(`${url} failed: ${e instanceof Error ? e.message : e}`)
        }
      }
    }

    // Strategy 3: Try shop API with different patterns
    if (allOffers.length === 0) {
      const apiUrls = [
        'https://shop.tamimimarkets.com/api/v1/products?on_sale=true&per_page=50',
        'https://shop.tamimimarkets.com/api/products?filter[on_sale]=true&per_page=50',
      ]

      for (const url of apiUrls) {
        try {
          const response = await this.fetchWithRetry(url, {
            headers: { 'Accept': 'application/json' },
          })
          const data = await response.json()
          const products = data.products || data.data || []
          if (Array.isArray(products) && products.length > 0) {
            const offers = products.map((p: any) => this.transformProduct(p)).filter((o): o is ScrapedOffer => o !== null)
            allOffers.push(...offers)
            this.log(`API returned ${offers.length} offers`)
            break
          }
        } catch (e) {
          this.log(`API failed: ${e instanceof Error ? e.message : e}`)
        }
      }
    }

    if (allOffers.length === 0) {
      this.logError('All Tamimi strategies failed — endpoints may have changed')
    }

    this.log(`Total Tamimi offers: ${allOffers.length}`)
    return allOffers
  }

  private async scrapeOffersPage(): Promise<ScrapedOffer[]> {
    const response = await this.fetchWithRetry(this.config.offersUrl, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    })
    const html = await response.text()
    this.pagesScraped++
    this.log(`Offers page: ${html.length} chars`)

    const $ = cheerio.load(html)
    const offers = this.extractFromHtml($, this.config.offersUrl)

    // Look for iframe sources that may contain actual offers
    const iframeSrcs: string[] = []
    $('iframe').each((_, el) => {
      const src = $(el).attr('src')
      if (src && (src.includes('offer') || src.includes('promo'))) {
        iframeSrcs.push(src.startsWith('http') ? src : `${this.config.baseUrl}${src}`)
      }
    })

    // Also check template/mustache patterns for URLs
    const urlMatches = html.match(/https?:\/\/[^\s"'<>]+(?:offer|promo|deal)[^\s"'<>]*/gi)
    if (urlMatches) {
      for (const url of urlMatches.slice(0, 5)) {
        if (!iframeSrcs.includes(url)) iframeSrcs.push(url)
      }
    }

    // Try iframe sources
    for (const src of iframeSrcs.slice(0, 3)) {
      try {
        await this.delay(1000)
        const resp = await this.fetchWithRetry(src)
        const iframeHtml = await resp.text()
        const $iframe = cheerio.load(iframeHtml)
        const iframeOffers = this.extractFromHtml($iframe, src)
        offers.push(...iframeOffers)
        if (offers.length > 0) break
      } catch { /* skip */ }
    }

    return offers
  }

  private extractFromHtml($: cheerio.CheerioAPI, sourceUrl: string): ScrapedOffer[] {
    const offers: ScrapedOffer[] = []

    $('[class*="product"], [class*="offer"], [class*="item"], [class*="card"], [class*="deal"]').each((_, el) => {
      try {
        const $el = $(el)
        const name = $el.find('[class*="name"], [class*="title"], h3, h4, h5, h6').first().text().trim()
        if (!name || name.length < 3) return

        let price = 0
        const priceText = $el.text()
        const priceMatch = priceText.match(/(\d+\.?\d*)\s*(SAR|ر\.س|ريال)/)
        if (priceMatch) price = parseFloat(priceMatch[1])
        if (price <= 0) return

        const img = $el.find('img').first()
        const imageUrl = img.attr('src') || img.attr('data-src') || undefined

        offers.push({
          nameAr: name,
          price,
          imageUrl: imageUrl?.startsWith('http') ? imageUrl : imageUrl ? `${this.config.baseUrl}${imageUrl}` : undefined,
          sourceUrl,
          tags: 'tamimi,offers',
        })
      } catch { /* skip */ }
    })

    return offers
  }

  private findProducts(data: any, depth = 0): any[] {
    const products: any[] = []
    if (depth > 8 || !data) return products
    if (Array.isArray(data)) {
      for (const item of data) {
        if (item && typeof item === 'object' && (item.name || item.title) && (item.price || item.sale_price)) {
          products.push(item)
        } else {
          products.push(...this.findProducts(item, depth + 1))
        }
      }
      return products
    }
    if (typeof data !== 'object') return products
    for (const key of Object.keys(data)) {
      products.push(...this.findProducts(data[key], depth + 1))
    }
    return products
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
    if (oldPrice) discountPercent = Math.round(((oldPrice - price) / oldPrice) * 100)
    if (discountPercent !== undefined && discountPercent < 5) return null

    let imageUrl = p.image_url || p.imageUrl || p.image || p.thumbnail || undefined
    if (imageUrl && !imageUrl.startsWith('http')) imageUrl = `https://shop.tamimimarkets.com${imageUrl}`

    return {
      nameAr: nameAr || nameEn,
      nameEn: nameEn || undefined,
      price,
      oldPrice,
      discountPercent,
      imageUrl,
      sourceUrl: 'https://www.tamimimarkets.com/Offers',
      brand: p.brand || p.brand_name || undefined,
    }
  }
}
