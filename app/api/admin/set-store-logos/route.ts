import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { invalidateCoupons } from '@/lib/cache-invalidation'

/**
 * Point Store.logo at the self-hosted lettermarks in /public/store-logos.
 *
 * The sibling set-logos route covers Supermarket.logo (retailer pages); this
 * one covers the Store rows that back the coupon surfaces, which had no logo
 * until the WordPress coupon import. Files are ASCII-named lettermarks, so a
 * real brand logo can later replace a file in place without touching the DB.
 *
 *   curl -X POST .../api/admin/set-store-logos \
 *     -H "Authorization: Bearer $APP_SECRET" -H "Content-Type: application/json" \
 *     -d '{"logos":{"نمشي":"/store-logos/namshi.svg"}}'
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(request: Request) {
  const secret = process.env.APP_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const logos = body?.logos as Record<string, string> | undefined
  if (!logos || !Object.keys(logos).length) {
    return NextResponse.json({ error: 'Body must be {"logos":{"<store-slug>":"/store-logos/x.svg"}}' }, { status: 400 })
  }

  const updated: Record<string, string> = {}
  const missed: string[] = []
  for (const [slug, logo] of Object.entries(logos)) {
    const res = await prisma.store.updateMany({ where: { slug }, data: { logo } })
    if (res.count > 0) updated[slug] = logo
    else missed.push(slug)
  }

  invalidateCoupons()
  return NextResponse.json({ success: true, updatedCount: Object.keys(updated).length, missed })
}
