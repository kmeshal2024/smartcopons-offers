import * as cheerio from 'cheerio'
import { BaseScraper } from './base-scraper'
import type { ScrapedOffer } from './types'

/**
 * Al Othaim Markets Scraper
 *
 * Othaim publishes offers as PDF flyers hosted on Contentful CDN.
 * Since PDF parsing doesn't work on serverless (needs canvas/DOMMatrix),
 * we extract catalog data from the HTML pages:
 * 1. Main offers page: catalog sections with images
 * 2. Detail pages: individual catalog entries with thumbnails
 * 3. RSC stream data: offer metadata from Next.js
 */
export class OthaimScraper extends BaseScraper {
  constructor() {
    super({
      supermarketSlug: 'alothaim',
      name: 'Al Othaim Markets',
      nameAr: 'العثيم',
      baseUrl: 'https://www.othaimmarkets.com',
      offersUrl: 'https://www.othaimmarkets.com/ar/offers',
      maxPages: 5,
      requestDelayMs: 2000,
    })
  }

  protected async extractOffers(): Promise<ScrapedOffer[]> {
    const allOffers: ScrapedOffer[] = []

    try {
      // Step 1: Fetch main offers page
      const response = await this.fetchWithRetry(this.config.offersUrl, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ar-SA,ar;q=0.9,en;q=0.8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
      })
      const html = await response.text()
      this.pagesScraped++
      this.log(`Fetched offers page: ${html.length} chars`)

      const $ = cheerio.load(html)

      // Extract offer categories from the page
      const offerPageUrls: string[] = []
      $('a[href*="/offers/"]').each((_, el) => {
        const href = $(el).attr('href')
        if (href && !href.endsWith('.pdf') && href !== '/offers' && href !== '/ar/offers') {
          const fullUrl = href.startsWith('http') ? href : `${this.config.baseUrl}${href}`
          if (!offerPageUrls.includes(fullUrl)) offerPageUrls.push(fullUrl)
        }
      })

      this.log(`Found ${offerPageUrls.length} offer category pages`)

      // Step 2: Scrape each detail page for catalog entries with images
      for (const pageUrl of offerPageUrls.slice(0, 5)) {
        try {
          await this.delay(1000)
          const offers = await this.scrapeDetailPage(pageUrl)
          allOffers.push(...offers)
        } catch (e) {
          this.log(`Detail page failed: ${e instanceof Error ? e.message : e}`)
        }
      }

      // Step 3: Extract from main page RSC data
      if (allOffers.length === 0) {
        allOffers.push(...this.extractFromRSC(html))
      }

      // Step 4: Extract catalog entries from main page HTML
      if (allOffers.length === 0) {
        allOffers.push(...this.extractCatalogsFromPage($, this.config.offersUrl))
      }

    } catch (e) {
      this.logError(`Main page failed: ${e instanceof Error ? e.message : e}`)
    }

