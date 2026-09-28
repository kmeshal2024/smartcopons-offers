import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * Stable products — phase 1 of 5: the tables. Nothing reads or writes them yet.
 *
 * WHY. A product page's URL is the id of a `product_offers` row, and ingest only
 * reuses a row while name + price + sourceUrl are unchanged (`sourceHash`). Any
 * price change therefore mints a new URL; the old one goes noindex when its
 * flyer ends and 404s once cleanup-expired removes it 30 days later. Search
 * Console (28 Sep 2026) showed the result: of the product URLs it had crawled
 * and not indexed, about four in five were simply expired offers. Every page
 * loses whatever ranking it earned each time its price moves.
 *
 * `products` holds ONE row per (store, product) that outlives any single offer,
 * and `product_prices` keeps the price history that currently disappears with
 * the offer rows.
 *
 * PHASES
 *   1. this route — tables and the nullable link column
 *   2. backfill `products` from existing offers, measure the match rate
 *   3. ingest links every new offer to its product
 *   4. the product page is served from the stable id
 *   5. old /product/{offerId} URLs 301 to it; sitemap switches over
 *
 * ORDERING RULE. `product_offers."productId"` must exist in the database BEFORE
 * it is added to schema.prisma: Prisma selects every column it knows about, so a
 * schema that names a missing column breaks every ProductOffer query on the
 * site. This route is that first step, and adding the column is instant — it is
 * nullable with no default, so Postgres rewrites nothing.
 *
 * Idempotent. Runs through the app's own connection because the database is
 * only reachable from the deployment.
 *
 *   curl -X POST https://sa.smartcopons.com/api/admin/migrate-products \
 *        -H "Authorization: Bearer $APP_SECRET"
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS products (
     id              TEXT PRIMARY KEY,
     "supermarketId" TEXT NOT NULL REFERENCES supermarkets(id) ON DELETE CASCADE,
     country         TEXT NOT NULL DEFAULT 'SA',
     -- Normalised name: what makes two offers "the same product". Built by the
     -- application (lib/services/category-rules.ts normalizeName), never by SQL,
     -- so there is exactly one definition of it.
     "nameKey"       TEXT NOT NULL,
     "nameAr"        TEXT,
     "nameEn"        TEXT,
     brand           TEXT,
     "sizeText"      TEXT,
     "imageUrl"      TEXT,
     "categoryId"    TEXT REFERENCES categories(id) ON DELETE SET NULL,
     -- Deliberately NOT a foreign key: offer rows are replaced and deleted on
     -- their own schedule, and a dangling id here is resolved at read time.
     "currentOfferId" TEXT,
     "lastPrice"     DOUBLE PRECISION,
     "lastOldPrice"  DOUBLE PRECISION,
     "firstSeenAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "lastSeenAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,

  // The identity of a product. Also the lookup ingest will do for every offer.
  `CREATE UNIQUE INDEX IF NOT EXISTS "products_supermarketId_nameKey_key"
     ON products ("supermarketId", "nameKey")`,

  // Sitemap and listings: a market's products, most recently seen first.
  `CREATE INDEX IF NOT EXISTS "products_country_lastSeenAt_idx"
     ON products (country, "lastSeenAt")`,

  `CREATE INDEX IF NOT EXISTS "products_categoryId_idx"
     ON products ("categoryId")`,

  // One price per product per day. The composite key makes a re-run of the same
  // day's scrape an upsert rather than a duplicate.
  `CREATE TABLE IF NOT EXISTS product_prices (
     "productId"       TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
     "observedOn"      DATE NOT NULL,
     price             DOUBLE PRECISION NOT NULL,
     "oldPrice"        DOUBLE PRECISION,
     "discountPercent" INTEGER,
     PRIMARY KEY ("productId", "observedOn")
   )`,

  // The link. Nullable, no default: instant, and every existing query keeps
  // working because nothing selects it until schema.prisma names it.
  `ALTER TABLE product_offers ADD COLUMN IF NOT EXISTS "productId" TEXT`,

  `CREATE INDEX IF NOT EXISTS "product_offers_productId_idx"
     ON product_offers ("productId")`,

  // SET NULL, not CASCADE: deleting a product must never delete live offers.
  `DO $$ BEGIN
     ALTER TABLE product_offers
       ADD CONSTRAINT "product_offers_productId_fkey"
       FOREIGN KEY ("productId") REFERENCES products(id) ON DELETE SET NULL;
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
]

async function run() {
  const results: Array<{ sql: string; ok: boolean; error?: string }> = []
  for (const sql of STATEMENTS) {
    const label = sql.replace(/--.*$/gm, '').replace(/\s+/g, ' ').trim().slice(0, 90)
    try {
      await prisma.$executeRawUnsafe(sql)
      results.push({ sql: label, ok: true })
    } catch (e: any) {
      results.push({ sql: label, ok: false, error: String(e?.message).slice(0, 180) })
    }
  }

  // Report what actually exists rather than what we asked for.
  const columns = await prisma.$queryRawUnsafe<Array<{ table_name: string; column_name: string }>>(
    `SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND ((table_name IN ('products', 'product_prices'))
          OR (table_name = 'product_offers' AND column_name = 'productId'))
      ORDER BY table_name, ordinal_position`
  )
  const count = async (sql: string) =>
    Number((await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(sql))[0].n)

  return {
    statements: results,
    failed: results.filter(r => !r.ok).length,
    columns: columns.reduce<Record<string, string[]>>((acc, c) => {
      ;(acc[c.table_name] ||= []).push(c.column_name)
      return acc
    }, {}),
    rows: {
      products: await count(`SELECT COUNT(*)::bigint AS n FROM products`),
      product_prices: await count(`SELECT COUNT(*)::bigint AS n FROM product_prices`),
      offers_linked: await count(
        `SELECT COUNT(*)::bigint AS n FROM product_offers WHERE "productId" IS NOT NULL`
      ),
    },
  }
}

export async function POST(request: Request) {
  const secret = process.env.APP_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json(await run())
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method Not Allowed. Use POST with an Authorization: Bearer header.' },
    { status: 405, headers: { Allow: 'POST' } }
  )
}
