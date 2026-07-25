import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { arabicContainsFilter } from '@/lib/arabic-search'
import { getOrCreateShopper, findShopper, isValidDeviceId } from '@/lib/shopper'

/**
 * Price watches. A shopper watches a product; we remember the price then, and
 * on read we find the cheapest CURRENT offer for the same item (matched by name,
 * so it survives the offer row being replaced each flyer) and flag a drop.
 *
 * Delivery is in-app for now (the GET returns `dropped`); push notifications are
 * a later phase. Keyed by the same anonymous device token as favourites.
 */
export const dynamic = 'force-dynamic'

const MAX_WATCHES = 100

/** Cheapest live price for the same item, matched by Arabic-variant name. */
async function currentBestPrice(nameKey: string): Promise<number | null> {
  const term = nameKey.trim().slice(0, 60)
  if (term.length < 4) return null
  const row = await prisma.productOffer.findFirst({
    where: {
      isHidden: false,
      price: { gt: 0 },
      flyer: { endDate: { gte: new Date() } },
      OR: arabicContainsFilter(term, ['nameAr', 'nameEn']),
    },
    orderBy: { price: 'asc' },
    select: { price: true },
  })
  return row?.price ?? null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const deviceId = searchParams.get('deviceId') || ''
  if (!isValidDeviceId(deviceId)) return NextResponse.json({ watches: [] })

  const shopper = await findShopper(deviceId)
  if (!shopper) return NextResponse.json({ watches: [] })

  const watches = await prisma.priceWatch.findMany({
    where: { shopperId: shopper.id },
    orderBy: { createdAt: 'desc' },
  })

  // Resolve display data (name/image/store) for the products still present.
  const productIds = watches.map(w => w.productId)
  const products = productIds.length
    ? await prisma.productOffer.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          nameAr: true,
          imageUrl: true,
          supermarket: { select: { nameAr: true, slug: true, logo: true } },
        },
      })
    : []
  const byId = new Map(products.map(p => [p.id, p]))

  const enriched = await Promise.all(
    watches.map(async w => {
      const current = await currentBestPrice(w.nameKey)
      const threshold = w.targetPrice ?? w.basePrice
      const dropped = current != null && current < threshold
      return {
        productId: w.productId,
        name: byId.get(w.productId)?.nameAr || w.nameKey,
        imageUrl: byId.get(w.productId)?.imageUrl || null,
        store: byId.get(w.productId)?.supermarket || null,
        basePrice: w.basePrice,
        targetPrice: w.targetPrice,
        currentPrice: current,
        dropped,
      }
    })
  )

  return NextResponse.json({ watches: enriched })
}

// POST /api/watches  { deviceId, productId, targetPrice? }
export async function POST(request: Request) {
  const { deviceId, productId, targetPrice } = (await request.json().catch(() => ({}))) as {
    deviceId?: string
    productId?: string
    targetPrice?: number
  }
  if (!isValidDeviceId(deviceId) || !productId) {
    return NextResponse.json({ error: 'deviceId and productId required' }, { status: 400 })
  }

  const product = await prisma.productOffer.findFirst({
    where: { id: productId, price: { gt: 0 } },
    select: { nameAr: true, nameEn: true, price: true },
  })
  if (!product) return NextResponse.json({ error: 'product not found' }, { status: 404 })

  const shopper = await getOrCreateShopper(deviceId)
  const count = await prisma.priceWatch.count({ where: { shopperId: shopper.id } })
  if (count >= MAX_WATCHES) {
    return NextResponse.json({ error: `الحد الأقصى ${MAX_WATCHES} منتجاً للمتابعة` }, { status: 429 })
  }

  const nameKey = (product.nameAr || product.nameEn || '').trim()
  await prisma.priceWatch.upsert({
    where: { shopperId_productId: { shopperId: shopper.id, productId } },
    update: { targetPrice: targetPrice ?? null },
    create: {
      shopperId: shopper.id,
      productId,
      nameKey,
      basePrice: product.price,
      targetPrice: targetPrice ?? null,
    },
  })
  return NextResponse.json({ ok: true, watching: true })
}

// DELETE /api/watches  { deviceId, productId }
export async function DELETE(request: Request) {
  const { deviceId, productId } = (await request.json().catch(() => ({}))) as {
    deviceId?: string
    productId?: string
  }
  if (!isValidDeviceId(deviceId) || !productId) {
    return NextResponse.json({ error: 'deviceId and productId required' }, { status: 400 })
  }
  const shopper = await findShopper(deviceId)
  if (shopper) {
    await prisma.priceWatch.deleteMany({ where: { shopperId: shopper.id, productId } })
  }
  return NextResponse.json({ ok: true, watching: false })
}
