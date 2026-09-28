import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * Adds the three aisles the category rules already know about but the database
 * never had: frozen, baby care and electronics.
 *
 * Without them their products had to go somewhere else or nowhere. Ice cream
 * was filed under dairy — and, being heavily discounted, led the dairy page —
 * while diapers, phones and TVs had no category at all, which also left their
 * product pages without a "related offers" section.
 *
 * `order` continues after the existing ten, so the homepage (which shows the
 * first eight) is unchanged. Upsert by slug: safe to re-run, and it never
 * touches a category that already exists beyond re-activating it.
 *
 * After running this, re-run /api/admin/recategorize so existing offers move.
 *
 *   curl -X POST https://sa.smartcopons.com/api/admin/seed-categories \
 *        -H "Authorization: Bearer $APP_SECRET"
 */
export const dynamic = 'force-dynamic'

const CATEGORIES = [
  { slug: 'frozen', nameAr: 'المجمدات', nameEn: 'Frozen', icon: '🧊', order: 11 },
  { slug: 'baby-care', nameAr: 'مستلزمات الأطفال', nameEn: 'Baby care', icon: '🍼', order: 12 },
  { slug: 'electronics', nameAr: 'الإلكترونيات', nameEn: 'Electronics', icon: '📱', order: 13 },
]

export async function POST(request: Request) {
  const secret = process.env.APP_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = []
  for (const c of CATEGORIES) {
    const existed = await prisma.category.findUnique({ where: { slug: c.slug }, select: { id: true } })
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      create: { ...c, isActive: true },
      update: { isActive: true },
      select: { id: true, slug: true, nameAr: true, order: true, isActive: true },
    })
    results.push({ ...row, created: !existed })
  }

  const all = await prisma.category.findMany({
    where: { isActive: true },
    select: { slug: true, order: true },
    orderBy: { order: 'asc' },
  })
  return NextResponse.json({ results, activeCategories: all })
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method Not Allowed. Use POST with an Authorization: Bearer header.' },
    { status: 405, headers: { Allow: 'POST' } }
  )
}
