import { prisma } from '@/lib/db'
import { productId, productKey } from '@/lib/products'

/**
 * Keeps `products`, `product_prices` and `product_offers."productId"` in step
 * with the offers table.
 *
 * ONE implementation, two callers, on purpose:
 *   - the backfill (every offer, price points dated by when the offer was made)
 *   - the nightly ingest (one flyer's offers, price point dated today)
 * If they derived products separately they would eventually disagree, and one
 * product would end up with two pages.
 *
 * It reads the offers back from the database rather than taking the scraper's
 * rows, so it does not matter which code path created them — the bulk ingest,
 * the PDF flyer ingest or a manual admin entry.
 *
 * Raw SQL throughout: these tables are not in schema.prisma yet.
 */

export type SyncScope = { all: true } | { flyerId: string } | { offerId: string }

export interface SyncOptions {
  /** No writes; just report. */
  dry?: boolean
  /**
   * What date a price point carries.
   *   'created' — the day the offer row was created (backfilling history)
   *   'today'   — now: the scrape has just confirmed this price is current
   */
  observed?: 'created' | 'today'
  /** Include the diagnostic group listings (backfill dry run). */
  diagnostics?: boolean
}

interface OfferRow {
  id: string
  supermarketId: string
  categoryId: string | null
  country: string
  nameAr: string | null
  nameEn: string | null
  brand: string | null
  sizeText: string | null
  imageUrl: string | null
  price: number
  oldPrice: number | null
  discountPercent: number | null
  createdAt: Date
  productId: string | null
  flyerEnd: Date | null
}

interface Group {
  id: string
  key: string
  supermarketId: string
  offers: OfferRow[]
}

async function loadOffers(scope: SyncScope): Promise<OfferRow[]> {
  const out: OfferRow[] = []
  let cursor = ''
  const [filter, arg] =
    'flyerId' in scope
      ? [`AND o."flyerId" = $2`, scope.flyerId]
      : 'offerId' in scope
        ? [`AND o.id = $2`, scope.offerId]
        : ['', null]

  for (;;) {
    const page = await prisma.$queryRawUnsafe<OfferRow[]>(
      `SELECT o.id, o."supermarketId", o."categoryId", o.country, o."nameAr", o."nameEn",
              o.brand, o."sizeText", o."imageUrl", o.price, o."oldPrice",
              o."discountPercent", o."createdAt", o."productId", f."endDate" AS "flyerEnd"
         FROM product_offers o
         LEFT JOIN flyers f ON f.id = o."flyerId"
        WHERE o.price > 0 AND o.id > $1 ${filter}
        ORDER BY o.id ASC
        LIMIT 10000`,
      ...(arg === null ? [cursor] : [cursor, arg])
    )
    if (!page.length) break
    out.push(...page)
    cursor = page[page.length - 1].id
    if (page.length < 10000) break
  }
  return out
}

function groupOffers(offers: OfferRow[]) {
  const groups = new Map<string, Group>()
  let unkeyed = 0
  for (const o of offers) {
    const key = productKey(o)
    if (!key) { unkeyed++; continue }
    const id = productId(o.supermarketId, key)
    const g = groups.get(id)
    if (g) g.offers.push(o)
    else groups.set(id, { id, key, supermarketId: o.supermarketId, offers: [o] })
  }
  return { groups: Array.from(groups.values()), unkeyed }
}

const isoDay = (d: Date | string) => new Date(d).toISOString().slice(0, 10)
const newestFirst = (a: OfferRow, b: OfferRow) =>
  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()

