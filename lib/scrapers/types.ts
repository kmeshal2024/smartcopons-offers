export interface ScrapedOffer {
  nameAr: string
  nameEn?: string
  brand?: string
  price: number
  oldPrice?: number
  discountPercent?: number
  sizeText?: string
  imageUrl?: string
  sourceUrl: string
  pageNumber?: number
  tags?: string
}

export interface ScraperConfig {
  supermarketSlug: string
  name: string
  nameAr: string
  baseUrl: string
  offersUrl: string
  maxPages?: number
  requestDelayMs?: number
}

export interface ScraperResult {
  success: boolean
  offers: ScrapedOffer[]
  errors: string[]
  logs: string[]
  scrapedAt: Date
  durationMs: number
  pagesScraped: number
}

export interface ISupermarketScraper {
  config: ScraperConfig
  scrape(): Promise<ScraperResult>
}
