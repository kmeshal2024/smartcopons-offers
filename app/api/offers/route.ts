import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { countryFromRequest } from '@/lib/countries'
import { arabicVariants, normalizeArabic } from '@/lib/arabic-search'

// Everyday synonyms plain letter-variants can't bridge — the word typed isn't
// always the word on the label (ماء vs مياه). Keyed by normalized form.
const SEARCH_SYNONYMS: Record<string, string[]> = {
  ماء: ['ماء', 'مياه'],
  مياه: ['مياه', 'ماء'],
  رز: ['رز', 'ارز', 'أرز'],
  ارز: ['ارز', 'رز'],
  شيبس: ['شيبس', 'رقائق', 'شبس'],
  عصير: ['عصير', 'عصائر'],
}

function tokenize(q: string): string[] {
  const t = q
    .trim()
    .split(/\s+/)
    .filter(w => w.replace(/[^\w؀-ۿ]/g, '').length >= 2)
  return t.length ? t : [q.trim()]
}

/**
 * Relevance-ranked product search (raw SQL — Prisma can't ORDER BY a computed
 * score). A product must contain EVERY query word (so "ماء 200 مل" needs water
 * AND 200 AND مل, not the literal phrase). On the Arabic name each word is
 * matched whole-word (at the start, or space-preceded) so "ماء" hits "مياه
 * نستله" / "ايفال ماء" but not "مقاوم للماء" (water-resistant). Results rank:
 * name starts with the word (0) > word appears inside (1) > matched elsewhere
 * (2), then biggest discount. Also matches the category name so "لحوم"/"ألبان"
 * return that whole section.
 */
