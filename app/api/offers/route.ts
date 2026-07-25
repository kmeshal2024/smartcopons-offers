import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { arabicContainsFilter, arabicVariants, normalizeArabic } from '@/lib/arabic-search'

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
    if (categoryParam) {
      const category = await prisma.category.findUnique({
        where: { slug: categoryParam },
        select: { id: true },
      })
      where.categoryId = category?.id ?? categoryParam
    }

    // `city` may be a slug (from CityFilterBar) or a raw DB id. Resolve slug→id.
    if (cityParam && cityParam !== 'all') {
      const city = await prisma.city.findUnique({ where: { slug: cityParam }, select: { id: true } })
      where.flyer = {
        ...(where.flyer || {}),
        cityId: city?.id ?? cityParam,
      }
    }

    if (search) {
      const fields = ['nameAr', 'nameEn', 'brand', 'tags']

      // Everyday synonyms that plain letter-variants can't bridge — the word the
      // shopper types isn't always the word on the label (ماء vs مياه). Keyed by
      // normalized form. Extend as gaps show up.
      const SYNONYMS: Record<string, string[]> = {
        ماء: ['ماء', 'مياه'],
        مياه: ['مياه', 'ماء'],
        رز: ['رز', 'ارز', 'أرز'],
        ارز: ['ارز', 'رز'],
        شيبس: ['شيبس', 'رقائق', 'شبس'],
        عصير: ['عصير', 'عصائر'],
      }

      // Split into words and require the product to contain them ALL — "ماء 200
      // مل" must have water AND 200 AND مل, not the literal phrase (which no name
      // holds). Each word still matches its Arabic letter-variants and synonyms.
      const tokens = search
        .trim()
        .split(/\s+/)
        .filter(t => t.replace(/[^\w؀-ۿ]/g, '').length >= 2)
      const perToken = (tokens.length ? tokens : [search.trim()]).map(tok => {
        const forms = SYNONYMS[normalizeArabic(tok)] || [tok]
        return { OR: forms.flatMap(f => arabicContainsFilter(f, fields)) }
      })
      const productMatch = perToken.length > 1 ? { AND: perToken } : perToken[0]

      // Also match the category name, so "لحوم"/"ألبان" return that whole section.
      const categoryConds = arabicVariants(search).map(v => ({
        category: { nameAr: { contains: v, mode: 'insensitive' as const } },
      }))

      where.OR = [productMatch, ...categoryConds]
    }

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

    // Fetch products with pagination
    const [products, total] = await Promise.all([
      prisma.productOffer.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          supermarket: {
            select: {
              id: true,
              name: true,
              nameAr: true,
              slug: true,
              logo: true,
            },
          },
          category: {
            select: {
              id: true,
              nameAr: true,
              nameEn: true,
              slug: true,
              icon: true,
            },
          },
          flyer: {
            select: {
              id: true,
              title: true,
              titleAr: true,
              startDate: true,
              endDate: true,
            },
          },
        },
      }),
      prisma.productOffer.count({ where }),
    ])

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

    // Cache for 60 seconds on CDN/browser — reduces DB hits on shared hosting
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120')

    return response
  } catch (error) {
    console.error('Error fetching offers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch offers' },
      { status: 500 }
    )
  }
}
