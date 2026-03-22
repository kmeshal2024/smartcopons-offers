import { BaseScraper } from './base-scraper'
import type { ScrapedOffer } from './types'

interface PandaVariety {
  sku: number
  price: string
  undiscounted_price?: string
  discount_label?: string
  show_discount?: boolean
  imageURL?: string
  images?: string[][]
  size?: string
  unit?: string
  availability?: number
}

interface PandaProduct {
  id: number
  name: string
  brand?: { id: number; name: string }
  category?: { id: number; name: string }
  varieties: PandaVariety[]
}

interface PandaApiResponse {
  products: {
    status: boolean
    data: {
      total_records: number
      next_page: boolean
      products: PandaProduct[]
    }
  }
}

export class PandaScraper extends BaseScraper {
  constructor() {
    super({
      supermarketSlug: 'panda',
      name: 'Panda',
      nameAr: 'بنده',
      baseUrl: 'https://panda.sa',
      offersUrl: 'https://panda.sa/api/products?deals=1',
      maxPages: 10,
      requestDelayMs: 1000,
    })
  }

  protected async extractOffers(): Promise<ScrapedOffer[]> {
    const allOffers: ScrapedOffer[] = []
    let page = 1
    const pageSize = 60
    let hasMore = true

    while (hasMore && page <= (this.config.maxPages || 10)) {
      try {
        const url = `${this.config.offersUrl}&page=${page}&limit=${pageSize}`
        this.log(`Fetching page ${page}: ${url}`)

        const response = await this.fetchWithRetry(url, {
          headers: {
            'Accept': 'application/json',
          },
        })
        const data: PandaApiResponse = await response.json()
        this.pagesScraped++

        if (!data.products?.data?.products?.length) {
          this.log(`No products on page ${page}, stopping`)
          break
        }

        const products = data.products.data.products
        this.log(`Page ${page}: ${products.length} products (total available: ${data.products.data.total_records})`)

        for (const product of products) {
          const offers = this.parseProduct(product)
          allOffers.push(...offers)
        }

        hasMore = data.products.data.next_page
        page++

        if (hasMore) {
          await this.delay(this.config.requestDelayMs || 1000)
        }
      } catch (e) {
        this.logError(`Page ${page} failed: ${e instanceof Error ? e.message : e}`)
        break
      }
    }

    this.log(`Total extracted: ${allOffers.length} offers from ${this.pagesScraped} pages`)
    return allOffers
  }

  private parseProduct(product: PandaProduct): ScrapedOffer[] {
    const offers: ScrapedOffer[] = []

    for (const variety of product.varieties) {
      const price = parseFloat(variety.price)
      if (price <= 0) continue

      // Get the large image URL
      let imageUrl = variety.imageURL
      if (variety.images?.[0]?.[1]) {
        imageUrl = variety.images[0][1]
      } else if (imageUrl) {
        imageUrl = imageUrl.replace('_small.', '_large.')
      }

      // Parse discount
      let discountPercent: number | undefined
      let oldPrice: number | undefined

      if (variety.undiscounted_price) {
        oldPrice = parseFloat(variety.undiscounted_price)
        if (oldPrice > price) {
          discountPercent = Math.round(((oldPrice - price) / oldPrice) * 100)
        }
      }

      if (!discountPercent && variety.discount_label) {
        const match = variety.discount_label.match(/(\d+)%/)
        if (match) discountPercent = parseInt(match[1])
      }

      const sizeText = variety.size && variety.unit
        ? `${variety.size} ${variety.unit}`
        : variety.size || undefined

      offers.push({
        nameAr: product.name,
        nameEn: product.name,
        brand: product.brand?.name,
        price,
        oldPrice,
        discountPercent,
        sizeText,
        imageUrl: imageUrl?.startsWith('http') ? imageUrl : undefined,
        sourceUrl: 'https://panda.sa/en/plp?deals=1',
        tags: `panda,deals${product.category?.name ? `,${product.category.name.toLowerCase()}` : ''}`,
      })
    }

    return offers
  }
}
