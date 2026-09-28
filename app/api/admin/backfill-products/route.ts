import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { productId, productKey } from '@/lib/products'

/**
 * Stable products — phase 2 of 5: fill `products` and `product_prices` from the
 * offers already in the database, and link each offer to its product.
 *
 * Writes only to the two new tables and to `product_offers."productId"`, none of
 * which anything reads yet, so this is invisible to the site.
 *
 *   Measure:  POST {"dry": true}        — no writes; reports the match rate
 *   Apply:    POST {}                   — idempotent, safe to re-run
 *
 * The dry run exists because the identity rule (lib/products.ts) is a guess
 * until it has met the real catalogue. It reports how many offers collapse into
 * how many products, how many products have already been seen at more than one
 * price (each of those is a URL that the old scheme broke), and the largest
 * groups, which is where a too-loose key shows up as unrelated items merged.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 300

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

async function loadOffers(): Promise<OfferRow[]> {
  const out: OfferRow[] = []
  let cursor: string | undefined
  for (;;) {
    // Raw, because `productId` is not in schema.prisma's ProductOffer until the
    // model is updated — and because one lean query per 10k rows is what keeps
    // a 106k-row scan inside the time limit.
    const page = await prisma.$queryRawUnsafe<OfferRow[]>(
      `SELECT o.id, o."supermarketId", o."categoryId", o.country, o."nameAr", o."nameEn",
              o.brand, o."sizeText", o."imageUrl", o.price, o."oldPrice",
              o."discountPercent", o."createdAt", o."productId", f."endDate" AS "flyerEnd"
         FROM product_offers o
         LEFT JOIN flyers f ON f.id = o."flyerId"
        WHERE o.price > 0 ${cursor ? `AND o.id > $1` : ''}
        ORDER BY o.id ASC
        LIMIT 10000`,
      ...(cursor ? [cursor] : [])
    )
    if (!page.length) break
    out.push(...page)
    cursor = page[page.length - 1].id
    if (page.length < 10000) break
  }
  return out
}

function group(offers: OfferRow[]): { groups: Map<string, Group>; unkeyed: number } {
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
  return { groups, unkeyed }
}

const day = (d: Date) => new Date(d).toISOString().slice(0, 10)

async function run(dry: boolean) {
  const offers = await loadOffers()
  const { groups, unkeyed } = group(offers)
  const now = Date.now()

  const all = Array.from(groups.values())
  const multiOffer = all.filter(g => g.offers.length > 1)
  const multiPrice = all.filter(g => new Set(g.offers.map(o => o.price)).size > 1)
  // Products that are on offer right now AND have an earlier offer row: under
  // the old scheme each of these is a product whose URL changed at least once.
  const liveWithHistory = all.filter(
    g =>
      g.offers.length > 1 &&
      g.offers.some(o => o.flyerEnd && new Date(o.flyerEnd).getTime() >= now)
  )
  // A loose key shows up as one group holding visibly different images.
  const suspicious = all
    .filter(g => new Set(g.offers.map(o => o.imageUrl).filter(Boolean)).size > 3)
    .sort((a, b) => b.offers.length - a.offers.length)

  const report = {
    dry,
    offers: offers.length,
    unkeyed,
    products: all.length,
    productsWithSeveralOffers: multiOffer.length,
    productsSeenAtSeveralPrices: multiPrice.length,
    liveProductsWhoseUrlAlreadyChanged: liveWithHistory.length,
    liveProducts: all.filter(g =>
      g.offers.some(o => o.flyerEnd && new Date(o.flyerEnd).getTime() >= now)
    ).length,
    largestGroups: all
      .sort((a, b) => b.offers.length - a.offers.length)
      .slice(0, 15)
      .map(g => ({
        key: g.key.slice(0, 70),
        offers: g.offers.length,
        prices: Array.from(new Set(g.offers.map(o => o.price))).slice(0, 8),
      })),
    manyImages: suspicious.slice(0, 15).map(g => ({
      key: g.key.slice(0, 70),
      offers: g.offers.length,
      images: new Set(g.offers.map(o => o.imageUrl).filter(Boolean)).size,
      names: Array.from(new Set(g.offers.map(o => (o.nameAr || o.nameEn || '').slice(0, 50)))).slice(0, 4),
    })),
    written: { products: 0, prices: 0, offersLinked: 0 },
  }
  if (dry) return report

  // ---- products ------------------------------------------------------------
  const productRows = all.map(g => {
    // The newest offer describes the product; the newest with an image supplies
    // the picture, since vision-extracted rows have none.
    const byNewest = [...g.offers].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    const latest = byNewest[0]
    const withImage = byNewest.find(o => o.imageUrl)
    const withCategory = byNewest.find(o => o.categoryId)
    return [
      g.id,
      g.supermarketId,
      latest.country,
      g.key,
      latest.nameAr,
      latest.nameEn,
      latest.brand,
      latest.sizeText,
      withImage?.imageUrl ?? null,
      withCategory?.categoryId ?? null,
      latest.id,
      latest.price,
      latest.oldPrice,
      new Date(byNewest[byNewest.length - 1].createdAt),
      new Date(latest.createdAt),
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
         "categoryId" = EXCLUDED."categoryId",
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
  const priceRows: any[][] = []
  for (const g of all) {
    const perDay = new Map<string, OfferRow>()
    for (const o of g.offers) {
      const d = day(o.createdAt)
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
  for (const g of all) for (const o of g.offers) if (o.productId !== g.id) links.push([o.id, g.id])
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

export async function POST(request: Request) {
  const secret = process.env.APP_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body: any = await request.json().catch(() => ({}))
  try {
    return NextResponse.json(await run(body?.dry === true))
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message).slice(0, 400) }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method Not Allowed. Use POST with an Authorization: Bearer header.' },
    { status: 405, headers: { Allow: 'POST' } }
  )
}
