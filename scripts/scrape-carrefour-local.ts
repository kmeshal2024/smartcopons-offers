#!/usr/bin/env npx tsx
/**
 * Carrefour KSA Local Scraper
 * Must run locally — Akamai blocks Vercel/cloud IPs.
 * Uses Puppeteer to render the page and extract product data.
 *
 * Usage:
 *   npx tsx scripts/scrape-carrefour-local.ts           # Dry run (print results)
 *   npx tsx scripts/scrape-carrefour-local.ts --ingest   # Scrape + ingest to DB
 */

import puppeteer from 'puppeteer'

interface CarrefourProduct {
  name: string
  price: number
  oldPrice?: number
  discountPercent?: number
  imageUrl?: string
}

const OFFERS_URL = 'https://www.carrefourksa.com/mafsau/en/n/c/clp_carrefouroffers'
const INGEST = process.argv.includes('--ingest')

async function scrapeCarrefour(): Promise<CarrefourProduct[]> {
  console.log('[Carrefour] Launching browser...')
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  try {
    const page = await browser.newPage()
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )

    console.log('[Carrefour] Navigating to offers page...')
    await page.goto(OFFERS_URL, { waitUntil: 'networkidle2', timeout: 60000 })

    // Wait for product cards to render
    console.log('[Carrefour] Waiting for products to load...')
    await page.waitForSelector('[data-testid="product_card"], .product-card, [class*="product"]', {
      timeout: 30000,
    }).catch(() => {
      console.log('[Carrefour] No product card selector found, trying scroll approach...')
    })

    // Scroll down to load more products (lazy loading)
    let prevHeight = 0
    for (let i = 0; i < 10; i++) {
      const currentHeight = await page.evaluate(() => document.body.scrollHeight)
      if (currentHeight === prevHeight) break
      prevHeight = currentHeight
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await new Promise(r => setTimeout(r, 2000))
    }

    // Extract product data from the page
    const products = await page.evaluate(() => {
      const results: CarrefourProduct[] = []

      // Strategy 1: Look for product card elements with prices
      const cards = document.querySelectorAll(
        '[data-testid="product_card"], .css-b9nx4o, [class*="product-card"], article'
      )

      if (cards.length > 0) {
        cards.forEach(card => {
          try {
            // Name
            const nameEl = card.querySelector('[class*="line-clamp"], [class*="product-name"], h3, h2')
            const name = nameEl?.textContent?.trim()
            if (!name || name.length < 3) return

            // Image
            const imgEl = card.querySelector('img[src*="mafrservices"], img[src*="cdn.mafr"], img[src*="carrefour"]')
            let imageUrl = imgEl?.getAttribute('src') || undefined
            if (imageUrl) imageUrl = imageUrl.split('?')[0] + '?im=Resize=400'

            // Current price
            let price = 0
            const priceEls = card.querySelectorAll('[class*="price"]')
            priceEls.forEach(el => {
              const text = el.textContent || ''
              const match = text.match(/(\d+\.?\d*)/)
              if (match && !el.classList.toString().includes('line-through') && !el.closest('.line-through')) {
                const val = parseFloat(match[1])
                if (val > 0 && (price === 0 || val < price)) price = val
              }
            })

            // Fallback: look for price anywhere in card
            if (price <= 0) {
              const allText = card.textContent || ''
              const priceMatch = allText.match(/(\d+\.?\d*)\s*(?:SAR|ر\.س)/)
              if (priceMatch) price = parseFloat(priceMatch[1])
            }

            if (price <= 0) return

            // Old price
            let oldPrice: number | undefined
            const strikeEl = card.querySelector('.line-through, del, s')
            if (strikeEl) {
              const match = strikeEl.textContent?.match(/(\d+\.?\d*)/)
              if (match) oldPrice = parseFloat(match[1])
            }

            // Discount badge
            let discountPercent: number | undefined
            const badgeEl = card.querySelector('[class*="c4red"], [class*="discount"], [class*="badge"]')
            if (badgeEl) {
              const match = badgeEl.textContent?.match(/(\d+)\s*%/)
              if (match) discountPercent = parseInt(match[1])
            }

            // Calculate discount if we have old price but no badge
            if (!discountPercent && oldPrice && oldPrice > price) {
              discountPercent = Math.round(((oldPrice - price) / oldPrice) * 100)
            }

            results.push({ name, price, oldPrice, discountPercent, imageUrl })
          } catch { /* skip */ }
        })
      }

      // Strategy 2: Intercept any JSON data in the page
      if (results.length === 0) {
        // Try to find product data in script tags or RSC data
        const scripts = document.querySelectorAll('script')
        scripts.forEach(script => {
          const text = script.textContent || ''
          try {
            // Look for JSON product arrays
            const productMatches = text.match(/"products"\s*:\s*\[([\s\S]*?)\]/g)
            if (productMatches) {
              for (const pm of productMatches) {
                const nameMatches = pm.match(/"name"\s*:\s*"([^"]+)"/g)
                const priceMatches = pm.match(/"price"\s*:\s*(\d+\.?\d*)/g)
                if (nameMatches && priceMatches) {
                  const len = Math.min(nameMatches.length, priceMatches.length)
                  for (let i = 0; i < len; i++) {
                    const name = nameMatches[i].match(/"name"\s*:\s*"([^"]+)"/)?.[1]
                    const price = parseFloat(priceMatches[i].match(/(\d+\.?\d*)/)?.[1] || '0')
                    if (name && price > 0) {
                      results.push({ name, price })
                    }
                  }
                }
              }
            }
          } catch { /* skip */ }
        })
      }

      return results
    })

    console.log(`[Carrefour] Extracted ${products.length} products`)
    return products
  } finally {
    await browser.close()
  }
}

