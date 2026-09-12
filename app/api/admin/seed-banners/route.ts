import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { invalidateBanners } from '@/lib/cache-invalidation'

/**
 * Seeds the launch set of affiliate banners — house seed pattern (like
 * seed-owned-coupons): one full-set POST, idempotent via upsert on fixed ids,
 * behind APP_SECRET. Re-running updates the creatives in place.
 *
 * 2026-09-12: every unit converted to kind='native' (styled Arabic card, no
 * external image). Week-one data showed the network images were the problem:
 * ad.admitad.com and prf.hn are on every ad-blocker list, so a chunk of
 * shoppers never saw the creative at all, and the generic logos said nothing
 * to a deals audience. The affiliate CLICK links are unchanged — tracking and
 * commissions work exactly as before. imageUrl values are kept on the rows so
 * flipping a unit back to kind='image' in /admin/banners is one click.
 *
 * Affiliate links (from the owner's own dashboards, 2026-09-05):
 * - AliExpress WW via Admitad, ad space "smart copons" (rzekl.com/g/…)
 * - iHerb via Partnerize camref:1011lCoHu → sa.iherb.com
 * - Trip.com via Partnerize camref:1100l4hxTZ
 *
 *   curl -X POST https://sa.smartcopons.com/api/admin/seed-banners \
 *        -H "Authorization: Bearer $APP_SECRET"
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const ALIEXPRESS_URL = 'https://rzekl.com/g/45zdaqe3i33be3681a0d16525dc3e8/?i=4'
const ALIEXPRESS_IMG = 'https://ad.admitad.com/b/45zdaqe3i33be3681a0d16525dc3e8/'
const IHERB_URL = 'https://iherb.prf.hn/click/camref:1011lCoHu/creativeref:1100l169709'
const IHERB_IMG = 'https://iherb-creative.prf.hn/source/camref:1011lCoHu/creativeref:1100l169709'
const TRIP_URL = 'https://trip.prf.hn/click/camref:1100l4hxTZ/creativeref:1011l28720'
const TRIP_IMG = 'https://trip-creative.prf.hn/source/camref:1100l4hxTZ/creativeref:1011l28720'

const IHERB_CARD = {
  kind: 'native',
  theme: 'green',
  headline: '🌿 شحن مجاني من آيهيرب إلى السعودية',
  subtitle: 'فيتامينات ومكملات وعناية بخصومات يومية — للطلبات فوق 250 ر.س',
  ctaText: 'تسوق الآن',
  targetUrl: IHERB_URL,
  imageUrl: IHERB_IMG,
  title: 'آيهيرب — شحن مجاني إلى السعودية للطلبات فوق 250 ر.س',
}

const ALI_CARD_SA = {
  kind: 'native',
  theme: 'orange',
  headline: '🛒 عروض علي إكسبرس اليوم',
  subtitle: 'ملايين المنتجات بأسعار مخفضة مع شحن إلى السعودية',
  ctaText: 'اكتشف العروض',
  targetUrl: ALIEXPRESS_URL,
  imageUrl: ALIEXPRESS_IMG,
  title: 'علي إكسبرس — تسوق ملايين المنتجات بأسعار مخفضة',
}

const ALI_CARD_AE = {
  ...ALI_CARD_SA,
  subtitle: 'ملايين المنتجات بأسعار مخفضة مع شحن إلى الإمارات',
}

const TRIP_CARD = {
  kind: 'native',
  theme: 'blue',
  headline: '✈️ سافر بذكاء مع Trip.com',
  subtitle: 'فنادق وطيران حول العالم بدون رسوم حجز',
  ctaText: 'احجز الآن',
  targetUrl: TRIP_URL,
  imageUrl: TRIP_IMG,
  title: 'Trip.com — احجز فنادق وطيران بدون رسوم حجز',
}

const BASE = { isActive: true, priority: 10, width: null as number | null, height: null as number | null }

const BANNERS = [
  // ---- SA ----
  { id: 'seed-iherb-ar-728x90-home-top-sa', ...BASE, ...IHERB_CARD, placement: 'home_top', country: 'SA' },
  { id: 'seed-aliexpress-logo-640-home-middle-sa', ...BASE, ...ALI_CARD_SA, placement: 'home_middle', country: 'SA' },
  // Fall Fest expired Sep 7; trip.com (converted to native) now owns the slot.
  { id: 'seed-tripcom-728x90-offers-sa', ...BASE, ...TRIP_CARD, placement: 'offers', country: 'SA' },
  { id: 'seed-aliexpress-logo-640-coupons-sa', ...BASE, ...ALI_CARD_SA, placement: 'coupons', country: 'SA' },
  { id: 'seed-iherb-ar-728x90-product-sa', ...BASE, ...IHERB_CARD, placement: 'product', country: 'SA' },
  { id: 'seed-aliexpress-logo-640-stores-sa', ...BASE, ...ALI_CARD_SA, placement: 'stores', country: 'SA' },
  { id: 'seed-tripcom-728x90-flyers-sa', ...BASE, ...TRIP_CARD, placement: 'flyers', country: 'SA' },
  { id: 'seed-iherb-infeed-sa', ...BASE, ...IHERB_CARD, headline: '🌿 خصومات آيهيرب اليومية', subtitle: 'شحن مجاني إلى السعودية للطلبات فوق 250 ر.س', placement: 'infeed', country: 'SA' },
  // ---- AE ----
  { id: 'seed-aliexpress-logo-640-home-top-ae', ...BASE, ...ALI_CARD_AE, placement: 'home_top', country: 'AE' },
  { id: 'seed-tripcom-728x90-home-middle-ae', ...BASE, ...TRIP_CARD, placement: 'home_middle', country: 'AE' },
  { id: 'seed-aliexpress-logo-640-product-ae', ...BASE, ...ALI_CARD_AE, placement: 'product', country: 'AE' },
  { id: 'seed-tripcom-728x90-flyers-ae', ...BASE, ...TRIP_CARD, placement: 'flyers', country: 'AE' },
  { id: 'seed-aliexpress-infeed-ae', ...BASE, ...ALI_CARD_AE, headline: '🛒 صفقات علي إكسبرس', subtitle: 'أسعار مخفضة وشحن إلى الإمارات', placement: 'infeed', country: 'AE' },
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
