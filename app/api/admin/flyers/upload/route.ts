import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import path from 'path'
import fs from 'fs/promises'

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

    // Save file to disk
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'flyers')
    await fs.mkdir(uploadsDir, { recursive: true })

    const safeFilename = `${flyerId}-${Date.now()}.pdf`
    const filepath = path.join(uploadsDir, safeFilename)

    const buffer = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(filepath, buffer)

    // Update flyer record with file paths
    const pdfUrl = `/uploads/flyers/${safeFilename}`
    await prisma.flyer.update({
      where: { id: flyerId },
      data: {
        pdfPath: filepath,
        pdfUrl,
      },
    })

    return NextResponse.json({
      success: true,
      pdfUrl,
      pdfPath: filepath,
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
