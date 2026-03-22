#!/usr/bin/env npx tsx
/**
 * Local Carrefour KSA Scraper
 *
 * Fetches deals from Carrefour KSA website using the local machine's IP
 * (bypasses Akamai Bot Manager datacenter IP blocking), then sends
 * extracted products to the production scrape-submit API for ingestion.
 *
 * Usage:
 *   npx tsx scripts/scrape-carrefour-local.ts                    # dry-run (no ingest)
 *   npx tsx scripts/scrape-carrefour-local.ts --ingest            # ingest all
 *   npx tsx scripts/scrape-carrefour-local.ts --ingest --limit=50 # ingest first 50
 *
 * Environment:
 *   APP_SECRET  - auth secret (defaults to smartcopons-secret-2024-ksa)
 *   API_BASE    - API base URL (defaults to https://sa.smartcopons.com)
 */

const BASE_URL = 'https://www.carrefourksa.com'
const DEALS_PATH = '/mafsau/en/c/ksa-best-dealss'
const PAGE_SIZE = 60
const MAX_PAGES = 20

const REQUIRED_HEADERS: Record<string, string> = {
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Sec-Ch-Ua': '"Chromium";v="120", "Not_A Brand";v="8", "Google Chrome";v="120"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}

interface ScrapedOffer {
  nameAr: string
  nameEn?: string
  brand?: string
  price: number
  oldPrice?: number
  discountPercent?: number
  sizeText?: string
  imageUrl?: string
  sourceUrl: string
  tags?: string
}

// ─── Arabic Grocery Tags ─────────────────────────────────────────

const GROCERY_AR_RULES: Array<[RegExp, string[]]> = [
  [/milk|laban/i, ['حليب', 'لبن']],
  [/yogurt/i, ['زبادي']],
  [/cheese/i, ['جبن']],
  [/butter/i, ['زبدة']],
  [/cream/i, ['كريم']],
  [/egg/i, ['بيض']],
  [/chicken/i, ['دجاج']],
  [/beef|veal|meat/i, ['لحم']],
  [/fish|tuna|salmon|shrimp/i, ['سمك']],
  [/rice/i, ['أرز', 'رز']],
  [/bread/i, ['خبز']],
  [/flour/i, ['طحين']],
  [/pasta|macaroni|spaghetti/i, ['معكرونة']],
  [/oil/i, ['زيت']],
  [/olive/i, ['زيتون']],
  [/sugar/i, ['سكر']],
  [/tea\b/i, ['شاي']],
  [/coffee/i, ['قهوة']],
  [/juice/i, ['عصير']],
  [/water\b/i, ['ماء']],
  [/biscuit|cookie/i, ['بسكويت']],
  [/chocolate/i, ['شوكولاتة']],
  [/chip|crisp/i, ['شيبس']],
  [/dates?\b/i, ['تمر']],
  [/frozen/i, ['مجمد']],
  [/sauce|ketchup/i, ['صلصة']],
  [/soap/i, ['صابون']],
  [/shampoo/i, ['شامبو']],
  [/detergent|clean/i, ['منظف']],
  [/tissue/i, ['مناديل']],
  [/diaper/i, ['حفاضات']],
  [/potato|fries/i, ['بطاطس']],
  [/tomato/i, ['طماطم']],
  [/ice cream/i, ['مثلجات']],
  [/honey/i, ['عسل']],
  [/nut|almond|cashew/i, ['مكسرات']],
  [/hummus/i, ['حمص']],
]

function getArabicTags(name: string): string {
  const tags: string[] = []
  for (const [re, ar] of GROCERY_AR_RULES) {
    if (re.test(name)) tags.push(...ar)
  }
  return [...new Set(tags)].join(',')
}

// ─── RSC Extraction ───────────────────────────────────────────────

