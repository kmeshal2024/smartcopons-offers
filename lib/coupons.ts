import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/db'
import { TTL_LISTING } from '@/lib/offer-queries'
import { DEFAULT_COUNTRY, resolveCountry } from '@/lib/countries'

/**
 * One coupon store + its ACTIVE codes, for the /coupons/[slug] landing pages —
 * the SEO money pages ("كود خصم نمشي"). Slug is the store's DB slug (Arabic).
 * Returns null for an unknown slug so the route can 404.
 */
export const getCouponStore = unstable_cache(
  async function getCouponStore(slug: string) {
    const store = await prisma.store.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true, logo: true, website: true, countries: true },
    })
    if (!store) return null
    const coupons = await prisma.coupon.findMany({
      where: {
        storeId: store.id,
        isActive: true,
        OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
      },
      orderBy: [{ isExclusive: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true, code: true, title: true, discountText: true,
        isExclusive: true, validUntil: true, updatedAt: true, affiliateUrl: true,
      },
    })
    return { store, coupons }
  },
  ['coupon-store'],
  { revalidate: TTL_LISTING, tags: ['coupons'] }
)

export const getCouponsData = unstable_cache(async function getCouponsData(country: string = DEFAULT_COUNTRY) {
  // A store's `countries` is a comma list because most coupon stores are
  // GCC-wide. Prisma has no "list contains" for a TEXT column, so match on the
  // substring — safe while the codes are two distinct letters pairs.
  const inMarket = { store: { countries: { contains: resolveCountry(country).code } } }

  const [coupons, stores] = await Promise.all([
    prisma.coupon.findMany({
      where: { isActive: true, ...inMarket },
      include: {
        store: { select: { name: true, slug: true, logo: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.store.findMany({
      where: { countries: { contains: resolveCountry(country).code } },
      include: {
        _count: { select: { coupons: { where: { isActive: true } } } },
      },
      orderBy: { name: 'asc' },
    }),
  ])

  return { coupons, stores }
}, ['coupons-data'], { revalidate: TTL_LISTING, tags: ['coupons'] })
