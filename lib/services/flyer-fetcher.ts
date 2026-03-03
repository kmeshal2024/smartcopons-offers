import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Flyer source configuration for Saudi supermarkets.
 *
 * Strategy comparison:
 * - Scraping: Automated but risky (sites change, legal gray area)
 * - Manual upload: Reliable, admin-controlled
 * - Hybrid: Check known URLs for new PDFs, admin reviews before publishing
 *
 * This module implements the HYBRID approach:
 * 1. Check known flyer page URLs for new PDF links
 * 2. Create DRAFT flyers automatically
 * 3. Admin reviews, uploads PDF if scraping fails, then triggers extraction
 */

export interface FlyerSource {
  supermarketSlug: string
  name: string
  nameAr: string
  // URL to check for new flyers (the supermarket's offers page)
  flyerPageUrl: string
  // CSS selector or regex to find PDF links on that page
  pdfLinkPattern: string
  // How often to check (hours)
  checkIntervalHours: number
}

// Saudi supermarket flyer sources
export const SAUDI_FLYER_SOURCES: FlyerSource[] = [
  {
    supermarketSlug: 'carrefour-sa',
    name: 'Carrefour Saudi',
    nameAr: 'كارفور',
    flyerPageUrl: 'https://www.carrefourksa.com/mafsau/en/weekly-offers',
    pdfLinkPattern: '\\.pdf',
    checkIntervalHours: 24,
  },
  {
    supermarketSlug: 'panda',
    name: 'Panda',
    nameAr: 'بنده',
    flyerPageUrl: 'https://www.pfrmt.com/en/offers',
    pdfLinkPattern: '\\.pdf',
    checkIntervalHours: 24,
  },
  {
    supermarketSlug: 'lulu-hypermarket',
    name: 'LuLu Hypermarket',
    nameAr: 'لولو هايبرماركت',
    flyerPageUrl: 'https://www.luluhypermarket.com/en-sa/offers',
    pdfLinkPattern: '\\.pdf',
    checkIntervalHours: 24,
  },
  {
    supermarketSlug: 'danube',
    name: 'Danube',
    nameAr: 'الدانوب',
    flyerPageUrl: 'https://www.bindawood.com/en/offers',
    pdfLinkPattern: '\\.pdf',
    checkIntervalHours: 24,
  },
]

/**
 * Check a single supermarket for new flyers.
 * Returns newly created draft flyer IDs (if any).
 *
 * Note: This is a scaffold. In production, you would use:
 * - puppeteer/playwright for JS-rendered pages
 * - Simple fetch + cheerio for static pages
 * - Respect robots.txt and rate limits
 */
export async function checkForNewFlyers(source: FlyerSource): Promise<string[]> {
  const newFlyerIds: string[] = []

  try {
    console.log(`[FlyerFetcher] Checking ${source.name}...`)

    // Find the supermarket in our DB
    const supermarket = await prisma.supermarket.findUnique({
      where: { slug: source.supermarketSlug },
    })

    if (!supermarket) {
      console.log(`[FlyerFetcher] Supermarket ${source.supermarketSlug} not found in DB. Skipping.`)
      return []
    }

    // Fetch the offers page
    const response = await fetch(source.flyerPageUrl, {
      headers: {
        'User-Agent': 'SmartCopons/1.0 (Saudi offers aggregator)',
        'Accept-Language': 'ar-SA,ar;q=0.9,en;q=0.8',
      },
    })

    if (!response.ok) {
      console.log(`[FlyerFetcher] Failed to fetch ${source.flyerPageUrl}: ${response.status}`)
      return []
    }

    const html = await response.text()

    // Extract PDF links using regex (simple approach)
    const pdfRegex = new RegExp(`href=["']([^"']*${source.pdfLinkPattern}[^"']*)["']`, 'gi')
    const pdfLinks: string[] = []
    let match

    while ((match = pdfRegex.exec(html)) !== null) {
      let url = match[1]
      // Resolve relative URLs
      if (url.startsWith('/')) {
        const base = new URL(source.flyerPageUrl)
        url = `${base.origin}${url}`
      }
      pdfLinks.push(url)
    }

    console.log(`[FlyerFetcher] Found ${pdfLinks.length} PDF links on ${source.name}`)

    // Check each PDF link against existing flyers
    for (const pdfUrl of pdfLinks) {
      const existing = await prisma.flyer.findFirst({
        where: {
          supermarketId: supermarket.id,
          pdfUrl,
        },
      })

      if (!existing) {
        // Create a new draft flyer
        const today = new Date()
        const nextWeek = new Date(today)
        nextWeek.setDate(nextWeek.getDate() + 7)

        const flyer = await prisma.flyer.create({
          data: {
            supermarketId: supermarket.id,
            title: `${source.name} - New Flyer ${today.toISOString().split('T')[0]}`,
            titleAr: `${source.nameAr} - عروض جديدة`,
            startDate: today,
            endDate: nextWeek,
            pdfUrl,
            status: 'DRAFT',
          },
        })

        newFlyerIds.push(flyer.id)
        console.log(`[FlyerFetcher] Created draft flyer: ${flyer.title}`)
      }
    }
  } catch (error) {
    console.error(`[FlyerFetcher] Error checking ${source.name}:`, error)
  }

  return newFlyerIds
}

/**
 * Check all Saudi supermarket sources for new flyers.
 * Designed to be called by a cron job.
 */
export async function checkAllSources(): Promise<{ checked: number; newFlyers: number }> {
  console.log('[FlyerFetcher] Starting scheduled check...')

  let totalNew = 0

  for (const source of SAUDI_FLYER_SOURCES) {
    const newIds = await checkForNewFlyers(source)
    totalNew += newIds.length

    // Rate limit: wait 2 seconds between sources
    await new Promise(resolve => setTimeout(resolve, 2000))
  }

  console.log(`[FlyerFetcher] Check complete. ${SAUDI_FLYER_SOURCES.length} sources checked, ${totalNew} new flyers found.`)

  return {
    checked: SAUDI_FLYER_SOURCES.length,
    newFlyers: totalNew,
  }
}
