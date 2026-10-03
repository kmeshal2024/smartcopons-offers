import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * Creates the `amazon_products` table for the hand-picked Amazon.sa products.
 *
 * House migration pattern (see migrate-banners): idempotent raw SQL behind
 * APP_SECRET, run once after deploy. lib/amazon.ts swallows query errors, so
 * until this runs /amazon renders its empty state rather than failing.
 *
 * The ASIN CHECK matters because the affiliate link is built from it: a
 * malformed ASIN would be a link to an Amazon 404 carrying our tag.
 *
 *   curl -X POST https://sa.smartcopons.com/api/admin/migrate-amazon-products \
 *        -H "Authorization: Bearer $APP_SECRET"
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS amazon_products (
     id            TEXT PRIMARY KEY,
     asin          TEXT NOT NULL,
     title         TEXT NOT NULL,
     note          TEXT,
     "imageUrl"    TEXT,
     category      TEXT NOT NULL,
     "isActive"    BOOLEAN NOT NULL DEFAULT true,
     priority      INTEGER NOT NULL DEFAULT 0,
     clicks        INTEGER NOT NULL DEFAULT 0,
     "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,

  `CREATE UNIQUE INDEX IF NOT EXISTS "amazon_products_asin_key" ON amazon_products (asin)`,

  `CREATE INDEX IF NOT EXISTS "amazon_products_isActive_category_idx"
     ON amazon_products ("isActive", category)`,

  `DO $$ BEGIN
     ALTER TABLE amazon_products
       ADD CONSTRAINT "amazon_products_asin_check"
       CHECK (asin ~ '^[A-Z0-9]{10}$');
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  // Discount instead of price (2026-10-03).
  `ALTER TABLE amazon_products ADD COLUMN IF NOT EXISTS "discountPercent"   INTEGER`,
  `ALTER TABLE amazon_products ADD COLUMN IF NOT EXISTS "discountCheckedAt" TIMESTAMP(3)`,

  `DO $$ BEGIN
     ALTER TABLE amazon_products
       ADD CONSTRAINT "amazon_products_discount_check"
       CHECK ("discountPercent" IS NULL OR "discountPercent" BETWEEN 1 AND 95);
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
]

async function run() {
  const results: Array<{ sql: string; ok: boolean; error?: string }> = []
  for (const sql of STATEMENTS) {
    try {
      await prisma.$executeRawUnsafe(sql)
      results.push({ sql: sql.replace(/\s+/g, ' ').slice(0, 88), ok: true })
    } catch (e: any) {
      results.push({
        sql: sql.replace(/\s+/g, ' ').slice(0, 88),
        ok: false,
        error: String(e?.message).slice(0, 180),
      })
    }
  }

  const count = await prisma.amazonProduct.count().catch(() => -1)

  return {
    statements: results,
    failed: results.filter(r => !r.ok).length,
    amazonProducts: count,
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
