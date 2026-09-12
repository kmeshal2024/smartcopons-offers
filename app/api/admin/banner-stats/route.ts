import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * Read-only banner performance snapshot, APP_SECRET-gated like the other
 * admin utility routes — so CTR can be checked from a terminal without an
 * admin session.
 *
 *   curl https://sa.smartcopons.com/api/admin/banner-stats \
 *        -H "Authorization: Bearer $APP_SECRET"
 */
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const secret = process.env.APP_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const banners = await prisma.banner.findMany({
    orderBy: { impressions: 'desc' },
    select: {
      id: true,
      title: true,
      placement: true,
      country: true,
      isActive: true,
      endsAt: true,
      impressions: true,
      clicks: true,
    },
  })

  return NextResponse.json({
    banners: banners.map(b => ({
      ...b,
      ctr: b.impressions > 0 ? +((b.clicks / b.impressions) * 100).toFixed(3) : null,
    })),
    totals: {
      impressions: banners.reduce((s, b) => s + b.impressions, 0),
      clicks: banners.reduce((s, b) => s + b.clicks, 0),
    },
  })
}
