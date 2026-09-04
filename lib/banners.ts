import { prisma } from '@/lib/db'
import { unstable_cache } from 'next/cache'
import { TTL_LISTING } from '@/lib/offer-queries'

/**
 * Ad banner serving — the read path for components/BannerSlot.tsx.
 *
 * Cached like every other listing query (tag 'banners', invalidated by the
 * admin CRUD routes), so serving a banner costs no DB read on the hot path.
 * Scheduling windows are evaluated inside the cached query; with a 1-hour TTL
 * a banner can start or stop up to an hour late, which is fine for ads.
 */

export const BANNER_PLACEMENTS = [
  'home_top',
  'home_middle',
  'offers',
  'coupons',
  'flyers',
] as const

export type BannerPlacement = (typeof BANNER_PLACEMENTS)[number]

export interface ServableBanner {
  id: string
  title: string
  imageUrl: string
  priority: number
  width: number | null
  height: number | null
}

export const getActiveBanners = unstable_cache(
  async (placement: string, country: string): Promise<ServableBanner[]> => {
    try {
      const now = new Date()
      return await prisma.banner.findMany({
        where: {
          placement,
          country,
          isActive: true,
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
          ],
        },
        select: {
          id: true,
          title: true,
          imageUrl: true,
          priority: true,
          width: true,
          height: true,
        },
        orderBy: { priority: 'desc' },
        take: 10,
      })
    } catch {
      // The table may not exist yet (deploy lands before the migrate route is
      // run) — an empty slot, never a broken page.
      return []
    }
  },
  ['active-banners'],
  { revalidate: TTL_LISTING, tags: ['banners'] }
)

/**
 * Which banner wins the slot: highest priority, ties rotated randomly per
 * request so equal-priority creatives split impressions instead of the
 * alphabetically-first one taking everything.
 */
export function pickBanner(banners: ServableBanner[]): ServableBanner | null {
  if (!banners.length) return null
  const top = banners[0].priority
  const contenders = banners.filter(b => b.priority === top)
  return contenders[Math.floor(Math.random() * contenders.length)]
}
