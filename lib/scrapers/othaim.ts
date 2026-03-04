import * as cheerio from 'cheerio'
import { BaseScraper } from './base-scraper'
import type { ScrapedOffer } from './types'

export class OthaimScraper extends BaseScraper {
  constructor() {
    super({
      supermarketSlug: 'alothaim',
      name: 'Al Othaim Markets',
      nameAr: 'العثيم',
      baseUrl: 'https://www.othaimmarkets.com',
      offersUrl: 'https://www.othaimmarkets.com/offers',
      maxPages: 3,
      requestDelayMs: 2000,
    })
  }

  protected async extractOffers(): Promise<ScrapedOffer[]> {
    const allOffers: ScrapedOffer[] = []

    // Othaim's main site is corporate — offers page shows flyer thumbnails
    // Try to find direct links to offer detail pages and scrape those
    try {
      const response = await this.fetchWithRetry(this.config.offersUrl)
      const html = await response.text()
      this.pagesScraped++
      this.log(`Fetched offers page: ${html.length} chars`)

      const $ = cheerio.load(html)

      // Strategy 1: Look for offer detail links from the offers page
      const offerLinks: string[] = []
      $('a[href*="offer"], a[href*="عروض"], a[href*="promotion"]').each((_, el) => {
        const href = $(el).attr('href')
        if (href && !offerLinks.includes(href)) {
          const fullUrl = href.startsWith('http') ? href : `${this.config.baseUrl}${href}`
          offerLinks.push(fullUrl)
        }
      })
      this.log(`Found ${offerLinks.length} offer links`)

      // Scrape each offer detail page (max 3)
      for (const link of offerLinks.slice(0, 3)) {
        try {
          await this.delay(this.config.requestDelayMs || 2000)
          const offers = await this.scrapeDetailPage(link)
          allOffers.push(...offers)
        } catch (e) {
          this.log(`Detail page ${link} failed: ${e instanceof Error ? e.message : e}`)
        }
      }

      // Strategy 2: Extract directly from main offers page
      if (allOffers.length === 0) {
        allOffers.push(...this.extractFromPage($, this.config.offersUrl))
      }

      // Strategy 3: Check __NEXT_DATA__ (Othaim uses Next.js)
      if (allOffers.length === 0) {
        const nextData = $('#__NEXT_DATA__')
        if (nextData.length) {
          try {
            const data = JSON.parse(nextData.text())
            allOffers.push(...this.extractFromJSON(data, this.config.offersUrl))
          } catch { /* skip */ }
        }
      }

      // Strategy 4: Check Contentful API data embedded in page
      if (allOffers.length === 0) {
        $('script').each((_, script) => {
          const text = $(script).text()
          if (text.includes('contentful') || text.includes('ctfassets')) {
            // Try to find product/offer data
            const priceMatches = text.match(/"price":\s*"?(\d+\.?\d*)"?/g)
            const nameMatches = text.match(/"title":\s*"([^"]+)"/g)
            if (priceMatches && nameMatches) {
              const minLen = Math.min(priceMatches.length, nameMatches.length)
              for (let i = 0; i < minLen; i++) {
                const pm = priceMatches[i].match(/(\d+\.?\d*)/)
                const nm = nameMatches[i].match(/"title":\s*"([^"]+)"/)
                if (pm && nm) {
                  allOffers.push({
                    nameAr: nm[1],
                    price: parseFloat(pm[1]),
                    sourceUrl: this.config.offersUrl,
                    tags: 'othaim,offers',
                  })
                }
              }
            }
          }
        })
      }

    } catch (e) {
      this.logError(`Main offers page failed: ${e instanceof Error ? e.message : e}`)
    }

    this.log(`Total extracted: ${allOffers.length} offers from Othaim`)
    return allOffers
  }

  private async scrapeDetailPage(url: string): Promise<ScrapedOffer[]> {
    const response = await this.fetchWithRetry(url)
    const html = await response.text()
    this.pagesScraped++

    const $ = cheerio.load(html)
    return this.extractFromPage($, url)
  }

  private extractFromPage($: cheerio.CheerioAPI, sourceUrl: string): ScrapedOffer[] {
    const offers: ScrapedOffer[] = []

    // Look for product cards/items with price data
    $('[class*="product"], [class*="offer"], [class*="item"], [class*="card"]').each((_, el) => {
      try {
        const $el = $(el)
        const name = $el.find('[class*="name"], [class*="title"], h3, h4, h5').first().text().trim()
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
          tags: 'othaim,offers',
        })
      } catch { /* skip */ }
    })

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

    if ((data.title || data.name) && data.price) {
      offers.push({
        nameAr: data.title || data.name,
        price: parseFloat(data.price),
        imageUrl: data.image?.url || data.imageUrl,
        sourceUrl,
        tags: 'othaim,offers',
      })
    }

    for (const key of Object.keys(data)) {
      offers.push(...this.extractFromJSON(data[key], sourceUrl, depth + 1))
    }
    return offers
  }
}
