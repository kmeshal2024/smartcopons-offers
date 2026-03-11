import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { bulkCouponSchema } from '@/lib/validators'

export async function POST(request: Request) {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const parsed = bulkCouponSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.errors },
        { status: 400 }
      )
    }

    const { coupons } = parsed.data
    const errors: { index: number; message: string }[] = []
    const storesCreated: string[] = []
    let created = 0

    // Resolve store names to IDs, auto-creating as needed
    const storeCache = new Map<string, string>()

    for (let i = 0; i < coupons.length; i++) {
      const item = coupons[i]
      const storeKey = item.storeName.trim().toLowerCase()

      try {
        let storeId = storeCache.get(storeKey)

        if (!storeId) {
          // Look up existing store (case-insensitive)
          let store = await prisma.store.findFirst({
            where: { name: { equals: item.storeName.trim(), mode: 'insensitive' } },
          })

          if (!store) {
            // Auto-create store
            const slug = item.storeName
              .trim()
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '')

            store = await prisma.store.create({
              data: { name: item.storeName.trim(), slug },
            })
            storesCreated.push(store.name)
          }

          storeCache.set(storeKey, store.id)
          storeId = store.id
        }

        await prisma.coupon.create({
          data: {
            title: item.title,
            code: item.code,
            discountText: item.discountText,
            url: item.url || '#',
            description: item.description || null,
            storeId,
            isActive: item.isActive ?? true,
          },
        })
        created++
      } catch (err: any) {
        errors.push({ index: i, message: err.message || 'Unknown error' })
      }
    }

    return NextResponse.json({ created, errors, storesCreated })
  } catch (err: any) {
    console.error('Bulk coupon import error:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
