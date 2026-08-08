import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * One-off: add the trigram indexes that make product search fast.
 *
 * Search runs `col ILIKE '%term%'` across nameAr/nameEn/brand. Without an index
 * that is a full scan of ~30k rows per pattern, and the Arabic-variant filter
 * issues several patterns at once — measured at 1.5–4s per query. A GIN
 * pg_trgm index turns each ILIKE into an index lookup (sub-100ms).
 *
 * Runs through the app's own Prisma connection because the database is only
 * reachable from the deployment. Guarded by APP_SECRET. Idempotent — every
 * statement is IF NOT EXISTS, so it is safe to re-run.
 *
 *   curl -X POST "https://sa.smartcopons.com/api/admin/optimize-search" \
 *     -H "Content-Type: application/json" -d '{"key":"$APP_SECRET"}'
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const STATEMENTS = [
  'CREATE EXTENSION IF NOT EXISTS pg_trgm',
  'CREATE INDEX IF NOT EXISTS idx_offer_namear_trgm ON product_offers USING gin ("nameAr" gin_trgm_ops)',
  'CREATE INDEX IF NOT EXISTS idx_offer_nameen_trgm ON product_offers USING gin ("nameEn" gin_trgm_ops)',
  'CREATE INDEX IF NOT EXISTS idx_offer_brand_trgm ON product_offers USING gin ("brand" gin_trgm_ops)',
  // Coupons are far fewer, but the same ILIKE runs across these columns too.
  'CREATE INDEX IF NOT EXISTS idx_coupon_title_trgm ON coupons USING gin ("title" gin_trgm_ops)',
  'CREATE INDEX IF NOT EXISTS idx_coupon_code_trgm ON coupons USING gin ("code" gin_trgm_ops)',
  'CREATE INDEX IF NOT EXISTS idx_coupon_discounttext_trgm ON coupons USING gin ("discountText" gin_trgm_ops)',
  'CREATE INDEX IF NOT EXISTS idx_store_name_trgm ON stores USING gin ("name" gin_trgm_ops)',
]

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const { key } = body as { key?: string }

  const appSecret = process.env.APP_SECRET
  if (!appSecret || key !== appSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: { stmt: string; ms: number; ok: boolean; error?: string }[] = []
  for (const stmt of STATEMENTS) {
    const t0 = Date.now()
    try {
      await prisma.$executeRawUnsafe(stmt)
      results.push({ stmt: stmt.slice(0, 60), ms: Date.now() - t0, ok: true })
    } catch (e) {
      results.push({
        stmt: stmt.slice(0, 60),
        ms: Date.now() - t0,
        ok: false,
        error: e instanceof Error ? e.message.slice(0, 160) : String(e),
      })
    }
  }

  // Refresh planner stats so it actually considers the new indexes.
  for (const t of ['product_offers', 'coupons']) {
    try {
      await prisma.$executeRawUnsafe(`ANALYZE ${t}`)
    } catch {}
  }

  // Diagnostic: show the plan for a representative search so we can see whether
  // the trigram index is used. `explain` in the body opts in.
  let plan: unknown = null
  if ((body as any).explain) {
    try {
      const term = String((body as any).term || 'شامبو')
      plan = await prisma.$queryRawUnsafe(
        `EXPLAIN ANALYZE
         SELECT id FROM product_offers
         WHERE "isHidden" = false AND price > 0
           AND ("nameAr" ILIKE $1 OR "nameEn" ILIKE $1 OR "brand" ILIKE $1)
         ORDER BY "viewCount" DESC LIMIT 10`,
        `%${term}%`
      )
    } catch (e) {
      plan = e instanceof Error ? e.message.slice(0, 300) : String(e)
    }
  }

  return NextResponse.json({ success: results.every(r => r.ok), results, plan })
}
