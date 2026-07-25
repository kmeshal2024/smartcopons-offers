import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getOrCreateShopper, findShopper, isValidDeviceId } from '@/lib/shopper'

/**
 * Anonymous favourites, keyed by a device token the browser generates and keeps
 * in localStorage. Low-sensitivity data (saved deal ids), so the token alone is
 * the credential — acceptable until real login lands, at which point favourites
 * migrate to the email-linked shopper.
 */
export const dynamic = 'force-dynamic'

// GET /api/favorites?deviceId=…&full=1
//   default: just the saved product ids (so the client can fill in hearts)
//   full=1:  the saved products with data, for the /favorites page
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const deviceId = searchParams.get('deviceId') || ''
  const full = searchParams.get('full') === '1'

  if (!isValidDeviceId(deviceId)) return NextResponse.json({ ids: [], products: [] })

  const shopper = await findShopper(deviceId)
  if (!shopper) return NextResponse.json({ ids: [], products: [] })

  const favs = await prisma.favorite.findMany({
    where: { shopperId: shopper.id },
    orderBy: { createdAt: 'desc' },
    select: { productId: true },
  })
  const ids = favs.map(f => f.productId)

  if (!full) return NextResponse.json({ ids })

  // Resolve the saved ids to live products; ids with no row are dropped
  // silently (the offer was removed), which is the "expired" case.
  const products = ids.length
    ? await prisma.productOffer.findMany({
        where: { id: { in: ids }, isHidden: false },
        include: {
          supermarket: { select: { nameAr: true, slug: true, logo: true } },
          category: { select: { nameAr: true, icon: true } },
          flyer: { select: { startDate: true, endDate: true } },
        },
      })
    : []

  return NextResponse.json({ ids, products })
}

// POST /api/favorites  { deviceId, productId }
export async function POST(request: Request) {
  const { deviceId, productId } = (await request.json().catch(() => ({}))) as {
    deviceId?: string
    productId?: string
  }
  if (!isValidDeviceId(deviceId) || !productId) {
    return NextResponse.json({ error: 'deviceId and productId required' }, { status: 400 })
  }

  const shopper = await getOrCreateShopper(deviceId)
  await prisma.favorite.upsert({
    where: { shopperId_productId: { shopperId: shopper.id, productId } },
    update: {},
    create: { shopperId: shopper.id, productId },
  })
  return NextResponse.json({ ok: true, favorited: true })
}

// DELETE /api/favorites  { deviceId, productId }
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
    await prisma.favorite.deleteMany({ where: { shopperId: shopper.id, productId } })
  }
  return NextResponse.json({ ok: true, favorited: false })
}
