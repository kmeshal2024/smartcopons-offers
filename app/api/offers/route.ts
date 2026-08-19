import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { countryFromRequest } from '@/lib/countries'
import { arabicVariants, normalizeArabic } from '@/lib/arabic-search'

// Everyday synonyms plain letter-variants can't bridge — the word typed isn't
// always the word on the label (ماء vs مياه). Keyed by normalized form.
const SEARCH_SYNONYMS: Record<string, string[]> = {
  ماء: ['ماء', 'مياه'],
  مياه: ['مياه', 'ماء'],
  // Saudi colloquial for water — the label never says مويه, the shopper often does.
  مويه: ['مويه', 'ماء', 'مياه'],
  رز: ['رز', 'ارز', 'أرز'],
  ارز: ['ارز', 'رز'],
  شيبس: ['شيبس', 'رقائق', 'شبس'],
  عصير: ['عصير', 'عصائر'],
  طحين: ['طحين', 'دقيق'],
  دقيق: ['دقيق', 'طحين'],
  تمر: ['تمر', 'تمور'],
  تمور: ['تمور', 'تمر'],
  جوال: ['جوال', 'هاتف', 'موبايل'],
}

function tokenize(q: string): string[] {
  const t = q
    .trim()
    .split(/\s+/)
    .filter(w => w.replace(/[^\w؀-ۿ]/g, '').length >= 2)
  return t.length ? t : [q.trim()]
}

// Words that turn the query term into an ATTRIBUTE the product lacks (or a
// flavour), not the product itself: "شوكولاتة بدون سكر" is chocolate, not sugar;
// "زبادي بنكهة السكر" is yogurt. A shopper searching سكر wants sugar. When one of
// these precedes the query word in the name, the match is the OPPOSITE of intent
// and must be dropped — unless the shopper themselves typed a negation (then they
// really do want "sugar-free X"). See relevanceSearch below.
const NEG_MARKERS_AR = [
  'بدون', 'بلا', 'خالي', 'خاليه', 'خالية', 'خال', 'زيرو', 'دايت', 'لايت',
  'منزوع', 'قليل', 'قليله', 'قليلة', 'منخفض', 'منخفضه', 'منخفضة', 'عديم',
  'بنكهه', 'بنكهة', 'نكهه', 'نكهة', 'بطعم', 'برائحه', 'برائحة',
]
const NEG_ALT_AR = NEG_MARKERS_AR.join('|')
// English equivalents, for the ~1% English-named rows and English queries.
const NEG_EN_STANDALONE = 'zero|diet|light|unsweetened|no|low|less|without|sugarfree'

