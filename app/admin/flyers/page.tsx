'use client'

import { useEffect, useState } from 'react'
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
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState('')
  const [importingId, setImportingId] = useState<string | null>(null)
  const [productText, setProductText] = useState<Record<string, string>>({})
  const [importResult, setImportResult] = useState<Record<string, { created: number; errors: any[] } | null>>({})

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

      setSuccess('Flyer created! Now upload a PDF and add products.')
      setFormData({ supermarketId: '', title: '', titleAr: '', startDate: '', endDate: '' })
      setShowForm(false)
      loadFlyers()
    } catch {
      setError('Network error')
    }
  }

  const triggerUpload = (flyerId: string) => {
    const input = document.getElementById(`pdf-input-${flyerId}`) as HTMLInputElement
    if (input) input.click()
  }

  const handleUploadPDF = async (flyerId: string, file: File) => {
    setUploadingId(flyerId)
    setUploadProgress('Uploading...')
    setError('')

    try {
      if (file.size > 4 * 1024 * 1024) {
        setUploadProgress(`Uploading ${(file.size / 1024 / 1024).toFixed(1)}MB...`)
        const blob = await upload(`flyers/${flyerId}-${Date.now()}.pdf`, file, {
          access: 'public',
          handleUploadUrl: '/api/admin/flyers/upload',
        })
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
        const fd = new FormData()
        fd.append('pdf', file)
        fd.append('flyerId', flyerId)
        const res = await fetch('/api/admin/flyers/upload', { method: 'POST', body: fd })
        if (!res.ok) {
          const data = await res.json()
          setError(data.error || 'Upload failed')
          return
        }
      }
      setSuccess('PDF uploaded! You can now Publish the flyer.')
      loadFlyers()
    } catch (err: any) {
      setError('Upload failed: ' + (err?.message || 'Unknown error'))
    } finally {
      setUploadingId(null)
      setUploadProgress('')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this flyer and all its products?')) return
    await fetch(`/api/admin/flyers/${id}`, { method: 'DELETE' })
    loadFlyers()
  }

  const handleStatusChange = async (id: string, status: string) => {
    setError('')
    const res = await fetch(`/api/admin/flyers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      setSuccess(status === 'ACTIVE' ? 'Flyer published!' : `Status changed to ${status}`)
    }
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

  const toggleProducts = (id: string) => {
    setExpandedProducts(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Bulk product import for a flyer
  const handleImportProducts = async (flyerId: string) => {
    const text = productText[flyerId]?.trim()
    if (!text) return

    setImportingId(flyerId)
    setImportResult(prev => ({ ...prev, [flyerId]: null }))
    setError('')

    try {
      const lines = text.split('\n').filter(l => l.trim())
      // Skip header row if detected
      const firstLine = lines[0].toLowerCase()
      const startIdx = (firstLine.includes('name') || firstLine.includes('اسم') || firstLine.includes('price') || firstLine.includes('سعر')) ? 1 : 0

      const products: any[] = []
      for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue

        const parts = line.includes('\t') ? line.split('\t') : line.split(',')
        const trimmed = parts.map(p => p.trim())

        if (trimmed.length < 2) continue

        products.push({
          nameAr: trimmed[0],
          price: parseFloat(trimmed[1]) || 0,
          oldPrice: trimmed[2] ? parseFloat(trimmed[2]) || undefined : undefined,
          imageUrl: trimmed[3] || undefined,
          brand: trimmed[4] || undefined,
          sizeText: trimmed[5] || undefined,
        })
      }

      if (products.length === 0) {
        setError('No valid products found. Format: name, price, oldPrice, imageUrl')
        setImportingId(null)
        return
      }

      const res = await fetch(`/api/admin/flyers/${flyerId}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Import failed')
        setImportingId(null)
        return
      }

      setImportResult(prev => ({ ...prev, [flyerId]: data }))
      setSuccess(`${data.created} products added to flyer! Categories auto-assigned.`)
      setProductText(prev => ({ ...prev, [flyerId]: '' }))
      loadFlyers()
    } catch {
      setError('Import failed')
    } finally {
      setImportingId(null)
    }
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

        {/* How-to guide */}
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded mb-4 text-sm">
          <strong>How to add a flyer:</strong>
          <ol className="list-decimal list-inside mt-1 space-y-0.5">
            <li>Click &quot;New Flyer&quot; → select supermarket &amp; dates → Create</li>
            <li>Click &quot;Upload PDF&quot; (optional — shown to customers as browsable flyer)</li>
            <li>Click &quot;Add Products&quot; → paste product list (name, price per line) → categories auto-assigned</li>
            <li>Click &quot;Publish&quot; to make it live</li>
          </ol>
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
                      {flyer.pdfUrl && (
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-700">PDF</span>
                      )}
                    </div>
                    {flyer.titleAr && <p className="text-gray-500 text-sm" dir="rtl">{flyer.titleAr}</p>}
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                      <span>{flyer.supermarket.nameAr}</span>
                      <span>{formatDate(flyer.startDate)} - {formatDate(flyer.endDate)}</span>
                      <span className="font-semibold text-gray-800">{flyer._count.productOffers} products</span>
                      {flyer.totalPages > 0 && <span>{flyer.totalPages} pages</span>}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                    <input
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      id={`pdf-input-${flyer.id}`}
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) handleUploadPDF(flyer.id, file)
                        e.target.value = ''
                      }}
                    />

                    {/* Upload PDF */}
                    <button
                      onClick={() => triggerUpload(flyer.id)}
                      disabled={uploadingId === flyer.id}
                      className={`px-3 py-1.5 rounded text-sm disabled:opacity-50 ${
                        flyer.pdfUrl
                          ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          : 'bg-purple-600 text-white hover:bg-purple-700'
                      }`}
                    >
                      {uploadingId === flyer.id ? uploadProgress : flyer.pdfUrl ? 'Re-upload PDF' : 'Upload PDF'}
                    </button>

                    {flyer.pdfUrl && (
                      <a href={flyer.pdfUrl} target="_blank" rel="noopener" className="text-blue-600 hover:underline text-sm">
                        View PDF
                      </a>
                    )}

                    {/* Add Products */}
                    <button
                      onClick={() => toggleProducts(flyer.id)}
                      className={`px-3 py-1.5 rounded text-sm font-semibold ${
                        expandedProducts.has(flyer.id)
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700'
                      }`}
                    >
                      {expandedProducts.has(flyer.id) ? 'Hide Products Form' : 'Add Products'}
                    </button>

                    {/* Publish */}
                    {flyer.status !== 'ACTIVE' && flyer.status !== 'PROCESSING' && (
                      <button
                        onClick={() => handleStatusChange(flyer.id, 'ACTIVE')}
                        className="bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700 font-semibold"
                      >
                        Publish
                      </button>
                    )}

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

                    {flyer.extractionLog && (
                      <button
                        onClick={() => toggleLogs(flyer.id)}
                        className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded text-sm hover:bg-gray-200"
                      >
                        {expandedLogs.has(flyer.id) ? 'Hide Logs' : 'Logs'}
                      </button>
                    )}

                    <button
                      onClick={() => handleDelete(flyer.id)}
                      className="text-red-600 hover:text-red-800 px-2 py-1.5 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* === ADD PRODUCTS SECTION === */}
                {expandedProducts.has(flyer.id) && (
                  <div className="border-t bg-gray-50 p-5">
                    <h4 className="font-bold text-sm mb-2">
                      Add Products to: {flyer.title} ({flyer.supermarket.nameAr})
                    </h4>
                    <p className="text-xs text-gray-500 mb-3">
                      Paste products below — one per line. Format: <code className="bg-white px-1 rounded border">name, price, oldPrice, imageUrl, brand, size</code>.
                      Only <strong>name</strong> and <strong>price</strong> are required. Categories are auto-assigned based on keywords.
                    </p>
                    <textarea
                      value={productText[flyer.id] || ''}
                      onChange={e => setProductText(prev => ({ ...prev, [flyer.id]: e.target.value }))}
                      rows={8}
                      dir="rtl"
                      placeholder={`حليب المراعي كامل الدسم 1 لتر, 6.95, 8.50\nدجاج الوطنية مجمد 1200 جرام, 22.95, 27.50\nأرز بسمتي أبو كاس 5 كيلو, 42.95\nشيبس ليز 170 جم, 7.50, 9.95, https://example.com/image.jpg`}
                      className="w-full px-3 py-2 border rounded font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />

                    {/* Import result */}
                    {importResult[flyer.id] && (
                      <div className={`mt-3 p-3 rounded text-sm ${
                        importResult[flyer.id]!.created > 0
                          ? 'bg-green-50 border border-green-200 text-green-800'
                          : 'bg-yellow-50 border border-yellow-200 text-yellow-800'
                      }`}>
                        <strong>{importResult[flyer.id]!.created} products added!</strong>
                        {importResult[flyer.id]!.errors.length > 0 && (
                          <span className="ml-2 text-red-600">
                            {importResult[flyer.id]!.errors.length} errors
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleImportProducts(flyer.id)}
                        disabled={importingId === flyer.id || !productText[flyer.id]?.trim()}
                        className="bg-indigo-600 text-white px-5 py-2 rounded text-sm hover:bg-indigo-700 disabled:opacity-50 font-semibold"
                      >
                        {importingId === flyer.id ? 'Importing...' : 'Import Products'}
                      </button>
                      <button
                        onClick={() => {
                          setProductText(prev => ({ ...prev, [flyer.id]: '' }))
                          setImportResult(prev => ({ ...prev, [flyer.id]: null }))
                        }}
                        className="bg-gray-200 text-gray-700 px-4 py-2 rounded text-sm hover:bg-gray-300"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                )}

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
