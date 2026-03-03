import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { put } from '@vercel/blob'

export async function POST(request: Request) {
  try {
    await requireAdmin()

    const formData = await request.formData()
    const file = formData.get('pdf') as File | null
    const flyerId = formData.get('flyerId') as string | null

    if (!file || !flyerId) {
      return NextResponse.json(
        { error: 'Missing pdf file or flyerId' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!file.name.endsWith('.pdf') && file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Only PDF files are allowed' },
        { status: 400 }
      )
    }

    // Validate file size (max 20MB)
    const MAX_SIZE = 20 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum 20MB allowed.' },
        { status: 400 }
      )
    }

    // Verify flyer exists
    const flyer = await prisma.flyer.findUnique({ where: { id: flyerId } })
    if (!flyer) {
      return NextResponse.json({ error: 'Flyer not found' }, { status: 404 })
    }

    // Upload to Vercel Blob
    const filename = `flyers/${flyerId}-${Date.now()}.pdf`
    const blob = await put(filename, file, {
      access: 'public',
    })

    // Update flyer record with blob URL
    await prisma.flyer.update({
      where: { id: flyerId },
      data: {
        pdfPath: blob.url,
        pdfUrl: blob.url,
      },
    })

    return NextResponse.json({
      success: true,
      pdfUrl: blob.url,
      pdfPath: blob.url,
      size: file.size,
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
