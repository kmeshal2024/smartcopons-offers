import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { CategoryMapper } from '@/lib/services/category-mapper'

/**
 * Re-run category matching over products already in the database.
 *
 * The keyword map was keyed by slugs that didn't exist ('fruits-vegetables',
 * 'bread-bakery', 'home-kitchen', 'canned-goods') while the real categories are
 * 'fruits', 'vegetables', 'bakery', 'household', 'canned-dry'. Every lookup for
 * those returned no keywords, so five categories sat at zero. Fixing the map
 * only helps future scrapes — the rows already stored need this pass.
 *
 * Runs in batches so it stays inside the function limit; call until `remaining`
 * reaches 0. APP_SECRET-guarded.
 *
 *   curl -X POST .../api/admin/recategorize -d '{"key":"…","limit":2000}'
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const { key, limit } = body as { key?: string; limit?: number }

  const appSecret = process.env.APP_SECRET
  if (!appSecret || key !== appSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const take = Math.min(limit || 2000, 5000)

  const mapper = new CategoryMapper()
  await mapper.initialize()

  // Only touch rows that have no category or sit in "uncategorized" — a product
  // a human or an earlier good match already placed shouldn't be second-guessed.
  const uncategorized = await prisma.category.findFirst({
    where: { slug: 'uncategorized' },
    select: { id: true },
  })
  const where = uncategorized
    ? { OR: [{ categoryId: null }, { categoryId: uncategorized.id }] }
    : { categoryId: null }

  const [products, remainingBefore] = await Promise.all([
    prisma.productOffer.findMany({
      where,
      select: { id: true, nameAr: true, nameEn: true },
      take,
    }),
    prisma.productOffer.count({ where }),
  ])

  // Group by resolved category so this is a handful of updateMany calls instead
  // of one round trip per product.
  const byCategory = new Map<string, string[]>()
  for (const p of products) {
    const catId = await mapper.mapToCategory(p.nameAr || p.nameEn || '')
    if (!catId || catId === uncategorized?.id) continue
    const list = byCategory.get(catId) || []
    list.push(p.id)
    byCategory.set(catId, list)
  }

  let updated = 0
  for (const [catId, ids] of Array.from(byCategory.entries())) {
    for (let i = 0; i < ids.length; i += 500) {
      const res = await prisma.productOffer.updateMany({
        where: { id: { in: ids.slice(i, i + 500) } },
        data: { categoryId: catId },
      })
      updated += res.count
    }
  }

  return NextResponse.json({
    success: true,
    scanned: products.length,
    updated,
    remaining: Math.max(0, remainingBefore - updated),
  })
}
