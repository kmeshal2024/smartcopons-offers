import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { storeSchema } from '@/lib/validators'

export async function GET() {
  try {
    await requireAdmin()
  } catch (error: any) {
    console.error('Stores auth error:', error?.message)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const stores = await prisma.store.findMany({
      orderBy: {
        name: 'asc',
      },
    })

    return NextResponse.json({ stores })
  } catch (error) {
    console.error('Stores fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch stores' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    const body = await request.json()
    const validation = storeSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      )
    }

    const store = await prisma.store.create({
      data: validation.data,
    })

    return NextResponse.json({ store }, { status: 201 })
  } catch (error) {
    console.error('Create store error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