function queryHasNegation(q: string): boolean {
  const norm = normalizeArabic(q)
  if (NEG_MARKERS_AR.some(m => norm.includes(normalizeArabic(m)))) return true
  return /\b(free|zero|diet|light|unsweetened|no[- ]?added|without|low|less)\b/i.test(q)
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
  // If the shopper typed "بدون"/"free"/etc. themselves, keep those matches —
  // they want the sugar-free product. Otherwise strip attribute-only matches.
  const dropNegated = !queryHasNegation(opts.search)

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
      let clause = `(${ors.join(' OR ')})`

      // Drop matches where THIS token appears only as a negated/flavour
      // attribute of the product, not as the product itself:
      //   بدون سكر / بدون إضافة سكر / خالية من السكر / زيرو سكر / بنكهة السكر
      // The marker must sit within two words BEFORE the query term (Arabic puts
      // the head noun first, so "سكر بني" — sugar first — is never negated).
      if (dropNegated) {
        // COALESCE to '' — nameEn is NULL for ~99% of rows, and `NULL ~* x` is
        // NULL, which poisons `AND NOT (...)` and would drop every such row.
        const negOrs: string[] = []
        for (const v of variants) {
          negOrs.push(
            `COALESCE(po."nameAr",'') ~* ${add('(' + NEG_ALT_AR + ')([[:space:]]+[^[:space:]]+){0,2}[[:space:]]+(ال)?' + v + '([^[:alpha:]]|$)')}`
          )
          // English: "sugar free" / "sugar-free" (marker after) and
          // "no|zero|diet ... sugar" (marker before).
          negOrs.push(`COALESCE(po."nameEn",'') ~* ${add('\\y' + v + '[- ]?free\\y')}`)
          negOrs.push(`COALESCE(po."nameEn",'') ~* ${add('(' + NEG_EN_STANDALONE + ')[^[:alpha:]]+' + v + '\\y')}`)
        }
        clause = `(${clause} AND NOT (${negOrs.join(' OR ')}))`
      }
      return clause
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

  // Multi-word queries: an EXACT adjacent phrase ("قهوة عربية" as-typed) is a
  // stronger signal than every word matching somewhere in the name, so it gets
  // its own rank ahead of the per-token tiers. Single-word queries skip this
  // (the expression would be constant).
  const phraseVars = tokens.length > 1 ? arabicVariants(opts.search.trim()) : []
  const phraseRank = phraseVars.length
    ? `CASE WHEN ${phraseVars
        .flatMap(v => [
          `po."nameAr" ILIKE ${addI('%' + v + '%')}`,
          `COALESCE(po."nameEn",'') ILIKE ${addI('%' + v + '%')}`,
        ])
        .join(' OR ')} THEN 0 ELSE 1 END`
    : '0'

  const limitP = addI(opts.limit)
  const offsetP = addI(opts.skip)
  // One round trip: the window count rides along with the page of ids instead
  // of re-running the whole WHERE a second time (it was the same expensive
  // scan twice per search). `viewCount` is gone from the ordering — it is a
  // frozen, discredited metric (see the note in GET below); the final
  // tie-break is now name length, because among equally relevant rows the
  // shorter name is the purer match ("سكر" the product beats "بسكويت
  // بشوكولاتة وقطع السكر البني").
  const idsSql = `SELECT po.id, count(*) OVER()::int AS total ${FROM} WHERE ${whereI} ORDER BY (${rel}) ASC, (${phraseRank}) ASC, (${foodRank}) ASC, (${imgRank}) ASC, po."discountPercent" DESC NULLS LAST, length(COALESCE(po."nameAr", po."nameEn", '')) ASC LIMIT ${limitP} OFFSET ${offsetP}`

  const idRows = await prisma.$queryRawUnsafe<{ id: string; total: number }[]>(idsSql, ...idParams)

  if (idRows.length) return { ids: idRows.map(r => r.id), total: Number(idRows[0].total) }
  if (!opts.skip) return { ids: [], total: 0 }

  // Page past the end: the window count never materialised, so fall back to a
  // bare count. Rare (stale pagination links), so the extra query is fine here.
  const cParams: any[] = []
  const addC = (v: any) => {
    cParams.push(v)
    return `$${cParams.length}`
  }
  const countRows = await prisma.$queryRawUnsafe<{ n: number }[]>(
    `SELECT count(*)::int AS n ${FROM} WHERE ${buildWhere(addC)}`,
    ...cParams
  )
  return { ids: [], total: Number(countRows[0]?.n ?? 0) }
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
      // `popular` is retired — viewCount never measured views and is now frozen
      // (see app/page.tsx). The param is still accepted so indexed and bookmarked
      // URLs keep working; it falls through to the default discount-first order
      // rather than erroring or ranking on a discredited column.
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

    // NOTE: this route used to fire `updateMany({ viewCount: increment 1 })` over
    // every row it returned. That made "الأكثر مشاهدة" measure how often a row
    // appeared in a listing response — a function of sort order and pagination,
    // not of anyone looking at anything. It was self-reinforcing: high-ranked
    // rows got returned more, so they incremented more, so they ranked higher.
    // Meanwhile /product/[id] — the only page where a real view happens — never
    // incremented at all.
    //
    // It was also a write on every read, which cannot be served from cache and
    // kept the Neon compute from suspending. Removed. `viewCount` now holds
    // frozen historical values; see the note on the homepage "most viewed"
    // section. A real view signal needs a client-side beacon, which is pending a
    // decision, NOT a server-side write here.

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
