import type { ScrapedOffer, ScraperConfig, ScraperResult, ISupermarketScraper } from './types'

export abstract class BaseScraper implements ISupermarketScraper {
  config: ScraperConfig
  protected logs: string[] = []
  protected errors: string[] = []
  protected pagesScraped = 0

  constructor(config: ScraperConfig) {
    this.config = config
  }

  protected async fetchWithRetry(
    url: string,
    options?: RequestInit,
    retries = 2
  ): Promise<Response> {
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'ar-SA,ar;q=0.9,en;q=0.8',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8',
      ...(options?.headers as Record<string, string> || {}),
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 30000)

        const response = await fetch(url, {
          ...options,
          headers,
          signal: controller.signal,
        })
        clearTimeout(timeout)

        if (!response.ok) {
          throw new Error(`HTTP ${response.status} for ${url}`)
        }
        return response
      } catch (error) {
        if (attempt === retries) throw error
        this.log(`Retry ${attempt + 1} for ${url}`)
        await this.delay(2000 * (attempt + 1))
      }
    }
    throw new Error('Unreachable')
  }

  protected async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  protected log(message: string): void {
    const ts = new Date().toISOString().substring(11, 19)
    this.logs.push(`[${ts}] ${message}`)
    console.log(`[${this.config.name}] ${message}`)
  }

  protected logError(message: string): void {
    this.errors.push(message)
    console.error(`[${this.config.name}] ERROR: ${message}`)
  }

  async scrape(): Promise<ScraperResult> {
    const startTime = Date.now()
    this.logs = []
    this.errors = []
    this.pagesScraped = 0
    let offers: ScrapedOffer[] = []

    try {
      this.log(`Starting scrape of ${this.config.offersUrl}`)
      offers = await this.extractOffers()
      this.log(`Extracted ${offers.length} offers from ${this.pagesScraped} pages`)
    } catch (error) {
      this.logError(error instanceof Error ? error.message : String(error))
    }

    return {
      success: this.errors.length === 0,
      offers,
      errors: this.errors,
      logs: this.logs,
      scrapedAt: new Date(),
      durationMs: Date.now() - startTime,
      pagesScraped: this.pagesScraped,
    }
  }

  protected abstract extractOffers(): Promise<ScrapedOffer[]>
}
