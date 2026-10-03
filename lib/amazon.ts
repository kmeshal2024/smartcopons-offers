import { prisma } from '@/lib/db'
import { unstable_cache } from 'next/cache'
import { TTL_LISTING } from '@/lib/offer-queries'

/**
 * Amazon.sa affiliate products — the read path for app/amazon.
 *
 * The products are hand-picked (see the AmazonProduct model). Links are built
 * by amazonUrl() in lib/amazon-catalog.ts, never stored, so the Associates tag
 * lives in exactly one place.
 */

export {
  AMAZON_SA_TAG,
  AMAZON_DISCLOSURE,
  AMAZON_CATEGORIES,
  AMAZON_CATEGORY_SLUGS,
  parseAsin,
  isAsin,
  amazonUrl,
} from '@/lib/amazon-catalog'

export interface ServableAmazonProduct {
  id: string
  asin: string
  title: string
  note: string | null
  imageUrl: string | null
  category: string
}

export const getActiveAmazonProducts = unstable_cache(
  async (): Promise<ServableAmazonProduct[]> => {
    try {
      return await prisma.amazonProduct.findMany({
        where: { isActive: true },
        select: { id: true, asin: true, title: true, note: true, imageUrl: true, category: true },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        take: 500,
      })
    } catch {
      // Table not migrated yet — an empty page, never a broken one.
      return []
    }
  },
  ['amazon-products'],
  { revalidate: TTL_LISTING, tags: ['amazon'] }
)
