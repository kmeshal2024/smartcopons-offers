import * as cheerio from 'cheerio'
import { BaseScraper } from './base-scraper'
import type { ScrapedOffer } from './types'

/**
 * Farm Superstores (أسواق المزرعة) — weekly flyer, from Farm's own site.
 *
 * Replaces a ClicFlyer-sourced leaflet. Three reasons that mattered: the artwork
 * is the retailer's copyright and not ClicFlyer's to pass on, ClicFlyer is a
 * direct competitor whose terms scraping would breach, and building our
 * differentiator on a competitor's infrastructure means they can end it whenever
 * they choose. Farm publishes the same leaflet itself, so none of that is
 * necessary.
 *
 * Farm renders the offers page server-side — the PDF anchors are in the HTML —
 * so this runs in the serverless cron like Panda/Danube, with no dependency on
 * the local Playwright host.
 *
 * FLYER ONLY. It returns no product rows, deliberately: extracting products from
 * a PDF is a genuinely large job (no scraper in this codebase has ever done it),
 * and emitting `price: 0` placeholder rows the way the Al Othaim scraper does
 * only produces junk that offer-ingest rejects anyway. Farm therefore appears in
 * /api/health `staleRetailers` as active-flyer-zero-offers, which is accurate.
 */
export class FarmScraper extends BaseScraper {
  constructor() {
    super({
      supermarketSlug: 'farm',
      name: 'Farm Superstores',
      nameAr: 'أسواق المزرعة',
      baseUrl: 'https://www.farm.com.sa',
      // "عروض اسبوعيه" — the weekly leaflet. Farm splits it by region; the
      // categories page lists the other campaigns (Monday offers, online-only).
      offersUrl: 'https://www.farm.com.sa/ar/Offers_Regions/2',
      maxPages: 1,
      requestDelayMs: 1000,
    })
  }

  protected async extractOffers(): Promise<ScrapedOffer[]> {
    try {
      const response = await this.fetchWithRetry(this.config.offersUrl)
      const html = await response.text()
      this.pagesScraped++
      this.log(`Fetched Farm offers page: ${html.length} chars`)

      this.captureFlyerAsset(html)
    } catch (e) {
      this.logError(`Farm offers page failed: ${e instanceof Error ? e.message : e}`)
    }

    return []
  }

  /**
   * Pull the current weekly PDF and a cover image off the offers page.
   *
   * Farm publishes one PDF per region group, each with the publication date in
   * the filename (`..._12-8-2026.pdf`). We take the group covering Riyadh, which
   * is both the largest catchment and the widest file — the other covers the
   * north only. The date is parsed from the filename so a stale file is
   * detectable rather than silently presented as current.
   */
  private captureFlyerAsset(html: string): void {
    const $ = cheerio.load(html)

    const pdfPaths = new Set<string>()
    $('a[href*="PDF/Offers"]').each((_, el) => {
      const href = $(el).attr('href') || ''
      const m = href.match(/PDF\/Offers\/[A-Za-z]+\/[^"'\s]+\.pdf/i)
      if (m) pdfPaths.add(m[0])
    })
    // The anchors are relative (`../../PDF/...`), so also sweep the raw HTML in
    // case the markup changes shape. `match` rather than `matchAll` — this
    // tsconfig targets pre-ES2015 iteration, so iterating the matchAll iterator
    // needs --downlevelIteration.
    const rawMatches = html.match(/PDF\/Offers\/[A-Za-z]+\/[^"'\s>]+\.pdf/gi) || []
    for (const raw of rawMatches) pdfPaths.add(raw)

    if (pdfPaths.size === 0) {
      this.logError('No Farm PDF found on the offers page — layout may have changed')
      return
    }

    const paths = Array.from(pdfPaths)
    // Prefer the Riyadh-bearing file; fall back to the longest name, which is the
    // one covering the most regions.
    const chosen =
      paths.find(p => /riy/i.test(p)) ||
      paths.sort((a, b) => b.length - a.length)[0]

    const pdfUrl = `${this.config.baseUrl}/${chosen.replace(/^\/+/, '')}`

    // Cover: Farm's own region artwork, referenced from Farm's domain — linked,
    // never copied. farm.com.sa is already allowed in next.config images.
    // Resolved with `new URL`, not string-concatenated: Farm's markup uses
    // document-relative paths (`../../Images/...`), and naive concatenation
    // produced `https://www.farm.com.sa/../../Images/...` — a 404.
    const coverRaw = $('img[src*="Images/Offers"]').first().attr('src')
    let coverImage: string | undefined
    if (coverRaw) {
      try {
        coverImage = new URL(coverRaw, this.config.offersUrl).href
      } catch {
        coverImage = undefined
      }
    }

    const published = this.parseDateFromFilename(chosen)
    if (published) {
      const ageDays = Math.floor((Date.now() - published.getTime()) / 86_400_000)
      this.log(`Farm PDF published ${published.toISOString().slice(0, 10)} (${ageDays}d old)`)
      // Farm's leaflet runs weekly. Anything much older means they stopped
      // publishing or the filename format moved; say so rather than serving it
      // as this week's prices.
      if (ageDays > 14) {
        this.logError(`Farm PDF is ${ageDays} days old — treating as stale`)
        return
      }
    }

    this.flyerAsset = {
      pdfUrl,
      coverImage,
      titleAr: 'عروض أسواق المزرعة الأسبوعية',
    }
    this.log(`Flyer asset: ${pdfUrl}${coverImage ? ' (+cover)' : ''} — ${paths.length} PDF(s) found`)
  }

  /** `..._12-8-2026.pdf` → 12 Aug 2026. Returns null if the pattern is absent. */
  private parseDateFromFilename(path: string): Date | null {
    const m = path.match(/_(\d{1,2})-(\d{1,2})-(\d{4})\.pdf$/i)
    if (!m) return null
    const [, d, mo, y] = m
    // UTC, not local: `new Date(y, m, d)` is midnight LOCAL, which serialises to
    // the previous day once the host sits east of UTC (Vercel runs fra1, the
    // scrapers target Riyadh) and made a fresh flyer look a day older.
    const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)))
    return Number.isNaN(date.getTime()) ? null : date
  }
}
