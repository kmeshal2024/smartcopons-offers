import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Arabic → English grocery keyword mapping for bilingual search
const AR_EN_MAP: Record<string, string[]> = {
  'حليب': ['milk', 'laban'],
  'لبن': ['milk', 'laban', 'yogurt'],
  'زبادي': ['yogurt', 'yoghurt'],
  'جبن': ['cheese', 'kashkawan'],
  'أرز': ['rice'],
  'رز': ['rice'],
  'دجاج': ['chicken'],
  'لحم': ['meat', 'beef', 'veal'],
  'سمك': ['fish', 'seafood', 'tuna', 'salmon'],
  'خبز': ['bread'],
  'بيض': ['egg'],
  'زيت': ['oil'],
  'سكر': ['sugar'],
  'ملح': ['salt'],
  'طحين': ['flour'],
  'معكرونة': ['pasta', 'macaroni', 'spaghetti'],
  'شاي': ['tea'],
  'قهوة': ['coffee'],
  'عصير': ['juice'],
  'ماء': ['water'],
  'مشروب': ['drink', 'beverage'],
  'بسكويت': ['biscuit', 'cookie'],
  'شوكولاتة': ['chocolate'],
  'شيبس': ['chips', 'crisp'],
  'تونة': ['tuna'],
  'فول': ['foul', 'fava', 'beans'],
  'حمص': ['hummus', 'chickpea'],
  'زيتون': ['olive'],
  'مكسرات': ['nuts', 'almond', 'cashew', 'pistachio'],
  'فواكه': ['fruit'],
  'خضار': ['vegetable'],
  'طماطم': ['tomato'],
  'بطاطس': ['potato', 'fries'],
  'بصل': ['onion'],
  'ثوم': ['garlic'],
  'تمر': ['dates'],
  'عسل': ['honey'],
  'مربى': ['jam'],
  'كاتشب': ['ketchup'],
  'صلصة': ['sauce'],
  'خل': ['vinegar'],
  'منظف': ['cleaner', 'detergent', 'cleaning'],
  'صابون': ['soap'],
  'شامبو': ['shampoo'],
  'مناديل': ['tissue', 'napkin'],
  'حفاضات': ['diaper', 'nappy'],
  'غسيل': ['laundry', 'wash'],
  'معجون': ['paste', 'toothpaste'],
  'كريم': ['cream'],
  'زبدة': ['butter'],
  'مثلجات': ['ice cream'],
  'مجمد': ['frozen'],
  'معلبات': ['canned', 'tinned'],
  'رقائق': ['cereal', 'flakes', 'corn flakes'],
  'نودلز': ['noodles'],
  'كيك': ['cake'],
  'سمن': ['ghee'],
}

// Expand Arabic search to include English equivalents
function expandArabicSearch(query: string): string[] {
  const terms = [query]
  const queryLower = query.trim()

  for (const [ar, enList] of Object.entries(AR_EN_MAP)) {
    if (queryLower.includes(ar)) {
      terms.push(...enList)
    }
  }

  return Array.from(new Set(terms))
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const supermarketId = searchParams.get('supermarket')
    const categoryId = searchParams.get('category')
    const cityId = searchParams.get('city')
    const search = searchParams.get('search')
    const minPrice = searchParams.get('minPrice')
    const maxPrice = searchParams.get('maxPrice')
    const sort = searchParams.get('sort') || 'newest'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '24')
    const skip = (page - 1) * limit

    // Build filters — enforce data quality baseline
    // No flyer status/date filter: quality filters are sufficient and
    // flyer expiry is too aggressive (weekly flyers expire old offers)
    const where: any = {
      isHidden: false,
      price: { gt: 0 },
      discountPercent: { gte: 5 },
      imageUrl: { not: null },
    }

    if (supermarketId) {
      where.supermarketId = supermarketId
    }

    if (categoryId) {
      where.categoryId = categoryId
    }

    if (cityId) {
      where.flyer = {
        ...(where.flyer || {}),
        cityId,
      }
    }

    if (search) {
      const searchTerms = expandArabicSearch(search)
      where.OR = searchTerms.flatMap(term => [
        { nameAr: { contains: term, mode: 'insensitive' } },
        { nameEn: { contains: term, mode: 'insensitive' } },
        { brand: { contains: term, mode: 'insensitive' } },
        { tags: { contains: term, mode: 'insensitive' } },
      ])
    }

    if (minPrice || maxPrice) {
      where.price = {}
      if (minPrice) where.price.gte = parseFloat(minPrice)
      if (maxPrice) where.price.lte = parseFloat(maxPrice)
    }

    // Build orderBy
    let orderBy: any = { createdAt: 'desc' }

    switch (sort) {
      case 'price-low':
        orderBy = { price: 'asc' }
        break
      case 'price-high':
        orderBy = { price: 'desc' }
        break
      case 'discount':
        orderBy = { discountPercent: { sort: 'desc', nulls: 'last' } }
        break
      case 'popular':
        orderBy = { viewCount: 'desc' }
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
