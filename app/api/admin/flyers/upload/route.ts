import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { put } from '@vercel/blob'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'

// Client-side upload handler (for large files)
// The client calls this to get an upload token, then uploads directly to Blob
export async function POST(request: Request) {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const contentType = request.headers.get('content-type') || ''

  // Handle client upload token request (JSON body)
  if (contentType.includes('application/json')) {
    try {
      const body = (await request.json()) as HandleUploadBody
      const jsonResponse = await handleUpload({
        body,
        request,
        onBeforeGenerateToken: async (pathname) => {
          // Validate file is PDF
          if (!pathname.endsWith('.pdf')) {
            throw new Error('Only PDF files are allowed')
          }
          return {
            allowedContentTypes: ['application/pdf'],
            maximumSizeInBytes: 50 * 1024 * 1024, // 50MB for flyers
          }
        },
        onUploadCompleted: async ({ blob }) => {
          // This runs after upload completes
          console.log('Blob upload completed:', blob.url)
        },
      })
      return NextResponse.json(jsonResponse)
    } catch (error: any) {
      console.error('Client upload error:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
  }

  // Handle traditional multipart upload (for small files / backward compat)
  try {
    const formData = await request.formData()
    const file = formData.get('pdf') as File | null
    const flyerId = formData.get('flyerId') as string | null

    if (!file || !flyerId) {
      return NextResponse.json(
        { error: 'Missing pdf file or flyerId' },
        { status: 400 }
      )
    }

    if (!file.name.endsWith('.pdf') && file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Only PDF files are allowed' },
        { status: 400 }
      )
    }

    const MAX_SIZE = 20 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 20MB for server upload. Try the page again for large files.` },
        { status: 400 }
      )
    }

    const flyer = await prisma.flyer.findUnique({ where: { id: flyerId } })
    if (!flyer) {
      return NextResponse.json({ error: 'Flyer not found' }, { status: 404 })
    }

    const filename = `flyers/${flyerId}-${Date.now()}.pdf`
    const blob = await put(filename, file, { access: 'public' })

    await prisma.flyer.update({
      where: { id: flyerId },
      data: { pdfPath: blob.url, pdfUrl: blob.url },
    })

    return NextResponse.json({
      success: true,
      pdfUrl: blob.url,
      pdfPath: blob.url,
      size: file.size,
    })
  } catch (error: any) {
    const msg = error?.message || String(error)
    console.error('Upload error:', msg)
    if (msg.includes('BODY_TOO_LARGE') || msg.includes('413') || msg.includes('body size')) {
      return NextResponse.json(
        { error: 'File too large for server upload. The page will retry with direct upload.' },
        { status: 413 }
      )
    }
    return NextResponse.json({ error: `Upload failed: ${msg.substring(0, 200)}` }, { status: 500 })
  }
}

// Link blob URL to flyer (called after client-side upload completes)
export async function PUT(request: Request) {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { flyerId, blobUrl } = await request.json()
    if (!flyerId || !blobUrl) {
      return NextResponse.json({ error: 'Missing flyerId or blobUrl' }, { status: 400 })
    }

    const flyer = await prisma.flyer.findUnique({ where: { id: flyerId } })
    if (!flyer) {
      return NextResponse.json({ error: 'Flyer not found' }, { status: 404 })
    }

    await prisma.flyer.update({
      where: { id: flyerId },
      data: { pdfPath: blobUrl, pdfUrl: blobUrl },
    })

    return NextResponse.json({ success: true, pdfUrl: blobUrl })
  } catch (error: any) {
    console.error('Link blob error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
