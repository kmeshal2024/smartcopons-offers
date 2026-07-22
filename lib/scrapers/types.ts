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

/**
 * Flyer assets discovered while scraping (PDF brochure, cover image).
 * Retailers like Al Othaim publish their weekly offers as a PDF rather than
 * as individual products — this carries that file through to the Flyer record
 * so FlyerViewer has something to render.
 */
export interface ScrapedFlyerAsset {
  /** Must be a CORS-enabled URL — pdf.js fetches it from the browser. */
  pdfUrl?: string
  coverImage?: string
  totalPages?: number
  titleAr?: string
}

export interface ScraperResult {
  success: boolean
  offers: ScrapedOffer[]
  errors: string[]
  logs: string[]
  scrapedAt: Date
  durationMs: number
  pagesScraped: number
  flyerAsset?: ScrapedFlyerAsset
}

export interface ISupermarketScraper {
  config: ScraperConfig
  scrape(): Promise<ScraperResult>
}
