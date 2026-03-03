import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    await requireAdmin()

    const body = await request.json()
    const { action, ids, flyerId } = body

    if (!action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 })
    }

    let result

    switch (action) {
      case 'show': {
        // Bulk show (un-hide) products
        const where = ids?.length ? { id: { in: ids } } : flyerId ? { flyerId } : null
        if (!where) return NextResponse.json({ error: 'Provide ids or flyerId' }, { status: 400 })
        result = await prisma.productOffer.updateMany({ where, data: { isHidden: false } })
        break
      }
      case 'hide': {
        const where = ids?.length ? { id: { in: ids } } : flyerId ? { flyerId } : null
        if (!where) return NextResponse.json({ error: 'Provide ids or flyerId' }, { status: 400 })
        result = await prisma.productOffer.updateMany({ where, data: { isHidden: true } })
        break
      }
      case 'delete': {
        if (!ids?.length) return NextResponse.json({ error: 'Provide ids' }, { status: 400 })
        result = await prisma.productOffer.deleteMany({ where: { id: { in: ids } } })
        break
      }
      case 'set-category': {
        const { categoryId } = body
        const where = ids?.length ? { id: { in: ids } } : flyerId ? { flyerId } : null
        if (!where) return NextResponse.json({ error: 'Provide ids or flyerId' }, { status: 400 })
        result = await prisma.productOffer.updateMany({
          where,
          data: { categoryId: categoryId || null },
        })
        break
      }
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    return NextResponse.json({ success: true, count: result.count })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Bulk action error:', error)
    return NextResponse.json({ error: 'Bulk action failed' }, { status: 500 })
  }
}
