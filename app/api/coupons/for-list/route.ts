import { NextResponse } from 'next/server'
import { couponsForRetailers } from '@/lib/offer-queries'
import { countryFromRequest } from '@/lib/countries'

export const dynamic = 'force-dynamic'

/**
 * One owned coupon code for the retailers in a shopper's list.
 *
 * Called only when the shopping-list panel OPENS — not on page load — so it
 * costs nothing on the 99% of views that never open the panel. The underlying
 * query is cached, so even repeated opens are a single DB read per hour.
 *
 * POST rather than GET because the retailer slugs are request data, and a GET
 * would put a shopper's basket composition into URLs and access logs.
 *
 * Fails closed: any error returns an empty list, so the panel renders no coupon
 * rather than a broken one. A dead code with the owner's name on it is worse
 * than no code.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const raw = Array.isArray(body?.slugs) ? body.slugs : []

    // Bound and sanitise: slugs come from the client's localStorage.
    const slugs = Array.from(
      new Set(
        raw
          .filter((s: unknown): s is string => typeof s === 'string')
          .map((s: string) => s.trim().toLowerCase())
          .filter((s: string) => /^[a-z0-9-]{1,40}$/.test(s))
      )
    ).slice(0, 12) as string[]

    const coupons = await couponsForRetailers(slugs, countryFromRequest(request), 1)
    return NextResponse.json({ coupons })
  } catch (e) {
    console.error('coupons/for-list failed:', e)
    return NextResponse.json({ coupons: [] })
  }
}
