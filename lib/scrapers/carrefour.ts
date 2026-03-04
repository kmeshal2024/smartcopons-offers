import * as cheerio from 'cheerio'
import { BaseScraper } from './base-scraper'
import type { ScrapedOffer } from './types'

export class CarrefourScraper extends BaseScraper {
  constructor() {
    super({
      supermarketSlug: 'carrefour',
      name: 'Carrefour KSA',
      nameAr: 'كارفور',
      baseUrl: 'https://www.carrefourksa.com',
      offersUrl: 'https://www.carrefourksa.com/mafsau/en/n/c/clp_carrefouroffers',
      maxPages: 1,
      requestDelayMs: 2000,
    })
  }

  protected async extractOffers(): Promise<ScrapedOffer[]> {
    const response = await this.fetchWithRetry(this.config.offersUrl)
    const html = await response.text()
    this.pagesScraped = 1
    this.log(`Fetched HTML: ${html.length} chars`)

    const $ = cheerio.load(html)
    const offers: ScrapedOffer[] = []

    // Carrefour KSA uses Next.js SSR — products are rendered in the HTML
    // Product names use line-clamp classes, prices use text-lg/text-xl for whole part
    // and text-2xs for decimal part. Old prices have line-through class.
    // Discount badges use bg-c4red-500 class.

    // Strategy 1: Find product cards by looking for line-clamp elements with nearby prices
    $('[class*="line-clamp"]').each((_, nameEl) => {
      try {
        const $name = $(nameEl)
        const name = $name.text().trim()
        if (!name || name.length < 3) return

        // Walk up to find the card container (a div.relative that contains img + price)
        const $card = $name.closest('div.relative')
        if (!$card.length) return

        // Product image from CDN
        const $img = $card.find('img[src*="mafrservices"], img[src*="cdn.mafr"]')
        const imageUrl = $img.attr('src')?.split('?')[0] || null

        // Current price: text-lg (whole) + text-2xs (decimal)
        const $bigPrice = $card.find('[class*="text-lg"], [class*="text-xl"]').first()
        let currentPrice = 0
        if ($bigPrice.length) {
          const whole = $bigPrice.text().trim()
          const $decimal = $bigPrice.next()
          const decimal = $decimal.text().trim().replace('.', '') || '00'
          currentPrice = parseFloat(`${whole}.${decimal}`)
        }

        // Old price from strikethrough
        let oldPrice: number | undefined
        const $strike = $card.find('.line-through')
        if ($strike.length) {
          const match = $strike.text().match(/(\d+\.?\d*)/)
          if (match) oldPrice = parseFloat(match[1])
        }

        // Discount percentage
        let discountPercent: number | undefined
        const $discount = $card.find('[class*="bg-c4red"]')
        if ($discount.length) {
          const match = $discount.text().match(/(\d+)%/)
          if (match) discountPercent = parseInt(match[1])
        }

        if (currentPrice <= 0) return

        offers.push({
          nameAr: name, // Carrefour en page has English names, but they serve Arabic markets
          nameEn: name,
          price: currentPrice,
          oldPrice,
          discountPercent,
          imageUrl: imageUrl ? `${imageUrl}?im=Resize=400` : undefined,
          sourceUrl: this.config.offersUrl,
          tags: 'carrefour,offers',
        })
      } catch (e) {
        // Skip individual product errors
      }
    })

    // Strategy 2: If Strategy 1 found nothing, try parsing RSC data chunks
    if (offers.length === 0) {
      this.log('Strategy 1 found no products, trying RSC data parsing...')
      offers.push(...this.parseFromRSCData(html))
    }

    // Strategy 3: Regex fallback — find price patterns near product-like text
    if (offers.length === 0) {
      this.log('Strategy 2 found no products, trying regex fallback...')
      offers.push(...this.parseFromRegex(html))
    }

    this.log(`Extracted ${offers.length} offers from Carrefour`)
    return offers
  }

  private parseFromRSCData(html: string): ScrapedOffer[] {
    const offers: ScrapedOffer[] = []
    // Look for product data in Next.js RSC chunks
    const pricePattern = /"price":\s*{[^}]*"value":\s*([\d.]+)/g
    const namePattern = /"name":\s*"([^"]+)"/g

    let priceMatch
    const prices: number[] = []
    while ((priceMatch = pricePattern.exec(html)) !== null) {
      prices.push(parseFloat(priceMatch[1]))
    }

    let nameMatch
    const names: string[] = []
    while ((nameMatch = namePattern.exec(html)) !== null) {
      if (nameMatch[1].length > 5 && nameMatch[1].length < 100) {
        names.push(nameMatch[1])
      }
    }

    // Match names to prices
    const minLen = Math.min(names.length, prices.length)
    for (let i = 0; i < minLen; i++) {
      offers.push({
        nameAr: names[i],
        nameEn: names[i],
        price: prices[i],
        sourceUrl: this.config.offersUrl,
        tags: 'carrefour,offers',
      })
    }

    if (offers.length > 0) {
      this.log(`RSC parsing found ${offers.length} products`)
    }
    return offers
  }

  private parseFromRegex(html: string): ScrapedOffer[] {
    const offers: ScrapedOffer[] = []
    // Look for image URLs near price text
    const imgPattern = /cdn\.mafrservices\.com[^"']+?(\d+)_main\.jpg/g
    let imgMatch
    while ((imgMatch = imgPattern.exec(html)) !== null) {
      // Each product image has a unique ID
      const productId = imgMatch[1]
      const imgUrl = imgMatch[0]

      // Look for nearby price in the surrounding HTML
      const ctx = html.substring(
        Math.max(0, imgMatch.index - 500),
        Math.min(html.length, imgMatch.index + 500)
      )
      const priceMatch = ctx.match(/(\d+)\.(\d{2})SAR/)
      if (priceMatch) {
        offers.push({
          nameAr: `Product ${productId}`,
          price: parseFloat(`${priceMatch[1]}.${priceMatch[2]}`),
          imageUrl: `https://${imgUrl}?im=Resize=400`,
          sourceUrl: this.config.offersUrl,
          tags: 'carrefour,offers',
        })
      }
    }

    if (offers.length > 0) {
      this.log(`Regex fallback found ${offers.length} products`)
    }
    return offers
  }
}
