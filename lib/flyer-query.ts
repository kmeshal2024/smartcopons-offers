import { prisma } from '@/lib/db'

/**
 * Shared flyer lookup used by both the Saudi (/flyers/...) and UAE
 * (/ae/flyers/...) routes. Matches a flyer by retailer slug + the YYYY-MM-DD of
 * its start date. Selects `country` on the store so the page can pick the right
 * canonical host, currency and copy.
 */
export async function getFlyerBySlugDate(slug: string, date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null

  const dayStart = new Date(`${date}T00:00:00.000Z`)
  if (Number.isNaN(dayStart.getTime())) return null
  const dayEnd = new Date(dayStart)
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1)

  // The nightly ingest has historically produced DUPLICATE flyer rows for the
  // same store + start date (see consolidate-flyers), some of them empty. A
  // bare findFirst picks an arbitrary row, so the page sometimes rendered the
  // empty duplicate while the real leaflet sat in its sibling. Fetch the day's
  // candidates (2–3 rows at worst) and prefer the one with content.
  const rows = await prisma.flyer.findMany({
    where: {
      supermarket: { slug },
      startDate: { gte: dayStart, lt: dayEnd },
    },
    include: {
      supermarket: { select: { nameAr: true, name: true, slug: true, logo: true, country: true } },
      productOffers: {
        where: { isHidden: false },
        take: 24,
        orderBy: { discountPercent: 'desc' },
        include: {
          supermarket: { select: { nameAr: true, slug: true, logo: true } },
          category: { select: { nameAr: true, icon: true } },
        },
      },
      _count: { select: { productOffers: { where: { isHidden: false } } } },
    },
    orderBy: { createdAt: 'desc' },
  })
  if (rows.length <= 1) return rows[0] ?? null

  const score = (f: (typeof rows)[number]) =>
    (parsePageImages(f.pageImages).length ? 4 : 0) +
    (f.pdfUrl ? 2 : 0) +
    (f._count.productOffers > 0 ? 1 : 0)
  return rows.reduce((best, f) => (score(f) > score(best) ? f : best))
}

export type FlyerWithStore = NonNullable<Awaited<ReturnType<typeof getFlyerBySlugDate>>>

/** Safely parse the pageImages JSON column into a string[]. */
export function parsePageImages(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string' && !!x) : []
  } catch {
    return []
  }
}
