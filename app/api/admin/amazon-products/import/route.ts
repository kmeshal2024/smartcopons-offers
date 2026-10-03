import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { amazonProductSchema } from '@/lib/validators'
import { invalidateAmazon } from '@/lib/cache-invalidation'

/**
 * Bulk upsert by ASIN, for loading a hand-collected list in one go.
 *
 * Two ways in, like coupon-stats: the admin session or APP_SECRET.
 *
 *   curl -X POST https://sa.smartcopons.com/api/admin/amazon-products/import \
 *        -H "Authorization: Bearer $APP_SECRET" -H "Content-Type: application/json" \
 *        -d @products.json        # { "products": [{ "asin", "title", "category", ... }] }
 *
 * Upsert, not insert: re-sending a list updates titles/images/categories but
 * leaves `clicks` alone, and leaves `isActive` alone unless the item sends it,
 * so an import never wipes click history or re-enables a product switched off.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const importSchema = z.object({
  products: z.array(z.unknown()).min(1).max(200),
})

export async function POST(request: Request) {
  const secret = process.env.APP_SECRET
  const bearer = !!secret && request.headers.get('authorization') === `Bearer ${secret}`
  if (!bearer) {
    const session = await getSession().catch(() => null)
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const body = await request.json().catch(() => null)
  const parsed = importSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Expected { products: [...] } with 1 to 200 items' }, { status: 400 })
  }

  const results: Array<{ asin?: string; ok: boolean; created?: boolean; error?: string }> = []
  for (const raw of parsed.data.products) {
    const v = amazonProductSchema.safeParse(raw)
    if (!v.success) {
      results.push({ asin: (raw as any)?.asin, ok: false, error: v.error.errors[0]?.message })
      continue
    }
    const { isActive, ...fields } = v.data
    const sentActive = typeof (raw as any)?.isActive === 'boolean'
    try {
      const existing = await prisma.amazonProduct.findUnique({
        where: { asin: fields.asin },
        select: { id: true },
      })
      await prisma.amazonProduct.upsert({
        where: { asin: fields.asin },
        create: { ...fields, isActive },
        update: sentActive ? { ...fields, isActive } : fields,
      })
      results.push({ asin: fields.asin, ok: true, created: !existing })
    } catch (e: any) {
      results.push({ asin: fields.asin, ok: false, error: String(e?.message).slice(0, 160) })
    }
  }

  invalidateAmazon()
  return NextResponse.json({
    created: results.filter(r => r.ok && r.created).length,
    updated: results.filter(r => r.ok && !r.created).length,
    failed: results.filter(r => !r.ok),
  })
}
