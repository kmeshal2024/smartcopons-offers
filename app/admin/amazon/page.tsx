'use client'

import { useEffect, useState } from 'react'
import AdminNav from '@/components/AdminNav'
import { AMAZON_CATEGORIES, AMAZON_SA_TAG, amazonUrl, parseAsin } from '@/lib/amazon-catalog'

interface AmazonProduct {
  id: string
  asin: string
  title: string
  note: string | null
  imageUrl: string | null
  category: string
  isActive: boolean
  priority: number
  clicks: number
}

const EMPTY_FORM = {
  link: '',
  title: '',
  note: '',
  imageUrl: '',
  category: 'grocery' as string,
  isActive: true,
  priority: 0,
}

const categoryLabel = (slug: string) =>
  AMAZON_CATEGORIES.find(c => c.slug === slug)?.label ?? slug

export default function AdminAmazonPage() {
  const [products, setProducts] = useState<AmazonProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState(EMPTY_FORM)

  const asin = parseAsin(formData.link)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const res = await fetch('/api/admin/amazon-products')
      const data = await res.json()
      if (!res.ok) setError(data.error || 'Load failed')
      setProducts(data.products || [])
    } catch (e) {
      console.error('Failed to load Amazon products:', e)
    } finally {
      setLoading(false)
    }
  }

  const payloadOf = (p: Omit<AmazonProduct, 'id' | 'clicks'>) => ({
    asin: p.asin,
    title: p.title,
    note: p.note || null,
    imageUrl: p.imageUrl || null,
    category: p.category,
    isActive: p.isActive,
    priority: Number(p.priority) || 0,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!asin) {
      setError('Could not find an ASIN in that link. Paste the full amazon.sa product URL (not an amzn.to short link) or the 10-character ASIN.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch(
        editingId ? `/api/admin/amazon-products/${editingId}` : '/api/admin/amazon-products',
        {
          method: editingId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadOf({ ...formData, asin })),
        }
      )
      const data = await res.json()
      if (!res.ok) {
        setError(data.details?.[0]?.message || data.error || 'Save failed')
        return
      }
      setShowForm(false)
      setEditingId(null)
      setFormData(EMPTY_FORM)
      await loadData()
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (p: AmazonProduct) => {
    setEditingId(p.id)
    setFormData({
      link: p.asin,
      title: p.title,
      note: p.note ?? '',
      imageUrl: p.imageUrl ?? '',
      category: p.category,
      isActive: p.isActive,
      priority: p.priority,
    })
    setShowForm(true)
    setError('')
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this product permanently?')) return
    await fetch(`/api/admin/amazon-products/${id}`, { method: 'DELETE' })
    await loadData()
  }

  const handleToggle = async (p: AmazonProduct) => {
    await fetch(`/api/admin/amazon-products/${p.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadOf({ ...p, isActive: !p.isActive })),
    })
    await loadData()
  }

  const totalClicks = products.reduce((n, p) => n + p.clicks, 0)

  return (
    <div className="min-h-screen bg-gray-100">
      <AdminNav />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-2 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Amazon products</h1>
          <button
            onClick={() => {
              setShowForm(!showForm)
              setEditingId(null)
              setFormData(EMPTY_FORM)
              setError('')
            }}
            className="rounded bg-pink-600 px-4 py-2 text-white hover:bg-pink-700"
          >
            {showForm ? 'Close' : '+ Add product'}
          </button>
        </div>
        <p className="mb-6 text-sm text-gray-600">
          Tag <code className="rounded bg-white px-1">{AMAZON_SA_TAG}</code> is added to every link
          automatically. {products.length} products, {totalClicks} clicks.{' '}
          <a href="/amazon" target="_blank" className="text-pink-600 underline">
            View page
          </a>
        </p>

        {error && !showForm && <div className="mb-4 rounded bg-red-50 p-3 text-red-700">{error}</div>}

        {showForm && (
          <form onSubmit={handleSubmit} className="mb-8 grid gap-4 rounded-lg bg-white p-6 shadow md:grid-cols-2">
            <div className="text-lg font-bold md:col-span-2">
              {editingId ? 'Edit product' : 'New product'}
            </div>

            <label className="block md:col-span-2">
              <span className="text-sm font-medium">Amazon.sa link or ASIN</span>
              <input
                required
                value={formData.link}
                onChange={e => setFormData({ ...formData, link: e.target.value })}
                className="mt-1 w-full rounded border px-3 py-2 font-mono text-sm"
                placeholder="https://www.amazon.sa/dp/B0XXXXXXXX  or  B0XXXXXXXX"
                dir="ltr"
              />
              <span className={`mt-1 block text-xs ${asin ? 'text-green-700' : 'text-gray-500'}`}>
                {asin ? (
                  <>
                    ASIN {asin} → <span dir="ltr">{amazonUrl(asin)}</span>
                  </>
                ) : formData.link ? (
                  'No ASIN found yet. amzn.to short links hide it, so open the product and copy the full URL.'
                ) : (
                  'Paste the product URL from amazon.sa (SiteStripe links work too).'
                )}
              </span>
            </label>

            <label className="block md:col-span-2">
              <span className="text-sm font-medium">Title (Arabic, as a shopper would search it)</span>
              <input
                required
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                className="mt-1 w-full rounded border px-3 py-2"
                placeholder="حفاضات بامبرز مقاس 4، 64 حفاضة"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">Short note (optional)</span>
              <input
                value={formData.note}
                onChange={e => setFormData({ ...formData, note: e.target.value })}
                className="mt-1 w-full rounded border px-3 py-2"
                placeholder="الأكثر مبيعاً في الحفاضات"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">Category</span>
              <select
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
                className="mt-1 w-full rounded border px-3 py-2"
              >
                {AMAZON_CATEGORIES.map(c => (
                  <option key={c.slug} value={c.slug}>
                    {c.emoji} {c.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block md:col-span-2">
              <span className="text-sm font-medium">Image URL (optional, https)</span>
              <div className="mt-1 flex items-center gap-3">
                <input
                  type="url"
                  value={formData.imageUrl}
                  onChange={e => setFormData({ ...formData, imageUrl: e.target.value })}
                  className="w-full rounded border px-3 py-2 font-mono text-sm"
                  placeholder="https://m.media-amazon.com/images/I/....jpg"
                  dir="ltr"
                />
                {formData.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={formData.imageUrl} alt="" className="h-12 w-12 rounded border object-contain" />
                )}
              </div>
            </label>

            <label className="block">
              <span className="text-sm font-medium">Priority (higher shows first)</span>
              <input
                type="number"
                min={0}
                max={1000}
                value={formData.priority}
                onChange={e => setFormData({ ...formData, priority: Number(e.target.value) })}
                className="mt-1 w-full rounded border px-3 py-2"
              />
            </label>

            <label className="flex items-center gap-2 self-end pb-2">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
              />
              <span className="text-sm font-medium">Active</span>
            </label>

            {error && <div className="rounded bg-red-50 p-3 text-red-700 md:col-span-2">{error}</div>}

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded bg-pink-600 px-6 py-2 text-white hover:bg-pink-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : editingId ? 'Update' : 'Add'}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <p>Loading…</p>
        ) : products.length === 0 ? (
          <p className="text-gray-500">No products yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg bg-white shadow">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="p-3"></th>
                  <th className="p-3">Product</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Priority</th>
                  <th className="p-3">Clicks</th>
                  <th className="p-3">Status</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id} className={`border-t ${p.isActive ? '' : 'opacity-50'}`}>
                    <td className="p-3">
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imageUrl} alt="" className="h-12 w-12 object-contain" />
                      ) : (
                        <span className="text-2xl">📦</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="font-medium" dir="rtl">{p.title}</div>
                      <a
                        href={amazonUrl(p.asin)}
                        target="_blank"
                        rel="noopener"
                        className="font-mono text-xs text-pink-600 underline"
                      >
                        {p.asin}
                      </a>
                    </td>
                    <td className="p-3">{categoryLabel(p.category)}</td>
                    <td className="p-3">{p.priority}</td>
                    <td className="p-3">{p.clicks}</td>
                    <td className="p-3">
                      <button
                        onClick={() => handleToggle(p)}
                        className={`rounded px-2 py-1 text-xs ${p.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-200'}`}
                      >
                        {p.isActive ? 'Active' : 'Off'}
                      </button>
                    </td>
                    <td className="whitespace-nowrap p-3">
                      <button onClick={() => handleEdit(p)} className="mr-3 text-blue-600 hover:underline">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(p.id)} className="text-red-600 hover:underline">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
