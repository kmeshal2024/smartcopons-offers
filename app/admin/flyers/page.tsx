'use client'

import { useEffect, useState, useRef } from 'react'
import { upload } from '@vercel/blob/client'
import AdminNav from '@/components/AdminNav'

interface Supermarket {
  id: string
  name: string
  nameAr: string
}

interface Flyer {
  id: string
  title: string
  titleAr?: string
  status: string
  startDate: string
  endDate: string
  pdfUrl?: string
  pdfPath?: string
  coverImage?: string
  totalPages: number
  extractedAt?: string
  extractionLog?: string
  createdAt: string
  supermarket: { id: string; name: string; nameAr: string }
  _count: { productOffers: number }
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  PROCESSING: 'bg-yellow-100 text-yellow-700 animate-pulse',
  ACTIVE: 'bg-green-100 text-green-700',
  EXPIRED: 'bg-orange-100 text-orange-700',
  FAILED: 'bg-red-100 text-red-700',
}

export default function AdminFlyersPage() {
  const [flyers, setFlyers] = useState<Flyer[]>([])
  const [supermarkets, setSupermarkets] = useState<Supermarket[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set())
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [extractingId, setExtractingId] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState({
    supermarketId: '',
    title: '',
    titleAr: '',
    startDate: '',
    endDate: '',
  })

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/flyers').then(r => {
        if (r.status === 401) { window.location.href = '/admin/login'; return { flyers: [] } }
        return r.json()
      }),
      fetch('/api/admin/supermarkets').then(r => {
        if (r.status === 401) { window.location.href = '/admin/login'; return { supermarkets: [] } }
        return r.json()
      }),
    ]).then(([flyerData, smData]) => {
      setFlyers(flyerData.flyers || [])
      setSupermarkets(smData.supermarkets || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const loadFlyers = async () => {
    const res = await fetch('/api/admin/flyers')
    if (res.status === 401) { window.location.href = '/admin/login'; return }
    const data = await res.json()
    setFlyers(data.flyers || [])
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!formData.supermarketId || !formData.title || !formData.startDate || !formData.endDate) {
      setError('Fill all required fields')
      return
    }

    try {
      const res = await fetch('/api/admin/flyers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to create flyer')
        return
      }

      setSuccess('Flyer created. Now upload a PDF.')
      setFormData({ supermarketId: '', title: '', titleAr: '', startDate: '', endDate: '' })
      setShowForm(false)
      loadFlyers()
    } catch {
      setError('Network error')
    }
  }

  const handleUploadPDF = async (flyerId: string, file: File) => {
    setUploadingId(flyerId)
    setUploadProgress('Uploading...')
    setError('')

    try {
      // For files > 4MB, use client-side direct upload to Vercel Blob
      // This bypasses Vercel's serverless body size limit
      if (file.size > 4 * 1024 * 1024) {
        setUploadProgress(`Uploading ${(file.size / 1024 / 1024).toFixed(1)}MB directly...`)

        const blob = await upload(`flyers/${flyerId}-${Date.now()}.pdf`, file, {
          access: 'public',
          handleUploadUrl: '/api/admin/flyers/upload',
        })

        // Link the blob URL to the flyer record
        const linkRes = await fetch('/api/admin/flyers/upload', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ flyerId, blobUrl: blob.url }),
        })

        if (!linkRes.ok) {
          const linkData = await linkRes.json()
          setError(linkData.error || 'Failed to link uploaded file')
          return
        }
      } else {
        // Small files: use traditional server upload
        const formData = new FormData()
        formData.append('pdf', file)
        formData.append('flyerId', flyerId)

        const res = await fetch('/api/admin/flyers/upload', {
          method: 'POST',
          body: formData,
        })

        if (!res.ok) {
          const data = await res.json()
          setError(data.error || 'Upload failed')
          return
        }
      }

      setUploadProgress('Upload complete!')
      setSuccess('PDF uploaded successfully.')
      loadFlyers()
    } catch (err: any) {
      setError('Upload failed: ' + (err?.message || 'Unknown error'))
    } finally {
      setUploadingId(null)
      setUploadProgress('')
    }
  }

  const handleExtract = async (flyerId: string) => {
    setExtractingId(flyerId)
    setError('')
    setSuccess('')

    try {
      const res = await fetch(`/api/admin/flyers/${flyerId}/extract`, {
        method: 'POST',
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Extraction failed')
        return
      }

      setSuccess(`Extraction complete: ${data.productsSaved} products saved from ${data.totalPages} pages.`)
      loadFlyers()
    } catch {
      setError('Extraction failed')
    } finally {
      setExtractingId(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this flyer and all its products?')) return
    await fetch(`/api/admin/flyers/${id}`, { method: 'DELETE' })
    loadFlyers()
  }

  const handleStatusChange = async (id: string, status: string) => {
    await fetch(`/api/admin/flyers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    loadFlyers()
  }

  const toggleLogs = (id: string) => {
    setExpandedLogs(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-SA')

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Flyer Management</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
          >
            {showForm ? 'Cancel' : 'New Flyer'}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
            <button onClick={() => setError('')} className="float-right font-bold">x</button>
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">
            {success}
            <button onClick={() => setSuccess('')} className="float-right font-bold">x</button>
          </div>
        )}

        {/* Create Flyer Form */}
        {showForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">Create New Flyer</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">Supermarket *</label>
                  <select
                    value={formData.supermarketId}
                    onChange={e => setFormData({ ...formData, supermarketId: e.target.value })}
                    required
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select supermarket</option>
                    {supermarkets.map(sm => (
                      <option key={sm.id} value={sm.id}>{sm.nameAr} ({sm.name})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Title (English) *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    required
                    placeholder="e.g. Weekly Deals Mar 2026"
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">Title (Arabic)</label>
                  <input
                    type="text"
                    value={formData.titleAr}
                    onChange={e => setFormData({ ...formData, titleAr: e.target.value })}
                    dir="rtl"
                    placeholder="عروض الأسبوع"
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Start Date *</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                    required
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">End Date *</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                    required
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700">
                Create Flyer
              </button>
            </form>
          </div>
        )}

        {/* Flyers List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : flyers.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
            No flyers yet. Create one to get started.
          </div>
        ) : (
          <div className="space-y-4">
            {flyers.map(flyer => (
              <div key={flyer.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                {/* Flyer Header */}
                <div className="p-5 flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-bold text-lg truncate">{flyer.title}</h3>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${STATUS_COLORS[flyer.status] || ''}`}>
                        {flyer.status}
                      </span>
                    </div>
                    {flyer.titleAr && <p className="text-gray-500 text-sm" dir="rtl">{flyer.titleAr}</p>}
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                      <span>{flyer.supermarket.nameAr}</span>
                      <span>{formatDate(flyer.startDate)} - {formatDate(flyer.endDate)}</span>
                      <span>{flyer._count.productOffers} products</span>
                      <span>{flyer.totalPages} pages</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Upload PDF */}
                    {!flyer.pdfUrl && (
                      <>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".pdf"
                          className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0]
                            if (file) handleUploadPDF(flyer.id, file)
                            e.target.value = ''
                          }}
                        />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingId === flyer.id}
                          className="bg-purple-600 text-white px-3 py-1.5 rounded text-sm hover:bg-purple-700 disabled:opacity-50"
                        >
                          {uploadingId === flyer.id ? uploadProgress : 'Upload PDF'}
                        </button>
                      </>
                    )}

                    {/* Re-upload PDF */}
                    {flyer.pdfUrl && (
                      <>
                        <a
                          href={flyer.pdfUrl}
                          target="_blank"
                          rel="noopener"
                          className="text-blue-600 hover:underline text-sm"
                        >
                          View PDF
                        </a>
                        <input
                          type="file"
                          accept=".pdf"
                          className="hidden"
                          id={`reupload-${flyer.id}`}
                          onChange={e => {
                            const file = e.target.files?.[0]
                            if (file) handleUploadPDF(flyer.id, file)
                            e.target.value = ''
                          }}
                        />
                        <label
                          htmlFor={`reupload-${flyer.id}`}
                          className="bg-gray-200 text-gray-700 px-3 py-1.5 rounded text-sm hover:bg-gray-300 cursor-pointer"
                        >
                          Re-upload
                        </label>
                      </>
                    )}

                    {/* Extract Button */}
                    {flyer.pdfUrl && flyer.status !== 'PROCESSING' && (
                      <button
                        onClick={() => handleExtract(flyer.id)}
                        disabled={extractingId === flyer.id}
                        className="bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700 disabled:opacity-50"
                      >
                        {extractingId === flyer.id ? 'Extracting...' : 'Extract Products'}
                      </button>
                    )}

                    {/* Status Change */}
                    {flyer.status === 'ACTIVE' && (
                      <button
                        onClick={() => handleStatusChange(flyer.id, 'EXPIRED')}
                        className="bg-orange-500 text-white px-3 py-1.5 rounded text-sm hover:bg-orange-600"
                      >
                        Expire
                      </button>
                    )}
                    {flyer.status === 'EXPIRED' && (
                      <button
                        onClick={() => handleStatusChange(flyer.id, 'ACTIVE')}
                        className="bg-green-500 text-white px-3 py-1.5 rounded text-sm hover:bg-green-600"
                      >
                        Re-activate
                      </button>
                    )}

                    {/* Logs Toggle */}
                    {flyer.extractionLog && (
                      <button
                        onClick={() => toggleLogs(flyer.id)}
                        className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded text-sm hover:bg-gray-200"
                      >
                        {expandedLogs.has(flyer.id) ? 'Hide Logs' : 'Logs'}
                      </button>
                    )}

                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(flyer.id)}
                      className="text-red-600 hover:text-red-800 px-2 py-1.5 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Extraction Logs */}
                {expandedLogs.has(flyer.id) && flyer.extractionLog && (
                  <div className="border-t bg-gray-900 text-green-400 p-4 overflow-x-auto">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-gray-500 font-mono">EXTRACTION LOG</span>
                      {flyer.extractedAt && (
                        <span className="text-xs text-gray-500">
                          {new Date(flyer.extractedAt).toLocaleString('en-SA')}
                        </span>
                      )}
                    </div>
                    <pre className="text-xs font-mono whitespace-pre-wrap max-h-60 overflow-y-auto">
                      {flyer.extractionLog}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
