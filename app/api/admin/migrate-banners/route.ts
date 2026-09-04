import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * Creates the `banners` table for the self-managed ad system.
 *
 * Follows the house migration pattern (see migrate-coupon-fields): an
 * idempotent raw-SQL route behind APP_SECRET, run once after deploy. The
 * serving path (lib/banners.ts) swallows query errors and renders nothing, so
 * the window between this code going live and this route being run shows no
 * banners rather than a broken page.
 *
 * The two CHECKs mirror the coupon lessons: targetUrl must be a real http URL
 * (the legacy coupons all carried '#' and the click funnel silently never
 * worked), and placement is constrained to the set the UI actually renders so
 * a typo in the admin form cannot create an invisible banner.
 *
 *   curl -X POST https://sa.smartcopons.com/api/admin/migrate-banners \
 *        -H "Authorization: Bearer $APP_SECRET"
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS banners (
     id            TEXT PRIMARY KEY,
     title         TEXT NOT NULL,
     "imageUrl"    TEXT NOT NULL,
     "targetUrl"   TEXT NOT NULL,
     placement     TEXT NOT NULL,
     country       TEXT NOT NULL DEFAULT 'SA',
     "isActive"    BOOLEAN NOT NULL DEFAULT true,
     "startsAt"    TIMESTAMP(3),
     "endsAt"      TIMESTAMP(3),
     priority      INTEGER NOT NULL DEFAULT 0,
     width         INTEGER,
     height        INTEGER,
     impressions   INTEGER NOT NULL DEFAULT 0,
     clicks        INTEGER NOT NULL DEFAULT 0,
     "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,

  `CREATE INDEX IF NOT EXISTS "banners_placement_country_isActive_idx"
     ON banners (placement, country, "isActive")`,

  `DO $$ BEGIN
     ALTER TABLE banners
       ADD CONSTRAINT "banners_targetUrl_check"
       CHECK ("targetUrl" LIKE 'http%');
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  // Re-created (not IF NOT EXISTS) so re-running after the list grows updates
  // the constraint — this is why the route stays the single source of the enum.
  `ALTER TABLE banners DROP CONSTRAINT IF EXISTS "banners_placement_check"`,

  `ALTER TABLE banners
     ADD CONSTRAINT "banners_placement_check"
     CHECK (placement IN ('home_top', 'home_middle', 'offers', 'coupons', 'flyers', 'product', 'stores'))`,
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

  const count = await prisma.banner.count().catch(() => -1)

  return {
    statements: results,
    failed: results.filter(r => !r.ok).length,
    banners: count,
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