function extractProductsFromRSC(html: string): { products: any[]; total: number } {
  try {
    const pushPattern = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g
    let match: RegExpExecArray | null
    let productsData: any[] = []
    let totalProducts = 0

    while ((match = pushPattern.exec(html)) !== null) {
      const escaped = match[1]

      // Quick check for product data markers
      if (!escaped.includes('\\"products\\"') && !escaped.includes('\\\"products\\\"')) {
        continue
      }

      // Unescape RSC stream
      let rscStream: string
      try {
        rscStream = JSON.parse(`"${escaped}"`)
      } catch {
        continue
      }

      // Extract totalProducts
      const totalMatch = rscStream.match(/"totalProducts":\s*(\d+)/)
      if (totalMatch) {
        totalProducts = parseInt(totalMatch[1])
      }

      // Extract products array
      const productsStart = rscStream.indexOf('"products":[')
      if (productsStart === -1) continue

      const arrayStart = productsStart + '"products":'.length
      const arrayContent = extractJSONArray(rscStream, arrayStart)
      if (!arrayContent) continue

      try {
        productsData = JSON.parse(arrayContent)
        if (Array.isArray(productsData) && productsData.length > 0) {
          break
        }
      } catch {
        continue
      }
    }

    return { products: productsData, total: totalProducts }
  } catch (error) {
    console.error('RSC extraction failed:', error)
    return { products: [], total: 0 }
  }
}

