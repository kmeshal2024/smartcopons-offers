import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { findStaleRetailers, getLastScrapeAt } from '@/lib/offer-queries'
import { DEFAULT_COUNTRY } from '@/lib/countries'

export const dynamic = 'force-dynamic'

/**
 * Diagnostics. Public, but reports no secret values — only whether they are set.
 *
 * `staleRetailers` is the alert that replaces using the sitemap gate to surface
 * broken scrapers (see lib/offer-queries.ts). Al Othaim should appear here: an
 * ACTIVE PDF flyer, a nightly cron reporting success, and zero live offers.
 */
export async function GET() {
  const startedAt = Date.now()

  const checks: Record<string, unknown> = {
    server: 'ok',
    node_version: process.version,
    env_NODE_ENV: process.env.NODE_ENV || 'not set',
    env_DATABASE_URL: process.env.DATABASE_URL ? 'set' : 'MISSING',
    env_APP_SECRET: process.env.APP_SECRET ? 'set' : 'MISSING',
    env_NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'not set',
    timestamp: new Date().toISOString(),
  }

  try {
    await prisma.$queryRaw`SELECT 1 as test`
    const latencyMs = Date.now() - startedAt

    const [users, supermarkets, categories, products, coupons] = await Promise.all([
      prisma.user.count(),
      prisma.supermarket.count(),
      prisma.category.count(),
      prisma.productOffer.count(),
      prisma.coupon.count(),
    ])

    const [staleRetailers, lastScrapeAt] = await Promise.all([
      findStaleRetailers(DEFAULT_COUNTRY),
      getLastScrapeAt(),
    ])

    checks.db = 'up'
    checks.latencyMs = latencyMs
    checks.lastScrapeAt = lastScrapeAt
    checks.staleRetailers = staleRetailers
    checks.staleRetailerCount = staleRetailers.length
    checks.counts = { users, supermarkets, categories, products, coupons }

    return NextResponse.json(checks, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err: any) {
    checks.db = 'down'
    checks.latencyMs = Date.now() - startedAt
    checks.lastScrapeAt = null
    checks.staleRetailers = []
    checks.error = err?.message ?? String(err)

    // 503 so an uptime monitor can actually alert on this. The previous version
    // returned 200 with the error in the body, which reads as healthy.
    return NextResponse.json(checks, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    })
  }
}