    this.log(`Total: ${allOffers.length} offers from Othaim`)
    return allOffers
  }

  private async scrapeDetailPage(url: string): Promise<ScrapedOffer[]> {
    const response = await this.fetchWithRetry(url, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ar-SA,ar;q=0.9,en;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    })
    const html = await response.text()
    this.pagesScraped++
    const $ = cheerio.load(html)

    const offers: ScrapedOffer[] = []

    // Look for catalog/region cards with images and PDF links
    // Each region typically has: title, thumbnail image, PDF link
    const pdfLinks = html.match(/\/api\/pdfOffers\/[^\s"']+\.pdf/g) || []
    const uniquePdfs = Array.from(new Set(pdfLinks))

    // Find all content images (not logos/icons)
    const contentImages: string[] = []
    $('img').each((_, el) => {
      const src = $(el).attr('src') || ''
      if (src.includes('ctfassets.net') && !src.includes('.svg') && !src.includes('logo') && !src.includes('appstore') && !src.includes('google') && !src.includes('footer')) {
        contentImages.push(src)
      }
    })

    // Extract section titles
    const titles: string[] = []
    $('h1, h2, h3, h4, [class*="title"], [class*="heading"]').each((_, el) => {
      const text = $(el).text().trim()
      if (text.length >= 3 && text.length < 100) titles.push(text)
    })

    this.log(`Detail page ${url}: ${uniquePdfs.length} PDFs, ${contentImages.length} images, ${titles.length} titles`)

    // Create an offer for each unique PDF (each represents a regional flyer)
    if (uniquePdfs.length > 0) {
      for (let i = 0; i < uniquePdfs.length; i++) {
        const pdfUrl = `${this.config.baseUrl}${uniquePdfs[i]}`
        const title = titles[i] || this.getTitleFromUrl(url)
        const image = contentImages[i] || contentImages[0]

        offers.push({
          nameAr: title,
          imageUrl: image,
          sourceUrl: pdfUrl,
          price: 0,
          tags: 'othaim,offers,flyer',
        })
      }
    } else if (contentImages.length > 0) {
      // No PDFs but has images - create entries from images
      for (let i = 0; i < contentImages.length; i++) {
        const title = titles[i] || this.getTitleFromUrl(url)
        offers.push({
          nameAr: title,
          imageUrl: contentImages[i],
          sourceUrl: url,
          price: 0,
          tags: 'othaim,offers',
        })
      }
    }

    // Also try to extract from RSC data on this page
    if (offers.length === 0) {
      offers.push(...this.extractFromRSC(html))
    }

    return offers
  }

  private extractFromRSC(html: string): ScrapedOffer[] {
    const offers: ScrapedOffer[] = []

    try {
      // Parse RSC stream for offer data
      const pushPattern = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g
      let match: RegExpExecArray | null

      while ((match = pushPattern.exec(html)) !== null) {
        let decoded: string
        try { decoded = JSON.parse(`"${match[1]}"`) } catch { continue }

        // Look for offer/catalog entries in the RSC data
        if (decoded.includes('pdfOffers') || decoded.includes('ctfassets')) {
          // Extract image URLs
          const imgMatches = decoded.match(/https:\/\/images\.ctfassets\.net\/[^\s"\\]+\.(jpg|png|jpeg|webp)/g)
          const pdfMatches = decoded.match(/\/api\/pdfOffers\/[^\s"\\]+\.pdf/g)

          if (imgMatches) {
            for (const img of imgMatches) {
              if (!img.includes('.svg') && !img.includes('logo')) {
                offers.push({
                  nameAr: 'عروض العثيم',
                  imageUrl: img,
                  sourceUrl: pdfMatches?.[0] ? `${this.config.baseUrl}${pdfMatches[0]}` : this.config.offersUrl,
                  price: 0,
                  tags: 'othaim,offers,flyer',
                })
              }
            }
          }
        }
      }
    } catch (e) {
      this.log(`RSC extraction failed: ${e instanceof Error ? e.message : e}`)
    }

    return offers
  }

  private extractCatalogsFromPage($: cheerio.CheerioAPI, sourceUrl: string): ScrapedOffer[] {
    const offers: ScrapedOffer[] = []

    // Find sections with images that link to offer pages or PDFs
    $('a[href*="/offers/"], a[href*="pdfOffers"]').each((_, el) => {
      const $a = $(el)
      const href = $a.attr('href') || ''
      const img = $a.find('img').first()
      const imgSrc = img.attr('src') || ''
      const title = $a.text().trim() || img.attr('alt') || ''

      if (imgSrc && imgSrc.includes('ctfassets.net') && !imgSrc.includes('.svg')) {
        const fullUrl = href.startsWith('http') ? href : `${this.config.baseUrl}${href}`
        offers.push({
          nameAr: title || 'عروض العثيم',
          imageUrl: imgSrc,
          sourceUrl: fullUrl,
          price: 0,
          tags: 'othaim,offers',
        })
      }
    })

    // Also find standalone content images
    if (offers.length === 0) {
      $('img[src*="ctfassets.net"]').each((_, el) => {
        const src = $(el).attr('src') || ''
        if (!src.includes('.svg') && !src.includes('logo') && !src.includes('footer') && !src.includes('appstore') && !src.includes('google')) {
          const alt = $(el).attr('alt') || 'عروض العثيم'
          offers.push({
            nameAr: alt,
            imageUrl: src,
            sourceUrl,
            price: 0,
            tags: 'othaim,offers',
          })
        }
      })
    }

    return offers
  }

  private getTitleFromUrl(url: string): string {
    const path = new URL(url).pathname
    const slug = path.split('/').pop() || ''
    const titleMap: Record<string, string> = {
      'weekly-promotions': 'العروض الأسبوعية',
      'health-and-beauty': 'عروض الصحة والجمال',
      'fresh-offers': 'عروض الطازج',
    }
    return titleMap[slug] || 'عروض العثيم'
  }
}
