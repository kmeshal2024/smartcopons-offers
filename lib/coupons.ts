import { prisma } from '@/lib/db'
import { DEFAULT_COUNTRY, resolveCountry } from '@/lib/countries'

export async function getCouponsData(country: string = DEFAULT_COUNTRY) {
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
}