async function relevanceSearch(opts: {
  search: string
  country: string
  supermarketId?: string | null
  categoryId?: string | null
  minPrice?: number | null
  maxPrice?: number | null
  skip: number
  limit: number
}): Promise<{ ids: string[]; total: number }> {
  const tokens = tokenize(opts.search)

  // Emitted twice (ids + count) with independent param numbering.
  const buildWhere = (add: (v: any) => string) => {
    const tokenClauses = tokens.map(tok => {
      const forms = SEARCH_SYNONYMS[normalizeArabic(tok)] || [tok]
      const variants = Array.from(new Set(forms.flatMap(f => arabicVariants(f))))
      const ors: string[] = []
      for (const v of variants) {
        ors.push(`po."nameAr" ILIKE ${add(v + '%')}`) // starts with
        ors.push(`po."nameAr" ILIKE ${add('% ' + v + '%')}`) // whole word inside
        const sub = add('%' + v + '%')
        ors.push(`po."nameEn" ILIKE ${sub}`)
        ors.push(`po.brand ILIKE ${sub}`)
        ors.push(`po.tags ILIKE ${sub}`)
      }
      return `(${ors.join(' OR ')})`
    })
    const catOrs = arabicVariants(opts.search).map(v => `c."nameAr" ILIKE ${add('%' + v + '%')}`)
    const clauses = [
      'po."isHidden" = false',
      'po.price > 0',
      'f."endDate" >= now()',
      // Same market scoping as the Prisma path — the raw search must not leak
      // another country's offers past the filter.
      `po.country = ${add(opts.country)}`,
      `((${tokenClauses.join(' AND ')}) OR (${catOrs.join(' OR ')}))`,
    ]
    if (opts.supermarketId) clauses.push(`po."supermarketId" = ${add(opts.supermarketId)}`)
    if (opts.categoryId) clauses.push(`po."categoryId" = ${add(opts.categoryId)}`)
    if (opts.minPrice && opts.minPrice > 0) clauses.push(`po.price >= ${add(opts.minPrice)}`)
    if (opts.maxPrice) clauses.push(`po.price <= ${add(opts.maxPrice)}`)
    return clauses.join(' AND ')
  }

  const FROM =
    'FROM product_offers po JOIN flyers f ON f.id = po."flyerId" LEFT JOIN categories c ON c.id = po."categoryId"'

  const firstForms = SEARCH_SYNONYMS[normalizeArabic(tokens[0])] || [tokens[0]]
  const firstVars = Array.from(new Set(firstForms.flatMap(f => arabicVariants(f))))

  const idParams: any[] = []
  const addI = (v: any) => {
    idParams.push(v)
    return `$${idParams.length}`
  }
  const whereI = buildWhere(addI)
  // Rank on BOTH names. English used to skip this and fall through to
  // discount-only ordering, which is why "coffee" led with coffee-flavoured
  // biscuits while Arabic "قهوة" returned actual coffee.
  // WHOLE-WORD, not prefix. `ILIKE 'زيت%'` also matches زيتون (olives), so a
  // search for oil led with olives. The WHERE stays permissive so nothing is
  // lost from the result set — only the ORDER changes, pushing
  // prefix-of-a-longer-word matches below real ones.
  const startExpr = firstVars
    .flatMap(v => [
      `po."nameAr" ~* ${addI('^' + v + '([^[:alpha:]]|$)')}`,
      `po."nameEn" ~* ${addI('^' + v + '([^[:alpha:]]|$)')}`,
    ])
    .join(' OR ')
  const wordExpr = firstVars
    .flatMap(v => [
      `po."nameAr" ~* ${addI('[^[:alpha:]]' + v + '([^[:alpha:]]|$)')}`,
      `po."nameEn" ~* ${addI('[^[:alpha:]]' + v + '([^[:alpha:]]|$)')}`,
    ])
    .join(' OR ')
  const prefixExpr = firstVars
    .flatMap(v => [`po."nameAr" ILIKE ${addI(v + '%')}`, `po."nameEn" ILIKE ${addI(v + '%')}`])
    .join(' OR ')
  const rel = `CASE WHEN ${startExpr} THEN 0 WHEN ${wordExpr} THEN 1 WHEN ${prefixExpr} THEN 2 ELSE 3 END`

  // Groceries before non-groceries — but only as a TIE-BREAK inside a
  // relevance tier, never as a filter. "ماء" matched "ماء عطر جيفنشي"
  // (eau de parfum) just as strongly as bottled water; both are tier 0, so the
  // category decides. A search with no grocery matches at all (شامبو) is
  // untouched, because then every row shares the same category rank.
  const FOOD = ['dairy', 'meat-poultry', 'vegetables', 'fruits', 'bakery', 'beverages', 'snacks', 'canned-dry']
  const foodRank = `CASE WHEN c.slug IN (${FOOD.map(f => addI(f)).join(', ')}) THEN 0 ELSE 1 END`

  // A card with no picture looks broken and is harder to recognise, so among
  // equally relevant items the ones shoppers can actually see come first.
  const imgRank = `CASE WHEN po."imageUrl" IS NULL OR po."imageUrl" = '' THEN 1 ELSE 0 END`

  const limitP = addI(opts.limit)
  const offsetP = addI(opts.skip)
  const idsSql = `SELECT po.id ${FROM} WHERE ${whereI} ORDER BY (${rel}) ASC, (${foodRank}) ASC, (${imgRank}) ASC, po."discountPercent" DESC NULLS LAST, po."viewCount" DESC LIMIT ${limitP} OFFSET ${offsetP}`

  const cParams: any[] = []
  const addC = (v: any) => {
    cParams.push(v)
    return `$${cParams.length}`
  }
  const countSql = `SELECT count(*)::int AS n ${FROM} WHERE ${buildWhere(addC)}`

  const [idRows, countRows] = await Promise.all([
    prisma.$queryRawUnsafe<{ id: string }[]>(idsSql, ...idParams),
    prisma.$queryRawUnsafe<{ n: number }[]>(countSql, ...cParams),
  ])
  return { ids: idRows.map(r => r.id), total: Number(countRows[0]?.n ?? 0) }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const supermarketId = searchParams.get('supermarket')
    const categoryParam = searchParams.get('category')
    const cityParam = searchParams.get('city')
    const search = searchParams.get('search')
    const minPrice = searchParams.get('minPrice')
    const maxPrice = searchParams.get('maxPrice')
    const sort = searchParams.get('sort') || 'newest'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '24')
    const skip = (page - 1) * limit

    // Build filters
    const where: any = {
      isHidden: false,
      // Placeholder rows emitted by flyer scrapers are not products.
      price: { gt: 0 },
      // Scope to one market. Without this, UAE offers priced in Dirhams would
      // list next to Saudi ones priced in Riyals. Defaults to Saudi, so
      // existing callers are unaffected.
      country: countryFromRequest(request),
    }

    // Never surface offers whose flyer has already ended — stale prices on a
    // price-comparison site actively mislead shoppers.
    //
    // This filter used to be skipped whenever any filter was applied, to avoid
    // hiding products behind "stale flyer records". That was a workaround for
    // the expire-flyers cron silently 401-ing, and it meant filtered views
    // (by store, category or search) served mostly expired prices. The filter
    // keys off endDate rather than the status flag, so it stays correct even
    // if a flyer's status is out of date.
    where.flyer = {
      endDate: { gte: new Date() },
    }

    if (supermarketId) {
      where.supermarketId = supermarketId
    }

    // `category` may be a slug (the homepage category tiles deep-link with
    // ?category=slug) or a raw DB id (the sidebar filter posts the id).
    // Resolve slug→id, same as city below. Without this, every tile on the
    // homepage led to an empty result page.
    let resolvedCategoryId: string | null = null
    if (categoryParam) {
      const category = await prisma.category.findUnique({
        where: { slug: categoryParam },
        select: { id: true },
      })
      resolvedCategoryId = category?.id ?? categoryParam
      where.categoryId = resolvedCategoryId
    }

    // `city` may be a slug (from CityFilterBar) or a raw DB id. Resolve slug→id.
    if (cityParam && cityParam !== 'all') {
      const city = await prisma.city.findUnique({ where: { slug: cityParam }, select: { id: true } })
      where.flyer = {
        ...(where.flyer || {}),
        cityId: city?.id ?? cityParam,
      }
    }

    // Search is handled by relevanceSearch() below (raw SQL, so it can rank by
    // relevance), not through this `where`.

    if (minPrice || maxPrice) {
      // Merge, don't replace — the base filter carries `gt: 0`, and the client
      // always sends minPrice=0, which would otherwise let placeholder rows
      // priced at 0 back into the feed.
      const min = minPrice ? parseFloat(minPrice) : undefined
      if (min !== undefined && min > 0) where.price.gte = min
      if (maxPrice) where.price.lte = parseFloat(maxPrice)
    }

    // Build orderBy. Default puts the biggest discounts first (nulls last) then
    // the newest — the shopper asked for discounted, desirable items up top.
    const DISCOUNT_FIRST: any = [
      { discountPercent: { sort: 'desc', nulls: 'last' } },
      { createdAt: 'desc' },
    ]
    let orderBy: any = DISCOUNT_FIRST

    switch (sort) {
      case 'newest':
        orderBy = { createdAt: 'desc' }
        break
      case 'price-low':
        orderBy = { price: 'asc' }
        break
      case 'price-high':
        orderBy = { price: 'desc' }
        break
      case 'discount':
        orderBy = DISCOUNT_FIRST
        break
      case 'popular':
        orderBy = { viewCount: 'desc' }
        break
      case 'ending':
        // Soonest-to-expire first. The where clause already excludes offers
        // whose flyer has ended, so every row here has a future endDate.
        orderBy = { flyer: { endDate: 'asc' } }
        break
    }

    const productInclude = {
      supermarket: { select: { id: true, name: true, nameAr: true, slug: true, logo: true } },
      category: { select: { id: true, nameAr: true, nameEn: true, slug: true, icon: true } },
      flyer: { select: { id: true, title: true, titleAr: true, startDate: true, endDate: true } },
    }

    let products: any[]
    let total: number

    if (search) {
      // Relevance-ranked path. Fetch the ordered ids, then hydrate them and
      // preserve that order (a plain `in` query would lose the ranking).
      const { ids, total: t } = await relevanceSearch({
        search,
        country: where.country,
        supermarketId,
        categoryId: resolvedCategoryId,
        minPrice: minPrice ? parseFloat(minPrice) : null,
        maxPrice: maxPrice ? parseFloat(maxPrice) : null,
        skip,
        limit,
      })
      total = t
      const rows = ids.length
        ? await prisma.productOffer.findMany({ where: { id: { in: ids } }, include: productInclude })
        : []
      const byId = new Map(rows.map(r => [r.id, r]))
      products = ids.map(id => byId.get(id)).filter(Boolean)
    } else {
      ;[products, total] = await Promise.all([
        prisma.productOffer.findMany({ where, orderBy, skip, take: limit, include: productInclude }),
        prisma.productOffer.count({ where }),
      ])
    }

    // Increment view counts (async, don't wait)
    if (products.length > 0) {
      const productIds = products.map(p => p.id)
      prisma.productOffer.updateMany({
        where: { id: { in: productIds } },
        data: { viewCount: { increment: 1 } },
      }).catch(() => {})
    }

    const response = NextResponse.json({
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })

    // Offers only change when the daily scrape lands, so cache generously: five
    // minutes fresh, then serve stale for an hour while revalidating behind the
    // scenes. Repeat searches come back from the edge instead of waking Neon,
    // which is what made a cold query take ~3s.
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600')

    return response
  } catch (error) {
    console.error('Error fetching offers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch offers' },
      { status: 500 }
    )
  }
}
