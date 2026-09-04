import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { bannerSchema } from '@/lib/validators'
import { invalidateBanners } from '@/lib/cache-invalidation'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const banners = await prisma.banner.findMany({
      orderBy: [{ isActive: 'desc' }, { placement: 'asc' }, { priority: 'desc' }],
    })
    return NextResponse.json({ banners })
  } catch (error) {
    console.error('Banners fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch banners' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    const body = await request.json()
    const validation = bannerSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      )
    }

    const banner = await prisma.banner.create({ data: validation.data })
    invalidateBanners()
    return NextResponse.json({ banner }, { status: 201 })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Create banner error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
