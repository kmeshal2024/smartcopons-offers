import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * Adds the country columns ahead of the UAE launch.
 *
 * Runs through the app's own Prisma connection because the database is only
 * reachable from the deployment, and is guarded by APP_SECRET — the same
 * approach as migrate-shopper and migrate-push.
 *
 * Every statement is IF NOT EXISTS and every column has a DEFAULT, so existing
 * rows become 'SA' automatically and the route is safe to re-run.
 *
 *   curl -X POST "https://sa.smartcopons.com/api/admin/migrate-country" \
 *     -H "Content-Type: application/json" -d '{"key":"'"$APP_SECRET"'"}'
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const STATEMENTS = [
  `ALTER TABLE supermarkets   ADD COLUMN IF NOT EXISTS "country"   TEXT NOT NULL DEFAULT 'SA'`,
  `ALTER TABLE product_offers ADD COLUMN IF NOT EXISTS "country"   TEXT NOT NULL DEFAULT 'SA'`,
  `ALTER TABLE stores         ADD COLUMN IF NOT EXISTS "countries" TEXT NOT NULL DEFAULT 'SA'`,
  `ALTER TABLE price_watches  ADD COLUMN IF NOT EXISTS "country"   TEXT NOT NULL DEFAULT 'SA'`,

  `CREATE INDEX IF NOT EXISTS "supermarkets_country_isActive_idx"
     ON supermarkets ("country", "isActive")`,
  // Mirrors the two sorts the offers page actually uses.
  `CREATE INDEX IF NOT EXISTS "product_offers_country_isHidden_createdAt_idx"
     ON product_offers ("country", "isHidden", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "product_offers_country_isHidden_discountPercent_idx"
     ON product_offers ("country", "isHidden", "discountPercent")`,

  // Belt and braces: DEFAULT only covers rows inserted after the ALTER, so make
  // sure nothing pre-existing was left NULL by an earlier partial run.
  `UPDATE supermarkets   SET "country"   = 'SA' WHERE "country"   IS NULL OR "country"   = ''`,
  `UPDATE product_offers SET "country"   = 'SA' WHERE "country"   IS NULL OR "country"   = ''`,
  `UPDATE stores         SET "countries" = 'SA' WHERE "countries" IS NULL OR "countries" = ''`,
  `UPDATE price_watches  SET "country"   = 'SA' WHERE "country"   IS NULL OR "country"   = ''`,
]

async function run() {
  const results: Array<{ sql: string; ok: boolean; error?: string }> = []
  for (const sql of STATEMENTS) {
    try {
      await prisma.$executeRawUnsafe(sql)
      results.push({ sql: sql.replace(/\s+/g, ' ').slice(0, 80), ok: true })
    } catch (e: any) {
      results.push({ sql: sql.replace(/\s+/g, ' ').slice(0, 80), ok: false, error: String(e?.message).slice(0, 160) })
    }
  }

  const counts = await prisma.$queryRawUnsafe<Array<{ country: string; n: bigint }>>(
    `SELECT "country", COUNT(*)::bigint AS n FROM product_offers GROUP BY "country" ORDER BY n DESC`
  )
  return {
    statements: results,
    failed: results.filter(r => !r.ok).length,
    offersByCountry: counts.map(c => ({ country: c.country, offers: Number(c.n) })),
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const key = body?.key ?? new URL(request.url).searchParams.get('key')
  if (!process.env.APP_SECRET || key !== process.env.APP_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json(await run())
}
