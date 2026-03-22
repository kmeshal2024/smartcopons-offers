import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Arabic → English grocery keyword mapping for bilingual search
const AR_EN_SEARCH: Record<string, string[]> = {
  'حليب': ['milk', 'laban'], 'لبن': ['milk', 'yogurt'], 'زبادي': ['yogurt'],
  'جبن': ['cheese'], 'أرز': ['rice'], 'رز': ['rice'], 'دجاج': ['chicken'],
  'لحم': ['meat', 'beef', 'veal'], 'سمك': ['fish', 'tuna', 'salmon'],
  'خبز': ['bread'], 'بيض': ['egg'], 'زيت': ['oil'], 'سكر': ['sugar'],
  'شاي': ['tea'], 'قهوة': ['coffee'], 'عصير': ['juice'], 'ماء': ['water'],
  'بسكويت': ['biscuit'], 'شوكولاتة': ['chocolate'], 'شيبس': ['chips'],
  'تونة': ['tuna'], 'فول': ['foul', 'beans'], 'حمص': ['hummus'],
  'زيتون': ['olive'], 'طماطم': ['tomato'], 'بطاطس': ['potato', 'fries'],
  'تمر': ['dates'], 'عسل': ['honey'], 'صلصة': ['sauce'], 'منظف': ['cleaner', 'detergent'],
  'صابون': ['soap'], 'شامبو': ['shampoo'], 'مناديل': ['tissue'],
  'حفاضات': ['diaper'], 'مجمد': ['frozen'], 'معكرونة': ['pasta'],
  'زبدة': ['butter'], 'مثلجات': ['ice cream'], 'مكسرات': ['nuts'],
}

function expandSearch(query: string): string[] {
  const terms = [query]
  for (const [ar, en] of Object.entries(AR_EN_SEARCH)) {
    if (query.includes(ar)) terms.push(...en)
  }
  return Array.from(new Set(terms))
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const type = searchParams.get('type') || 'all' // 'all' | 'products' | 'coupons'

    if (!query || query.length < 2) {
      return NextResponse.json({ products: [], coupons: [], total: 0 })
    }

    const searchTerms = expandSearch(query)
    const results: any = { products: [], coupons: [], total: 0 }

    if (type === 'all' || type === 'products') {
      const products = await prisma.productOffer.findMany({
        where: {
          isHidden: false,
          OR: searchTerms.flatMap(term => [
            { nameAr: { contains: term, mode: 'insensitive' as const } },
            { nameEn: { contains: term, mode: 'insensitive' as const } },
            { brand: { contains: term, mode: 'insensitive' as const } },
            { tags: { contains: term, mode: 'insensitive' as const } },
          ]),
        },
        take: 10,
        orderBy: { viewCount: 'desc' },
        include: {
          supermarket: {
            select: {
              id: true,
              nameAr: true,
              slug: true,
              logo: true,
            },
          },
          category: {
            select: {
              nameAr: true,
              icon: true,
            },
          },
        },
      })
      results.products = products
    }

    if (type === 'all' || type === 'coupons') {
      const coupons = await prisma.coupon.findMany({
        where: {
          isActive: true,
          OR: [
            { title: { contains: query } },
            { code: { contains: query } },
            { discountText: { contains: query } },
            { store: { name: { contains: query } } },
          ],
        },
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          store: {
            select: {
              name: true,
              slug: true,
              logo: true,
            },
          },
        },
      })
      results.coupons = coupons
    }

    results.total = results.products.length + results.coupons.length

    return NextResponse.json(results)
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    )
  }
}
