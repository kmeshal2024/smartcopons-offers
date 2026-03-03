import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { FlyerIngestService } from '@/lib/services/flyer-ingest'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin()

    const flyer = await prisma.flyer.findUnique({
      where: { id: params.id },
      include: { supermarket: true },
    })

    if (!flyer) {
      return NextResponse.json({ error: 'Flyer not found' }, { status: 404 })
    }

    if (!flyer.pdfPath) {
      return NextResponse.json(
        { error: 'No PDF uploaded for this flyer. Upload a PDF first.' },
        { status: 400 }
      )
    }

    if (flyer.status === 'PROCESSING') {
      return NextResponse.json(
        { error: 'Extraction already in progress' },
        { status: 409 }
      )
    }

    // Start extraction (runs in background — don't await for long operations)
    const ingestService = new FlyerIngestService()

    // For small PDFs, run inline. For production, use a job queue.
    const result = await ingestService.ingestFlyer({
      flyerId: flyer.id,
      pdfPath: flyer.pdfPath,
      supermarketId: flyer.supermarketId,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    if (error?.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Extraction error:', error)
    return NextResponse.json(
      { error: error?.message || 'Extraction failed' },
      { status: 500 }
    )
  }
}
