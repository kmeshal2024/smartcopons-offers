import { BaseScraper } from './base-scraper'
import type { ScrapedOffer } from './types'

/**
 * Danube Scraper — Uses Algolia Search API for reliable product data.
 *
 * Strategy: Query Algolia index for products, filter for discounted items only
 * (where compare_at_price > price). This ensures we import DEALS, not the full catalog.
 *
 * Algolia provides: Arabic + English names, prices, discount info, images, categories.
 */
export class DanubeScraper extends BaseScraper {
  constructor() {
    super({
      supermarketSlug: 'danube',
      name: 'Danube',
      nameAr: 'الدانوب',
      baseUrl: 'https://www.danube.sa',
      offersUrl: 'https://1d2iewlqad-dsn.algolia.net/1/indexes/spree_products/query',
      maxPages: 10,
      requestDelayMs: 500,
    })
  }

  private readonly algoliaAppId = '1D2IEWLQAD'
  private readonly algoliaApiKey = '87ca3b6b2ce56f0bb76fc194a8d170e2'
  private readonly algoliaIndex = 'spree_products'

  protected async extractOffers(): Promise<ScrapedOffer[]> {
    // Danube publishes its weekly leaflet on its OWN site (/brochures, PDFs on
    // its own CloudFront). Additive: the Algolia product scrape below is
    // untouched and still supplies the ~630 offer rows. Failure here must never
    // cost us those, hence the isolated try/catch.
    try {
      await this.captureFlyerAsset()
    } catch (e) {
      this.log(`Brochure capture skipped: ${e instanceof Error ? e.message : e}`)
    }

    const allOffers: ScrapedOffer[] = []
    const hitsPerPage = 50
    const url = `https://${this.algoliaAppId.toLowerCase()}-dsn.algolia.net/1/indexes/${this.algoliaIndex}/query`
    const headers = {
      'X-Algolia-Application-Id': this.algoliaAppId,
      'X-Algolia-API-Key': this.algoliaApiKey,
      'Content-Type': 'application/json',
    }

    // Strategy 1: Try on_sale items first
    try {
      const response = await this.fetchWithRetry(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          params: `hitsPerPage=${hitsPerPage}&page=0&filters=tenant_id%20%3D%201%20AND%20on_sale%20%3D%201`,
        }),
      })
      const data = await response.json()
      if (data.nbHits > 0) {
        this.log(`Found ${data.nbHits} on_sale items`)
        for (const hit of data.hits) {
          const offer = this.transformHit(hit)
          if (offer) allOffers.push(offer)
        }
      }
    } catch (e) {
      this.log(`on_sale query failed: ${e instanceof Error ? e.message : e}`)
    }

    // Strategy 2: Search for promotional keywords
    if (allOffers.length === 0) {
      const queries = ['عرض', 'offer', 'خصم', 'تخفيض', 'sale']
      for (const q of queries) {
        try {
          const response = await this.fetchWithRetry(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              params: `hitsPerPage=${hitsPerPage}&page=0&query=${encodeURIComponent(q)}&filters=tenant_id%20%3D%201`,
            }),
          })
          const data = await response.json()
          if (data.hits && data.hits.length > 0) {
            this.log(`Query "${q}": ${data.nbHits} hits`)
            for (const hit of data.hits) {
              const offer = this.transformHit(hit)
              if (offer) allOffers.push(offer)
            }
          }
          await this.delay(300)
        } catch { /* skip */ }
      }
    }

    // Strategy 3: Import popular products with images (paginated) — always runs to supplement
    {
      const maxPages = this.config.maxPages || 10
      const seenIds = new Set(allOffers.map(o => o.sourceUrl))
      for (let page = 0; page < maxPages; page++) {
        try {
          this.log(`Fetching all products page ${page + 1}/${maxPages}...`)
          const response = await this.fetchWithRetry(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              params: `hitsPerPage=${hitsPerPage}&page=${page}&filters=tenant_id%20%3D%201`,
            }),
          })
          const data = await response.json()
          const hits = data.hits || []
          if (hits.length === 0) break

          this.pagesScraped++
          for (const hit of hits) {
            const offer = this.transformHit(hit)
            if (offer && !seenIds.has(offer.sourceUrl)) {
              seenIds.add(offer.sourceUrl)
              allOffers.push(offer)
            }
          }
          this.log(`Page ${page + 1}: ${hits.length} products, ${allOffers.length} total`)
          if (hits.length < hitsPerPage) break
          await this.delay(this.config.requestDelayMs || 500)
        } catch (e) {
          this.logError(`Page ${page + 1} failed: ${e instanceof Error ? e.message : e}`)
          break
        }
      }
    }

    this.log(`Total extracted: ${allOffers.length}`)
    return allOffers
  }

  private transformHit(hit: any): ScrapedOffer | null {
    const price = parseFloat(hit.price) || 0
    if (price <= 0) return null

    // Algolia fields: name_en, name_ar, full_name_en, full_name_ar
    const nameEn = hit.name_en || hit.full_name_en || ''
    const nameAr = hit.name_ar || hit.full_name_ar || nameEn
    if (!nameAr && !nameEn) return null

    // Algolia field: original_price (not compare_at_price)
    const origPrice = parseFloat(hit.original_price) || 0
    const oldPrice = origPrice > price ? origPrice : undefined
    let discountPercent: number | undefined
    if (oldPrice) {
      discountPercent = Math.round(((oldPrice - price) / oldPrice) * 100)
    }

    // Algolia field: image (not image_url or images array)
    let imageUrl: string | undefined = hit.image || undefined
    if (imageUrl && !imageUrl.startsWith('http')) {
      imageUrl = `https://www.danube.sa${imageUrl}`
    }
    // Skip products without images
    if (!imageUrl) return null

    // Extract size/weight from name
    const sizeMatch = (nameEn || nameAr).match(/(\d+(?:\.\d+)?\s*(?:kg|g|ml|l|ltr|litre|pcs?|pack)\b)/i)

    // Algolia field: url_en (not slug)
    const sourceUrl = hit.url_en
      ? `https://www.danube.sa${hit.url_en}`
      : `https://www.danube.sa/en/products/${hit.objectID}`

    return {
      nameAr,
      nameEn: nameEn || undefined,
      price,
      oldPrice,
      discountPercent,
      imageUrl,
      sourceUrl,
      sizeText: sizeMatch ? sizeMatch[1] : undefined,
      brand: hit.brand_en || hit.brand_ar || undefined,
    }
  }

  /**
   * Danube's own weekly brochure.
   *
   * /brochures lists ~11 leaflets at once — regional weeklies (العروض الاسبوعية),
   * regional fortnightlies (عروض الاسبوعين) and campaign one-offs (back-to-school,
   * أقوى العروض). We want the CENTRAL region weekly: Riyadh is the largest
   * catchment and this site is Saudi-wide.
   *
   * Matched on the card TITLE rather than the numeric brochure id. The ids are
   * stable but the PDF behind each one is replaced weekly, and a campaign leaflet
   * can take over a low id — matching on "الوسطى" + "الأسبوعية" keeps pointing at
   * the right leaflet after Danube reshuffles the list.
   *
   * The PDF has no Access-Control-Allow-Origin (verified), so pdf.js cannot render
   * it in-browser; FlyerViewer falls back to a direct link. Same as Farm.
   */
  private async captureFlyerAsset(): Promise<void> {
    const listUrl = `${this.config.baseUrl.replace('www.', '')}/brochures`
    const res = await this.fetchWithRetry(listUrl)
    const html = await res.text()
    this.pagesScraped++

    // Split the listing into per-card blobs so a title stays associated with the
    // PDF that follows it.
    const cards = Array.from(
      html.matchAll(/href="\/brochures\/(\d+)"([\s\S]{0,900}?)(?=href="\/brochures\/|$)/g)
    ).map(m => {
      const blob = m[2] || ''
      const alt = (blob.match(/alt="([^"]{3,80})"/) || [])[1] || ''
      const pdf = (blob.match(/https?:\/\/[^\s"'<>]+\.pdf/) || [])[0] || ''
      const img = (blob.match(/https?:\/\/[^\s"'<>]+\.(?:png|jpe?g|webp)/i) || [])[0] || ''
      return { id: m[1], title: alt.replace(/\s+/g, ' ').trim(), pdf, img }
    }).filter(c => c.pdf)

    if (cards.length === 0) {
      this.log('No Danube brochure PDFs found — listing layout may have changed')
      return
    }

    const weekly = (t: string) => /الاسبوعية|الأسبوعية/.test(t)
    const central = (t: string) => /الوسطى/.test(t)

    const chosen =
      cards.find(c => central(c.title) && weekly(c.title)) ||
      cards.find(c => weekly(c.title)) ||
      cards[0]

    this.flyerAsset = {
      pdfUrl: chosen.pdf,
      coverImage: chosen.img || undefined,
      titleAr: chosen.title || 'عروض الدانوب الأسبوعية',
    }
    this.log(
      `Brochure: #${chosen.id} "${chosen.title}" (${cards.length} listed) ${chosen.pdf.slice(0, 70)}`
    )
  }

}
