import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * Set which markets coupon stores serve.
 *
 * Most coupon stores are GCC-wide — Noon, Namshi and Centrepoint trade in both
 * markets, and the global ones (AliExpress, iHerb) work anywhere — so the UAE
 * launch starts with every store on "SA,AE". Individual stores can be narrowed
 * afterwards by passing `slugs`.
 *
 * Deliberately a separate one-shot route rather than a line in
 * migrate-country: that route gets re-run whenever a column is added, and it
 * would silently undo any per-store pruning done later.
 *
 *   curl -X POST ".../api/admin/set-store-countries" \
 *     -H "Content-Type: application/json" \
 *     -d '{"key":"'"$APP_SECRET"'","countries":"SA,AE"}'
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(request: Request) {
  const body: any = await request.json().catch(() => ({}))
  const key = body?.key ?? new URL(request.url).searchParams.get('key')
  if (!process.env.APP_SECRET || key !== process.env.APP_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const countries = String(body?.countries || 'SA,AE')
    .split(',')
    .map((s: string) => s.trim().toUpperCase())
    .filter(Boolean)
    .join(',')

  const only: string[] | undefined = Array.isArray(body?.slugs) ? body.slugs : undefined
  const where = only?.length ? { slug: { in: only } } : {}

  const res = await prisma.store.updateMany({ where, data: { countries } })
  const sample = await prisma.store.findMany({
    select: { slug: true, countries: true },
    take: 5,
    orderBy: { name: 'asc' },
  })
  return NextResponse.json({
    updated: res.count,
    countries,
    scope: only?.length ? only : 'all stores',
    sample,
  })
}