function extractJSONArray(str: string, startPos: number): string | null {
  if (str[startPos] !== '[') return null

  let depth = 0
  let inString = false
  let escape = false

  for (let i = startPos; i < str.length; i++) {
    const ch = str[i]

    if (escape) { escape = false; continue }
    if (ch === '\\') { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue

    if (ch === '[') depth++
    else if (ch === ']') {
      depth--
      if (depth === 0) return str.substring(startPos, i + 1)
    }
  }
  return null
}

// ─── Product Mapping ──────────────────────────────────────────────

function mapProducts(products: any[]): ScrapedOffer[] {
  const offers: ScrapedOffer[] = []

  for (const product of products) {
    try {
      const name = product.name?.trim()
      if (!name || name.length < 2) continue

      const priceObj = product.price
      if (!priceObj) continue

      const hasDiscount = priceObj.discount && priceObj.discount.price !== undefined
      const currentPrice = hasDiscount
        ? parseFloat(priceObj.discount.price)
        : parseFloat(priceObj.price)

      if (!currentPrice || currentPrice <= 0) continue

      const oldPrice = hasDiscount ? parseFloat(priceObj.price) : undefined

      let discountPercent: number | undefined
      if (hasDiscount && priceObj.discount.value) {
        discountPercent = Math.round(parseFloat(priceObj.discount.value))
      } else if (oldPrice && oldPrice > currentPrice) {
        discountPercent = Math.round(((oldPrice - currentPrice) / oldPrice) * 100)
      }

      // Only include products with actual discounts
      if (!hasDiscount) continue

      let imageUrl: string | undefined
      if (product.links?.defaultImages?.[0]) {
        imageUrl = product.links.defaultImages[0]
      } else if (product.links?.images?.[0]?.href) {
        imageUrl = product.links.images[0].href
      }

      if (imageUrl && imageUrl.includes('im=Resize=')) {
        imageUrl = imageUrl.replace(/im=Resize=\d+/, 'im=Resize=400')
      } else if (imageUrl && !imageUrl.includes('im=Resize')) {
        imageUrl = `${imageUrl}?im=Resize=400`
      }

      const brand = product.brand?.name || undefined
      const categoryPath = product.productCategoriesHearchi || ''
      const categoryParts = categoryPath.split('/')
      const category = categoryParts[0]?.trim() || undefined

      const sizeMatch = name.match(/(\d+(?:\.\d+)?\s*(?:ml|l|kg|g|pcs?|pack|rolls?)\b)/i)
      const sizeText = sizeMatch ? sizeMatch[1] : undefined

      const baseTags = [
        'carrefour',
        'deals',
        category ? category.toLowerCase().replace(/\s+&\s+/g, '-') : undefined,
        product.type === 'NON_FOOD' ? 'non-food' : undefined,
      ].filter(Boolean).join(',')

      const arabicTags = getArabicTags(name)

      offers.push({
        nameAr: name,
        nameEn: name,
        brand,
        price: currentPrice,
        oldPrice,
        discountPercent,
        sizeText,
        imageUrl,
        sourceUrl: `${BASE_URL}${DEALS_PATH}`,
        tags: arabicTags ? `${baseTags},${arabicTags}` : baseTags,
      })
    } catch {
      // Skip malformed products
    }
  }

  return offers
}

// ─── Main ─────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const shouldIngest = args.includes('--ingest')
  const limitArg = args.find(a => a.startsWith('--limit='))
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : undefined

  const apiBase = process.env.API_BASE || 'https://sa.smartcopons.com'
  const appSecret = process.env.APP_SECRET || 'smartcopons-secret-2024-ksa'

  console.log('=== Carrefour KSA Local Scraper ===')
  console.log(`Mode: ${shouldIngest ? `INGEST${limit ? ` (limit: ${limit})` : ' (all)'}` : 'DRY RUN (add --ingest to send to API)'}`)
  console.log(`Target: ${apiBase}`)
  console.log()

  const allOffers: ScrapedOffer[] = []
  let page = 0
  let totalProducts = -1
  let hasMore = true

  while (hasMore && page < MAX_PAGES) {
    const url = `${BASE_URL}${DEALS_PATH}?currentPage=${page}&pageSize=${PAGE_SIZE}`
    console.log(`[Page ${page + 1}] Fetching: ${url}`)

    try {
      const response = await fetch(url, { headers: REQUIRED_HEADERS })
      const html = await response.text()

      if (html.length < 500) {
        console.error(`[Page ${page + 1}] BLOCKED by Akamai (${html.length} chars)`)
        break
      }

      console.log(`[Page ${page + 1}] HTML: ${html.length} chars`)

      const { products, total } = extractProductsFromRSC(html)

      if (page === 0 && total > 0) {
        totalProducts = total
        console.log(`[Info] Total deals available: ${totalProducts}`)
      }

      if (products.length === 0) {
        console.log(`[Page ${page + 1}] No products found -- stopping`)
        break
      }

      const pageOffers = mapProducts(products)
      allOffers.push(...pageOffers)
      console.log(`[Page ${page + 1}] ${products.length} raw -> ${pageOffers.length} with discounts (total: ${allOffers.length})`)

      const expectedTotal = totalProducts > 0 ? totalProducts : Infinity
      hasMore = allOffers.length < expectedTotal && products.length >= PAGE_SIZE
      page++

      if (hasMore) {
        console.log(`[Wait] 2s delay...`)
        await new Promise(r => setTimeout(r, 2000))
      }
    } catch (error) {
      console.error(`[Page ${page + 1}] Error:`, error instanceof Error ? error.message : error)
      break
    }
  }

  console.log()
  console.log(`=== Scrape Complete ===`)
  console.log(`Pages scraped: ${page}`)
  console.log(`Offers extracted: ${allOffers.length}`)

  if (allOffers.length === 0) {
    console.log('No offers to ingest.')
    process.exit(0)
  }

  // Show sample
  console.log()
  console.log('Sample offers:')
  for (const offer of allOffers.slice(0, 3)) {
    console.log(`  - ${offer.nameEn}: ${offer.price} SAR (was ${offer.oldPrice}, -${offer.discountPercent}%)`)
    console.log(`    Image: ${offer.imageUrl ? 'YES' : 'NO'} | Brand: ${offer.brand || 'N/A'}`)
  }

  if (!shouldIngest) {
    console.log()
    console.log('DRY RUN complete. Run with --ingest to send to API.')
    console.log(`  npx tsx scripts/scrape-carrefour-local.ts --ingest --limit=50`)
    process.exit(0)
  }

  // Apply limit
  let offersToSend = allOffers
  if (limit && limit > 0 && offersToSend.length > limit) {
    console.log(`\nLimiting to ${limit} of ${offersToSend.length} offers`)
    offersToSend = offersToSend.slice(0, limit)
  }

  // Send to API
  console.log(`\nSending ${offersToSend.length} offers to ${apiBase}/api/admin/scrape-submit...`)

  try {
    const response = await fetch(`${apiBase}/api/admin/scrape-submit?secret=${appSecret}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supermarketSlug: 'carrefour',
        offers: offersToSend,
        sourceUrl: `${BASE_URL}${DEALS_PATH}`,
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      console.error('API error:', result)
      process.exit(1)
    }

    console.log()
    console.log('=== Ingest Result ===')
    console.log(`Received: ${result.received}`)
    console.log(`Valid: ${result.valid}`)
    console.log(`New offers: ${result.newOffers}`)
    console.log(`Duplicates skipped: ${result.duplicatesSkipped}`)
    console.log(`Flyer ID: ${result.flyerId}`)
    console.log()
    console.log('Done!')
  } catch (error) {
    console.error('Failed to send to API:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

main().catch(console.error)
