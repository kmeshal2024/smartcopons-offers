import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * Backfill product images for a retailer.
 *
 * Carrefour's image URLs carry a per-product timestamp that can't be derived,
 * and its listing pages only fire the image request for rows the scroll
 * actually reaches — so a catalogue scrape lands around 40% coverage. The rest
 * have to be read from each product page, which is what
 * scripts/backfill-carrefour-images.mjs does using this endpoint:
 *
 *   GET  ?key=…&supermarket=carrefour&limit=200  → products still missing an image
 *   POST { key, images: [{ id, imageUrl }] }     → save what the script found
 *
 * Guarded by APP_SECRET, same as the other admin routes.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_BATCH = 500

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const key = searchParams.get('key')
  const slug = searchParams.get('supermarket')
  const limit = Math.min(parseInt(searchParams.get('limit') || '200'), MAX_BATCH)

  const appSecret = process.env.APP_SECRET
  if (!appSecret || key !== appSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!slug) return NextResponse.json({ error: 'supermarket is required' }, { status: 400 })

  const store = await prisma.supermarket.findUnique({ where: { slug }, select: { id: true } })
  if (!store) return NextResponse.json({ error: `Unknown supermarket: ${slug}` }, { status: 404 })

  const where = {
    supermarketId: store.id,
    isHidden: false,
    price: { gt: 0 },
    OR: [{ imageUrl: null }, { imageUrl: '' }],
  }

  const [products, remaining] = await Promise.all([
    prisma.productOffer.findMany({
      where,
      select: { id: true, sourceUrl: true, nameAr: true },
      take: limit,
      orderBy: { viewCount: 'desc' }, // most-viewed first: fix what shoppers see soonest
    }),
    prisma.productOffer.count({ where }),
  ])

  return NextResponse.json({ products, remaining })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const { key, images } = body as { key?: string; images?: { id: string; imageUrl: string }[] }

  const appSecret = process.env.APP_SECRET
  if (!appSecret || key !== appSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!Array.isArray(images) || images.length === 0) {
    return NextResponse.json({ error: 'images[] is required' }, { status: 400 })
  }
  if (images.length > MAX_BATCH) {
    return NextResponse.json({ error: `max ${MAX_BATCH} per request` }, { status: 413 })
  }

  let updated = 0
  for (const img of images) {
    if (!img?.id || !img?.imageUrl || !/^https?:\/\//.test(img.imageUrl)) continue
    try {
      await prisma.productOffer.update({
        where: { id: img.id },
        data: { imageUrl: img.imageUrl },
      })
      updated++
    } catch {
      // row may have been replaced by a newer scrape — skip it
    }
  }

  return NextResponse.json({ success: true, updated, received: images.length })
}
