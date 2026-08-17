import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * Adds the columns the contextual coupon surfaces need.
 *
 * Approved as reviewed. The surfaces (shopping-list panel, retailer strip, the
 * WhatsApp share line) are a REVENUE surface for owned codes, not a catalogue —
 * five codes shown at the right moment beat 106 on a standalone page, which the
 * baseline settled: /coupons produced 8,743 impressions and 4 clicks in three
 * months.
 *
 * `supermarketId` is here because `Coupon.storeId` points at `stores`
 * (Namshi/Noon), NOT at `supermarkets` (Panda/Carrefour). Without it there is
 * nothing to join on, and the retailer strip cannot be built at all.
 *
 * `validUntil` is NULLABLE on purpose. An owned code may genuinely be evergreen,
 * and a NOT NULL default would force a fake expiry — the opposite of the
 * guarantee wanted here, which is that a dead code with your name on it never
 * renders.
 *
 * Idempotent: every ALTER is IF NOT EXISTS, every constraint is wrapped so a
 * re-run is a no-op. No indexes — the table has 106 rows and Postgres will
 * seq-scan it regardless, so an index would be pure write overhead.
 *
 *   curl -X POST https://sa.smartcopons.com/api/admin/migrate-coupon-fields \
 *        -H "Authorization: Bearer $APP_SECRET"
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const STATEMENTS = [
  `ALTER TABLE coupons ADD COLUMN IF NOT EXISTS "validUntil"    TIMESTAMP(3)`,
  `ALTER TABLE coupons ADD COLUMN IF NOT EXISTS "affiliateUrl"  TEXT`,
  `ALTER TABLE coupons ADD COLUMN IF NOT EXISTS "isExclusive"   BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE coupons ADD COLUMN IF NOT EXISTS "supermarketId" TEXT`,

  `DO $$ BEGIN
     ALTER TABLE coupons
       ADD CONSTRAINT "coupons_supermarketId_fkey"
       FOREIGN KEY ("supermarketId") REFERENCES supermarkets(id) ON DELETE SET NULL;
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  // Makes the failure that killed the previous version structurally impossible:
  // all 106 existing rows carry url = '#', so the click-through half of the
  // funnel never worked. A real URL or NULL — nothing in between.
  `DO $$ BEGIN
     ALTER TABLE coupons
       ADD CONSTRAINT "coupons_affiliateUrl_check"
       CHECK ("affiliateUrl" IS NULL OR "affiliateUrl" LIKE 'http%');
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

  // Readiness snapshot: how many coupons could actually render today. The
  // surfaces gate on affiliateUrl being present and validUntil not past, so this
  // is the number that matters, not the row count.
  const [stats] = await prisma.$queryRawUnsafe<Array<Record<string, bigint>>>(
    `SELECT COUNT(*)::bigint                                              AS total,
            COUNT("affiliateUrl")::bigint                                 AS with_affiliate,
            COUNT("validUntil")::bigint                                   AS with_expiry,
            COUNT("supermarketId")::bigint                                AS linked_to_retailer,
            COUNT(*) FILTER (WHERE "isActive"
                             AND "affiliateUrl" IS NOT NULL
                             AND ("validUntil" IS NULL OR "validUntil" > now()))::bigint AS renderable
       FROM coupons`
  )

  return {
    statements: results,
    failed: results.filter(r => !r.ok).length,
    coupons: Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, Number(v)])),
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