export async function syncProducts(scope: SyncScope, options: SyncOptions = {}) {
  const { dry = false, observed = 'created', diagnostics = false } = options
  const offers = await loadOffers(scope)
  const { groups, unkeyed } = groupOffers(offers)
  const now = Date.now()
  const isLive = (g: Group) =>
    g.offers.some(o => o.flyerEnd && new Date(o.flyerEnd).getTime() >= now)

  const report: Record<string, any> = {
    dry,
    offers: offers.length,
    unkeyed,
    products: groups.length,
    written: { products: 0, prices: 0, offersLinked: 0 },
  }

  if (diagnostics) {
    report.productsWithSeveralOffers = groups.filter(g => g.offers.length > 1).length
    report.productsSeenAtSeveralPrices = groups.filter(
      g => new Set(g.offers.map(o => o.price)).size > 1
    ).length
    report.liveProducts = groups.filter(isLive).length
    // Live products with an earlier offer row: each is a product whose URL
    // changed at least once under the per-offer scheme.
    report.liveProductsWhoseUrlAlreadyChanged = groups.filter(
      g => g.offers.length > 1 && isLive(g)
    ).length
    report.largestGroups = [...groups]
      .sort((a, b) => b.offers.length - a.offers.length)
      .slice(0, 15)
      .map(g => ({
        key: g.key.slice(0, 70),
        offers: g.offers.length,
        prices: Array.from(new Set(g.offers.map(o => o.price))).slice(0, 8),
      }))
    // A too-loose key shows up as one group holding visibly different images.
    report.manyImages = groups
      .filter(g => new Set(g.offers.map(o => o.imageUrl).filter(Boolean)).size > 3)
      .sort((a, b) => b.offers.length - a.offers.length)
      .slice(0, 15)
      .map(g => ({
        key: g.key.slice(0, 70),
        offers: g.offers.length,
        images: new Set(g.offers.map(o => o.imageUrl).filter(Boolean)).size,
        names: Array.from(
          new Set(g.offers.map(o => (o.nameAr || o.nameEn || '').slice(0, 50)))
        ).slice(0, 4),
      }))
  }

  if (dry || !groups.length) return report

  // ---- products ------------------------------------------------------------
  const seenNow = new Date()
  const productRows = groups.map(g => {
    // The newest offer describes the product; the newest WITH an image supplies
    // the picture, since vision-extracted rows have none.
    const byNewest = [...g.offers].sort(newestFirst)
    const latest = byNewest[0]
    return [
      g.id,
      g.supermarketId,
      latest.country,
      g.key,
      latest.nameAr,
      latest.nameEn,
      latest.brand,
      latest.sizeText,
      byNewest.find(o => o.imageUrl)?.imageUrl ?? null,
      byNewest.find(o => o.categoryId)?.categoryId ?? null,
      latest.id,
      latest.price,
      latest.oldPrice,
      new Date(byNewest[byNewest.length - 1].createdAt),
      observed === 'today' ? seenNow : new Date(latest.createdAt),
    ]
  })

  const COLS = 15
  for (let i = 0; i < productRows.length; i += 1000) {
    const batch = productRows.slice(i, i + 1000)
    const values = batch
      .map((_, r) => `(${Array.from({ length: COLS }, (_, c) => `$${r * COLS + c + 1}`).join(',')})`)
      .join(',')
    report.written.products += await prisma.$executeRawUnsafe(
      `INSERT INTO products
         (id, "supermarketId", country, "nameKey", "nameAr", "nameEn", brand, "sizeText",
          "imageUrl", "categoryId", "currentOfferId", "lastPrice", "lastOldPrice",
          "firstSeenAt", "lastSeenAt")
       VALUES ${values}
       ON CONFLICT (id) DO UPDATE SET
         "nameAr" = EXCLUDED."nameAr", "nameEn" = EXCLUDED."nameEn",
         brand = EXCLUDED.brand, "sizeText" = EXCLUDED."sizeText",
         "imageUrl" = COALESCE(EXCLUDED."imageUrl", products."imageUrl"),
         "categoryId" = COALESCE(EXCLUDED."categoryId", products."categoryId"),
         "currentOfferId" = EXCLUDED."currentOfferId",
         "lastPrice" = EXCLUDED."lastPrice", "lastOldPrice" = EXCLUDED."lastOldPrice",
         "firstSeenAt" = LEAST(products."firstSeenAt", EXCLUDED."firstSeenAt"),
         "lastSeenAt" = GREATEST(products."lastSeenAt", EXCLUDED."lastSeenAt"),
         "updatedAt" = CURRENT_TIMESTAMP`,
      ...batch.flat()
    )
  }

  // ---- price history -------------------------------------------------------
  // One point per product per day: the lowest price seen that day.
  const today = isoDay(seenNow)
  const priceRows: any[][] = []
  for (const g of groups) {
    const perDay = new Map<string, OfferRow>()
    for (const o of g.offers) {
      const d = observed === 'today' ? today : isoDay(o.createdAt)
      const prev = perDay.get(d)
      if (!prev || o.price < prev.price) perDay.set(d, o)
    }
    for (const [d, o] of Array.from(perDay.entries())) {
      priceRows.push([g.id, d, o.price, o.oldPrice, o.discountPercent])
    }
  }
  for (let i = 0; i < priceRows.length; i += 2000) {
    const batch = priceRows.slice(i, i + 2000)
    const values = batch
      .map((_, r) => `($${r * 5 + 1}, $${r * 5 + 2}::date, $${r * 5 + 3}, $${r * 5 + 4}, $${r * 5 + 5})`)
      .join(',')
    report.written.prices += await prisma.$executeRawUnsafe(
      `INSERT INTO product_prices ("productId", "observedOn", price, "oldPrice", "discountPercent")
       VALUES ${values}
       ON CONFLICT ("productId", "observedOn") DO UPDATE SET
         price = LEAST(product_prices.price, EXCLUDED.price)`,
      ...batch.flat()
    )
  }

  // ---- link offers ---------------------------------------------------------
  const links: string[][] = []
  for (const g of groups) for (const o of g.offers) if (o.productId !== g.id) links.push([o.id, g.id])
  for (let i = 0; i < links.length; i += 5000) {
    const batch = links.slice(i, i + 5000)
    const values = batch.map((_, r) => `($${r * 2 + 1}, $${r * 2 + 2})`).join(',')
    report.written.offersLinked += await prisma.$executeRawUnsafe(
      `UPDATE product_offers o SET "productId" = v.pid
         FROM (VALUES ${values}) AS v(oid, pid)
        WHERE o.id = v.oid`,
      ...batch.flat()
    )
  }

  return report
}

/**
 * For call sites where product bookkeeping must never fail the real work — a
 * scrape that imported 3,000 offers is a success even if this step throws.
 */
export async function syncProductsSafely(scope: SyncScope, logs?: string[]) {
  try {
    const r = await syncProducts(scope, { observed: 'today' })
    logs?.push(
      `[products] ${r.products} products from ${r.offers} offers; ` +
        `${r.written.offersLinked} newly linked, ${r.written.prices} price points`
    )
    return r
  } catch (e: any) {
    const msg = String(e?.message || e).slice(0, 200)
    console.error('[products] sync failed:', msg)
    logs?.push(`[products] sync FAILED (offers are unaffected): ${msg}`)
    return null
  }
}
