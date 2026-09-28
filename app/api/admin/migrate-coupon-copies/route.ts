import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * Creates `coupon_copies`: how many times each code was copied, per day, per
 * surface.
 *
 * A daily aggregate rather than one row per copy. The questions it answers are
 * "which codes get used" and "which surface produces the copies" — neither needs
 * individual events, and an aggregate cannot hold anything personal: there is no
 * device id, no IP and no timestamp finer than the day.
 *
 * /api/coupons/copy tolerates this table being absent, so deploy order does not
 * matter; copies are simply not counted until this has run.
 *
 *   curl -X POST https://sa.smartcopons.com/api/admin/migrate-coupon-copies \
 *        -H "Authorization: Bearer $APP_SECRET"
 */
export const dynamic = 'force-dynamic'

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS coupon_copies (
     "couponId" TEXT NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
     day        DATE NOT NULL,
     surface    TEXT NOT NULL,
     copies     INTEGER NOT NULL DEFAULT 0,
     PRIMARY KEY ("couponId", day, surface)
   )`,
  `CREATE INDEX IF NOT EXISTS "coupon_copies_day_idx" ON coupon_copies (day)`,
]

export async function POST(request: Request) {
  const secret = process.env.APP_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const results: Array<{ sql: string; ok: boolean; error?: string }> = []
  for (const sql of STATEMENTS) {
    const label = sql.replace(/\s+/g, ' ').slice(0, 80)
    try {
      await prisma.$executeRawUnsafe(sql)
      results.push({ sql: label, ok: true })
    } catch (e: any) {
      results.push({ sql: label, ok: false, error: String(e?.message).slice(0, 180) })
    }
  }
  const [{ n }] = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT COALESCE(SUM(copies), 0)::bigint AS n FROM coupon_copies`
  )
  return NextResponse.json({
    statements: results,
    failed: results.filter(r => !r.ok).length,
    totalCopies: Number(n),
  })
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method Not Allowed. Use POST with an Authorization: Bearer header.' },
    { status: 405, headers: { Allow: 'POST' } }
  )
}
