import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { invalidateBanners } from '@/lib/cache-invalidation'

/**
 * Seeds the launch set of affiliate banners — house seed pattern (like
 * seed-owned-coupons): one full-set POST, idempotent via upsert on fixed ids,
 * behind APP_SECRET. Re-running updates the creatives in place.
 *
 * Sources, pulled from the owner's own affiliate dashboards on 2026-09-05:
 * - AliExpress WW via Admitad, ad space "smart copons". The image is served
 *   from ad.admitad.com/b/ (their counting pixel endpoint) and the click goes
 *   through rzekl.com/g/ — both per the exact HTML the Code dialog generates,
 *   so Admitad counts what we count. rel="nofollow sponsored" is rendered by
 *   BannerAd, which is what the program rules require.
 * - iHerb via Partnerize (camref:1011lCoHu), creative 1100l169709: the Arabic
 *   evergreen 728x90 whose destination is sa.iherb.com.
 *
 * The Fall Fest creative is a dated campaign (1–7 Sep 2026) and carries endsAt,
 * after which its slot silently empties.
 *
 *   curl -X POST https://sa.smartcopons.com/api/admin/seed-banners \
 *        -H "Authorization: Bearer $APP_SECRET"
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const BANNERS = [
  {
    id: 'seed-iherb-ar-728x90-home-top-sa',
    title: 'آيهيرب — شحن مجاني إلى السعودية للطلبات فوق 250 ر.س',
    imageUrl: 'https://iherb-creative.prf.hn/source/camref:1011lCoHu/creativeref:1100l169709',
    targetUrl: 'https://iherb.prf.hn/click/camref:1011lCoHu/creativeref:1100l169709',
    placement: 'home_top',
    country: 'SA',
    width: 728,
    height: 90,
    priority: 10,
    isActive: true,
  },
  {
    id: 'seed-aliexpress-logo-640-home-middle-sa',
    title: 'علي إكسبرس — تسوق ملايين المنتجات بأسعار مخفضة',
    imageUrl: 'https://ad.admitad.com/b/45zdaqe3i33be3681a0d16525dc3e8/',
    targetUrl: 'https://rzekl.com/g/45zdaqe3i33be3681a0d16525dc3e8/?i=4',
    placement: 'home_middle',
    country: 'SA',
    width: 640,
    height: 150,
    priority: 10,
    isActive: true,
  },
  {
    id: 'seed-aliexpress-fallfest-300-offers-sa',
    title: 'علي إكسبرس — خصومات حتى 60% في مهرجان الخريف',
    imageUrl: 'https://ad.admitad.com/b/j565dxnlzy3be3681a0d16525dc3e8/',
    targetUrl: 'https://rzekl.com/g/j565dxnlzy3be3681a0d16525dc3e8/?i=4',
    placement: 'offers',
    country: 'SA',
    width: 300,
    height: 250,
    priority: 10,
    isActive: true,
    endsAt: new Date('2026-09-07T23:59:59+03:00'),
  },
  {
    id: 'seed-aliexpress-logo-640-coupons-sa',
    title: 'علي إكسبرس — تسوق ملايين المنتجات بأسعار مخفضة',
    imageUrl: 'https://ad.admitad.com/b/45zdaqe3i33be3681a0d16525dc3e8/',
    targetUrl: 'https://rzekl.com/g/45zdaqe3i33be3681a0d16525dc3e8/?i=4',
    placement: 'coupons',
    country: 'SA',
    width: 640,
    height: 150,
    priority: 10,
    isActive: true,
  },
  {
    id: 'seed-iherb-ar-728x90-product-sa',
    title: 'آيهيرب — شحن مجاني إلى السعودية للطلبات فوق 250 ر.س',
    imageUrl: 'https://iherb-creative.prf.hn/source/camref:1011lCoHu/creativeref:1100l169709',
    targetUrl: 'https://iherb.prf.hn/click/camref:1011lCoHu/creativeref:1100l169709',
    placement: 'product',
    country: 'SA',
    width: 728,
    height: 90,
    priority: 10,
    isActive: true,
  },
  {
    id: 'seed-aliexpress-logo-640-product-ae',
    title: 'علي إكسبرس — تسوق ملايين المنتجات بأسعار مخفضة',
    imageUrl: 'https://ad.admitad.com/b/45zdaqe3i33be3681a0d16525dc3e8/',
    targetUrl: 'https://rzekl.com/g/45zdaqe3i33be3681a0d16525dc3e8/?i=4',
    placement: 'product',
    country: 'AE',
    width: 640,
    height: 150,
    priority: 10,
    isActive: true,
  },
  {
    id: 'seed-aliexpress-logo-640-stores-sa',
    title: 'علي إكسبرس — تسوق ملايين المنتجات بأسعار مخفضة',
    imageUrl: 'https://ad.admitad.com/b/45zdaqe3i33be3681a0d16525dc3e8/',
    targetUrl: 'https://rzekl.com/g/45zdaqe3i33be3681a0d16525dc3e8/?i=4',
    placement: 'stores',
    country: 'SA',
    width: 640,
    height: 150,
    priority: 10,
    isActive: true,
  },
  {
    id: 'seed-tripcom-728x90-flyers-sa',
    title: 'Trip.com — احجز فنادق وطيران بدون رسوم حجز',
    imageUrl: 'https://trip-creative.prf.hn/source/camref:1100l4hxTZ/creativeref:1011l28720',
    targetUrl: 'https://trip.prf.hn/click/camref:1100l4hxTZ/creativeref:1011l28720',
    placement: 'flyers',
    country: 'SA',
    width: 728,
    height: 90,
    priority: 10,
    isActive: true,
  },
  {
    id: 'seed-tripcom-728x90-flyers-ae',
    title: 'Trip.com — احجز فنادق وطيران بدون رسوم حجز',
    imageUrl: 'https://trip-creative.prf.hn/source/camref:1100l4hxTZ/creativeref:1011l28720',
    targetUrl: 'https://trip.prf.hn/click/camref:1100l4hxTZ/creativeref:1011l28720',
    placement: 'flyers',
    country: 'AE',
    width: 728,
    height: 90,
    priority: 10,
    isActive: true,
  },
  {
    // Priority 5 on purpose: Fall Fest (priority 10) wins the offers slot until
    // its endsAt passes, then this takes over — no manual switch needed.
    id: 'seed-tripcom-728x90-offers-sa',
    title: 'Trip.com — احجز فنادق وطيران بدون رسوم حجز',
    imageUrl: 'https://trip-creative.prf.hn/source/camref:1100l4hxTZ/creativeref:1011l28720',
    targetUrl: 'https://trip.prf.hn/click/camref:1100l4hxTZ/creativeref:1011l28720',
    placement: 'offers',
    country: 'SA',
    width: 728,
    height: 90,
    priority: 5,
    isActive: true,
  },
  {
    id: 'seed-tripcom-728x90-home-middle-ae',
    title: 'Trip.com — احجز فنادق وطيران بدون رسوم حجز',
    imageUrl: 'https://trip-creative.prf.hn/source/camref:1100l4hxTZ/creativeref:1011l28720',
    targetUrl: 'https://trip.prf.hn/click/camref:1100l4hxTZ/creativeref:1011l28720',
    placement: 'home_middle',
    country: 'AE',
    width: 728,
    height: 90,
    priority: 10,
    isActive: true,
  },
  {
    id: 'seed-aliexpress-logo-640-home-top-ae',
    title: 'علي إكسبرس — تسوق ملايين المنتجات بأسعار مخفضة',
    imageUrl: 'https://ad.admitad.com/b/45zdaqe3i33be3681a0d16525dc3e8/',
    targetUrl: 'https://rzekl.com/g/45zdaqe3i33be3681a0d16525dc3e8/?i=4',
    placement: 'home_top',
    country: 'AE',
    width: 640,
    height: 150,
    priority: 10,
    isActive: true,
  },
]

async function run() {
  const results: Array<{ id: string; ok: boolean; error?: string }> = []
  for (const { id, ...data } of BANNERS) {
    try {
      await prisma.banner.upsert({
        where: { id },
        create: { id, ...data },
        update: data,
      })
      results.push({ id, ok: true })
    } catch (e: any) {
      results.push({ id, ok: false, error: String(e?.message).slice(0, 180) })
    }
  }
  invalidateBanners()
  const total = await prisma.banner.count()
  return { seeded: results, failed: results.filter(r => !r.ok).length, totalBanners: total }
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
