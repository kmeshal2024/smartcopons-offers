import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

/**
 * Which codes get copied, and from where.
 *
 * Two ways in, because it has two readers: the admin page (session cookie) and a
 * terminal (APP_SECRET), same as banner-stats.
 *
 *   curl https://sa.smartcopons.com/api/admin/coupon-stats \
 *        -H "Authorization: Bearer $APP_SECRET"
 *
 * Every active code is listed, including those with zero copies — a code nobody
 * has copied in 30 days is the more useful half of this report.
 */
export const dynamic = 'force-dynamic'

interface Row {
  couponId: string
  surface: string
  d1: bigint
  d7: bigint
  d30: bigint
  total: bigint
  lastDay: Date | null
}

export async function GET(request: Request) {
  const secret = process.env.APP_SECRET
  const bearer = !!secret && request.headers.get('authorization') === `Bearer ${secret}`
  if (!bearer) {
    const session = await getSession().catch(() => null)
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const today = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10)

  let rows: Row[] = []
  let tableMissing = false
  try {
    rows = await prisma.$queryRawUnsafe<Row[]>(
      `SELECT "couponId", surface,
              SUM(copies) FILTER (WHERE day = $1::date)::bigint            AS d1,
              SUM(copies) FILTER (WHERE day > $1::date - 7)::bigint        AS d7,
              SUM(copies) FILTER (WHERE day > $1::date - 30)::bigint       AS d30,
              SUM(copies)::bigint                                          AS total,
              MAX(day)                                                     AS "lastDay"
         FROM coupon_copies
        GROUP BY "couponId", surface`,
      today
    )
  } catch {
    tableMissing = true
  }

  const coupons = await prisma.coupon.findMany({
    where: { isActive: true },
    select: {
      id: true,
      code: true,
      discountText: true,
      affiliateUrl: true,
      isExclusive: true,
      store: { select: { name: true, slug: true } },
    },
  })

  const n = (v: bigint | null | undefined) => Number(v ?? 0)
  const byCoupon = new Map<string, Row[]>()
  for (const r of rows) {
    const list = byCoupon.get(r.couponId) || []
    list.push(r)
    byCoupon.set(r.couponId, list)
  }

  const list = coupons
    .map(c => {
      const rs = byCoupon.get(c.id) || []
      const surfaces: Record<string, number> = {}
      for (const r of rs) surfaces[r.surface] = n(r.d30)
      const last = rs.map(r => r.lastDay).filter(Boolean).sort().pop() as Date | undefined
      return {
        id: c.id,
        code: c.code,
        store: c.store.name,
        storeSlug: c.store.slug,
        discountText: c.discountText,
        hasAffiliateUrl: !!c.affiliateUrl,
        isExclusive: c.isExclusive,
        today: rs.reduce((s, r) => s + n(r.d1), 0),
        last7: rs.reduce((s, r) => s + n(r.d7), 0),
        last30: rs.reduce((s, r) => s + n(r.d30), 0),
        total: rs.reduce((s, r) => s + n(r.total), 0),
        lastCopied: last ? new Date(last).toISOString().slice(0, 10) : null,
        surfaces30: surfaces,
      }
    })
    .sort((a, b) => b.last30 - a.last30 || b.total - a.total || a.store.localeCompare(b.store))

  const bySurface: Record<string, number> = {}
  for (const r of rows) bySurface[r.surface] = (bySurface[r.surface] || 0) + n(r.d30)

  return NextResponse.json({
    today,
    tableMissing,
    totals: {
      activeCodes: list.length,
      codesCopiedLast30: list.filter(c => c.last30 > 0).length,
      today: list.reduce((s, c) => s + c.today, 0),
      last7: list.reduce((s, c) => s + c.last7, 0),
      last30: list.reduce((s, c) => s + c.last30, 0),
      total: list.reduce((s, c) => s + c.total, 0),
    },
    bySurface30: bySurface,
    coupons: list,
  })
}
