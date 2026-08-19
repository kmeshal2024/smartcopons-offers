import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/db'
import { countryFromRequest } from '@/lib/countries'
import { arabicContainsFilter, isNegatedMatch, normalizeArabic } from '@/lib/arabic-search'
import { listVisibleRetailers, TTL_COUNTS } from '@/lib/offer-queries'

/**
 * Autocomplete search. Optimised for latency:
 *  - only the trigram-indexed columns are searched (nameAr/nameEn/brand); tags
 *    was a big unindexed text field that forced a scan.
 *  - stores and categories no longer hit the DB per keystroke at all. The old
 *    store query ran TWO count subqueries per candidate row (offers + flyers,
 *    for the thin-store filter) on every request; both lists are small and
 *    hourly-fresh, so they now come from the cached read layer and are matched
 *    in memory with the same normalisation the DB path used.
 *  - responses are edge-cached: popular terms come back instantly on repeat.
 * See /api/admin/optimize-search for the indexes the product query relies on.
 */

/** All active categories — a ~10 row table read once an hour, not per keystroke. */
const listActiveCategories = unstable_cache(
  async () =>
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: { id: true, nameAr: true, nameEn: true, slug: true, icon: true },
    }),
  ['autocomplete-categories'],
  { revalidate: TTL_COUNTS }
)

/** Variant-insensitive "contains", mirroring what arabicContainsFilter asks the DB. */
const matches = (q: string, ...fields: Array<string | null | undefined>) => {
  const nq = normalizeArabic(q).toLowerCase()
  return fields.some(f => !!f && normalizeArabic(f).toLowerCase().includes(nq))
}
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const type = searchParams.get('type') || 'all' // 'all' | 'products' | 'coupons'

    if (!query || query.length < 2) {
      return NextResponse.json({ products: [], coupons: [], stores: [], categories: [], total: 0 })
    }

    const wantProducts = type === 'all' || type === 'products'
    const wantCoupons = type === 'all' || type === 'coupons'
    const wantGroups = type === 'all'

    // Scope every product-bearing result to one market.
    const country = countryFromRequest(request)

    const [products, coupons, stores, categories] = await Promise.all([
      wantProducts
        ? prisma.productOffer.findMany({
            where: {
              isHidden: false,
              country,
              price: { gt: 0 },
              flyer: { endDate: { gte: new Date() } },
              // Arabic-variant aware over the indexed columns only.
              OR: arabicContainsFilter(query, ['nameAr', 'nameEn', 'brand']),
            },
            // Over-fetch: the negation post-filter below drops attribute-only
            // matches ("بدون سكر" for a سكر search), so grab extra to still fill 10.
            take: 24,
            // Best deals first — viewCount is a frozen, discredited metric
            // (see the note in /api/offers).
            orderBy: { discountPercent: { sort: 'desc', nulls: 'last' } },
            // Lean select: exactly what the autocomplete row shows (thumbnail,
            // price, store), nothing more — smaller payload, faster response.
            select: {
              id: true,
              nameAr: true,
              nameEn: true,
              price: true,
              oldPrice: true,
              discountPercent: true,
              imageUrl: true,
              supermarket: { select: { nameAr: true, slug: true, logo: true } },
              category: { select: { nameAr: true, icon: true } },
            },
          })
        : Promise.resolve([]),

      wantCoupons
        ? prisma.coupon.findMany({
            where: {
              isActive: true,
              OR: [
                { title: { contains: query, mode: 'insensitive' } },
                { code: { contains: query, mode: 'insensitive' } },
                { discountText: { contains: query, mode: 'insensitive' } },
                { store: { name: { contains: query, mode: 'insensitive' } } },
              ],
            },
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: { store: { select: { name: true, slug: true, logo: true } } },
          })
        : Promise.resolve([]),

      // Cached, already filtered to visible (enough offers OR a live flyer) and
      // ordered by viewCount inside the read layer — just name-match here.
      wantGroups ? listVisibleRetailers(country) : Promise.resolve([]),

      wantGroups ? listActiveCategories() : Promise.resolve([]),
    ])

    // Drop products that match only as a negated/flavour attribute
    // ("المراعي عصير بدون سكر" for a سكر query), then trim to the 10 shown.
    const cleanProducts = (products as any[])
      .filter(p => !isNegatedMatch(p.nameAr || p.nameEn || '', query))
      .slice(0, 10)

    // In-memory name match over the cached lists (both are tiny).
    const visibleStores = (stores as any[])
      .filter(s => matches(query, s.nameAr, s.name))
      .slice(0, 5)
      .map(s => ({ id: s.id, nameAr: s.nameAr, slug: s.slug, logo: s.logo }))

    const matchedCategories = (categories as any[])
      .filter(c => matches(query, c.nameAr, c.nameEn))
      .slice(0, 5)
      .map(({ nameEn, ...c }) => c)

    const results = {
      products: cleanProducts,
      coupons,
      stores: visibleStores,
      categories: matchedCategories,
      total: cleanProducts.length + coupons.length + visibleStores.length + matchedCategories.length,
    }

    return NextResponse.json(results, {
      // Autocomplete queries repeat heavily; let the edge serve popular terms.
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
