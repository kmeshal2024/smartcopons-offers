import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { invalidateAmazon } from '@/lib/cache-invalidation'

/**
 * The discount refresh, separate from the full import so a refresh can never
 * touch titles, images, categories or isActive.
 *
 *   GET  → { asins: [...] }  the active ASINs to re-check
 *   POST { discounts: [{ asin, percent }] }
 *        percent >= 5  → stored and stamped as checked now
 *        percent <  5  → cleared (checked, and there is no discount right now)
 *        ASIN absent   → untouched, so its old discount simply ages out
 *                        (liveDiscount hides it 48h after the last check)
 *
 * Fed by scripts/amazon-discount-refresh.js, run in Chrome on amazon.sa every
 * two days. Two ways in, like the import: APP_SECRET or the admin session.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function authorized(request: Request): Promise<boolean> {
  const secret = process.env.APP_SECRET
  if (secret && request.headers.get('authorization') === `Bearer ${secret}`) return true
  const session = await getSession().catch(() => null)
  return !!session && session.role === 'ADMIN'
}

export async function GET(request: Request) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const rows = await prisma.amazonProduct.findMany({
    where: { isActive: true },
    select: { asin: true },
    orderBy: { priority: 'desc' },
  })
  return NextResponse.json({ asins: rows.map(r => r.asin) })
}

export async function POST(request: Request) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body: any = await request.json().catch(() => null)
  const list: unknown[] = Array.isArray(body?.discounts) ? body.discounts.slice(0, 500) : []
  if (list.length === 0) {
    return NextResponse.json({ error: 'Expected { discounts: [{ asin, percent }] }' }, { status: 400 })
  }

  const now = new Date()
  let set = 0
  let cleared = 0
  const unknown: string[] = []
  for (const raw of list) {
    const asin = typeof (raw as any)?.asin === 'string' ? (raw as any).asin.toUpperCase() : ''
    const percent = Math.round(Number((raw as any)?.percent))
    if (!/^[A-Z0-9]{10}$/.test(asin) || !Number.isFinite(percent)) continue
    const has = percent >= 5 && percent <= 95
    const res = await prisma.amazonProduct.updateMany({
      where: { asin },
      data: { discountPercent: has ? percent : null, discountCheckedAt: has ? now : null },
    })
    if (res.count === 0) unknown.push(asin)
    else if (has) set++
    else cleared++
  }

  invalidateAmazon()
  return NextResponse.json({ set, cleared, unknown, checkedAt: now.toISOString() })
}