async function ingestToDb(products: CarrefourProduct[]) {
  // Dynamic import to avoid loading Prisma when not needed
  const { prisma } = await import('../lib/db')
  const { OfferIngestService } = await import('../lib/services/offer-ingest')

  const offers = products.map(p => ({
    nameAr: p.name,
    nameEn: p.name,
    price: p.price,
    oldPrice: p.oldPrice,
    discountPercent: p.discountPercent,
    imageUrl: p.imageUrl,
    sourceUrl: OFFERS_URL,
    tags: 'carrefour,offers',
  }))

  const ingestService = new OfferIngestService()
  const result = await ingestService.ingest('carrefour', offers, [
    `[local] Scraped ${products.length} products via Puppeteer`,
  ])

  console.log(`[Carrefour] Ingested: ${result.newOffers} new, ${result.duplicatesSkipped} duplicates`)
  await prisma.$disconnect()
}

async function main() {
  const products = await scrapeCarrefour()

  if (products.length === 0) {
    console.log('[Carrefour] No products found. Site may have changed structure.')
    process.exit(1)
  }

  // Print summary
  console.log('\n--- Results ---')
  console.log(`Total products: ${products.length}`)
  const withDiscount = products.filter(p => p.discountPercent)
  console.log(`With discount: ${withDiscount.length}`)
  const withImage = products.filter(p => p.imageUrl)
  console.log(`With image: ${withImage.length}`)

  // Show sample
  console.log('\nSample products:')
  products.slice(0, 5).forEach(p => {
    console.log(`  ${p.name} — ${p.price} SAR${p.oldPrice ? ` (was ${p.oldPrice})` : ''}${p.discountPercent ? ` [${p.discountPercent}% off]` : ''}`)
  })

  if (INGEST) {
    console.log('\n[Carrefour] Ingesting to database...')
    await ingestToDb(products)
  } else {
    console.log('\nDry run. Use --ingest to save to database.')
  }
}

main().catch(e => {
  console.error('[Carrefour] Fatal error:', e)
  process.exit(1)
})
