'use client'

import { useEffect, useState } from 'react'
import AdminNav from '@/components/AdminNav'

interface Banner {
  id: string
  title: string
  imageUrl: string
  targetUrl: string
  placement: string
  country: string
  isActive: boolean
  startsAt: string | null
  endsAt: string | null
  priority: number
  width: number | null
  height: number | null
  impressions: number
  clicks: number
}

const PLACEMENTS = [
  { value: 'home_top', label: 'Home — top (under hero)' },
  { value: 'home_middle', label: 'Home — middle (before latest)' },
  { value: 'offers', label: 'Offers pages' },
  { value: 'coupons', label: 'Coupons page' },
  { value: 'flyers', label: 'Flyer pages' },
  { value: 'product', label: 'Product pages' },
  { value: 'stores', label: 'Stores directory' },
]

const EMPTY_FORM = {
  title: '',
  imageUrl: '',
  targetUrl: '',
  placement: 'home_top',
  country: 'SA',
  isActive: true,
  startsAt: '',
  endsAt: '',
  priority: 0,
  width: '' as string | number,
  height: '' as string | number,
}

// <input type="datetime-local"> wants "YYYY-MM-DDTHH:mm" in local time.
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState(EMPTY_FORM)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const res = await fetch('/api/admin/banners')
      const data = await res.json()
      setBanners(data.banners || [])
    } catch (e) {
      console.error('Failed to load banners:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async (file: File) => {
    setUploading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', 'banners')
      const res = await fetch('/api/admin/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.url) {
        setFormData(f => ({ ...f, imageUrl: data.url }))
      } else {
        setError(data.error || 'Upload failed (Blob may be unavailable — paste an image URL instead)')
      }
    } catch {
      setError('Upload failed (Blob may be unavailable — paste an image URL instead)')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        ...formData,
        priority: Number(formData.priority) || 0,
        startsAt: formData.startsAt ? new Date(formData.startsAt).toISOString() : null,
        endsAt: formData.endsAt ? new Date(formData.endsAt).toISOString() : null,
        width: formData.width === '' ? null : Number(formData.width),
        height: formData.height === '' ? null : Number(formData.height),
      }
      const res = await fetch(
        editingId ? `/api/admin/banners/${editingId}` : '/api/admin/banners',
        {
          method: editingId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
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

  const handleEdit = (b: Banner) => {
    setEditingId(b.id)
    setFormData({
      title: b.title,
      imageUrl: b.imageUrl,
      targetUrl: b.targetUrl,
      placement: b.placement,
      country: b.country,
      isActive: b.isActive,
      startsAt: toLocalInput(b.startsAt),
      endsAt: toLocalInput(b.endsAt),
      priority: b.priority,
      width: b.width ?? '',
      height: b.height ?? '',
    })
    setShowForm(true)
    setError('')
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this banner permanently?')) return
    await fetch(`/api/admin/banners/${id}`, { method: 'DELETE' })
    await loadData()
  }

  const handleToggle = async (b: Banner) => {
    await fetch(`/api/admin/banners/${b.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: b.title,
        imageUrl: b.imageUrl,
        targetUrl: b.targetUrl,
        placement: b.placement,
        country: b.country,
        isActive: !b.isActive,
        startsAt: b.startsAt,
        endsAt: b.endsAt,
        priority: b.priority,
        width: b.width,
        height: b.height,
      }),
    })
    await loadData()
  }

  const ctr = (b: Banner) =>
    b.impressions > 0 ? `${((b.clicks / b.impressions) * 100).toFixed(2)}%` : '—'

  return (
    <div className="min-h-screen bg-gray-100">
      <AdminNav />
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Ad Banners</h1>
          <button
            onClick={() => {
              setShowForm(!showForm)
              setEditingId(null)
              setFormData(EMPTY_FORM)
              setError('')
            }}
            className="bg-pink-600 text-white px-4 py-2 rounded hover:bg-pink-700"
          >
            {showForm ? 'Close' : '+ New Banner'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 mb-8 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2 font-bold text-lg">
              {editingId ? 'Edit banner' : 'New banner'}
            </div>

            <label className="block">
              <span className="text-sm font-medium">Title (also the alt text)</span>
              <input
                required
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                className="mt-1 w-full border rounded px-3 py-2"
                placeholder="خصم 10% على طلبك الأول من نعناع"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">Target URL (affiliate link)</span>
              <input
                required
                type="url"
                value={formData.targetUrl}
                onChange={e => setFormData({ ...formData, targetUrl: e.target.value })}
                className="mt-1 w-full border rounded px-3 py-2"
                placeholder="https://..."
              />
            </label>

            <label className="block md:col-span-2">
              <span className="text-sm font-medium">Image URL</span>
              <div className="flex gap-2 mt-1">
                <input
                  required
                  type="url"
                  value={formData.imageUrl}
                  onChange={e => setFormData({ ...formData, imageUrl: e.target.value })}
                  className="flex-1 border rounded px-3 py-2"
                  placeholder="https://... (paste a URL or upload)"
                />
                <label className="bg-gray-200 px-4 py-2 rounded cursor-pointer hover:bg-gray-300 whitespace-nowrap">
                  {uploading ? 'Uploading…' : 'Upload'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])}
                  />
                </label>
              </div>
            </label>

            {formData.imageUrl && (
              <div className="md:col-span-2 border rounded p-2 bg-gray-50">
                <img src={formData.imageUrl} alt="preview" className="max-h-40 mx-auto" />
              </div>
            )}

            <label className="block">
              <span className="text-sm font-medium">Placement</span>
              <select
                value={formData.placement}
                onChange={e => setFormData({ ...formData, placement: e.target.value })}
                className="mt-1 w-full border rounded px-3 py-2"
              >
                {PLACEMENTS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium">Country</span>
              <select
                value={formData.country}
                onChange={e => setFormData({ ...formData, country: e.target.value })}
                className="mt-1 w-full border rounded px-3 py-2"
              >
                <option value="SA">Saudi Arabia (SA)</option>
                <option value="AE">United Arab Emirates (AE)</option>
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium">Starts at (optional)</span>
              <input
                type="datetime-local"
                value={formData.startsAt}
                onChange={e => setFormData({ ...formData, startsAt: e.target.value })}
                className="mt-1 w-full border rounded px-3 py-2"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">Ends at (optional)</span>
              <input
                type="datetime-local"
                value={formData.endsAt}
                onChange={e => setFormData({ ...formData, endsAt: e.target.value })}
                className="mt-1 w-full border rounded px-3 py-2"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">Priority (highest wins the slot)</span>
              <input
                type="number"
                min={0}
                max={1000}
                value={formData.priority}
                onChange={e => setFormData({ ...formData, priority: Number(e.target.value) })}
                className="mt-1 w-full border rounded px-3 py-2"
              />
            </label>

            <div className="flex gap-4">
              <label className="block flex-1">
                <span className="text-sm font-medium">Width px (optional)</span>
                <input
                  type="number"
                  min={1}
                  value={formData.width}
                  onChange={e => setFormData({ ...formData, width: e.target.value })}
                  className="mt-1 w-full border rounded px-3 py-2"
                />
              </label>
              <label className="block flex-1">
                <span className="text-sm font-medium">Height px (optional)</span>
                <input
                  type="number"
                  min={1}
                  value={formData.height}
                  onChange={e => setFormData({ ...formData, height: e.target.value })}
                  className="mt-1 w-full border rounded px-3 py-2"
                />
              </label>
            </div>

            <label className="flex items-center gap-2 md:col-span-2">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
              />
              <span className="text-sm font-medium">Active</span>
            </label>

            {error && <div className="md:col-span-2 text-red-600 text-sm">{error}</div>}

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={saving || uploading}
                className="bg-pink-600 text-white px-6 py-2 rounded hover:bg-pink-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : editingId ? 'Update banner' : 'Create banner'}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <p>Loading…</p>
        ) : banners.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            No banners yet. Create the first one — affiliate creatives from
            AliExpress / iHerb are a good start while network approvals are pending.
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="p-3">Preview</th>
                  <th className="p-3">Title</th>
                  <th className="p-3">Placement</th>
                  <th className="p-3">Country</th>
                  <th className="p-3">Priority</th>
                  <th className="p-3">Schedule</th>
                  <th className="p-3">Impr.</th>
                  <th className="p-3">Clicks</th>
                  <th className="p-3">CTR</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {banners.map(b => (
                  <tr key={b.id} className="border-t">
                    <td className="p-3">
                      <img src={b.imageUrl} alt={b.title} className="h-10 max-w-[120px] object-contain" />
                    </td>
                    <td className="p-3 max-w-[200px] truncate" title={b.title}>{b.title}</td>
                    <td className="p-3">{b.placement}</td>
                    <td className="p-3">{b.country}</td>
                    <td className="p-3">{b.priority}</td>
                    <td className="p-3 text-xs text-gray-500">
                      {b.startsAt ? new Date(b.startsAt).toLocaleDateString() : '∞'}
                      {' → '}
                      {b.endsAt ? new Date(b.endsAt).toLocaleDateString() : '∞'}
                    </td>
                    <td className="p-3">{b.impressions.toLocaleString()}</td>
                    <td className="p-3">{b.clicks.toLocaleString()}</td>
                    <td className="p-3">{ctr(b)}</td>
                    <td className="p-3">
                      <button
                        onClick={() => handleToggle(b)}
                        className={
                          b.isActive
                            ? 'bg-green-100 text-green-700 px-2 py-1 rounded text-xs'
                            : 'bg-gray-100 text-gray-500 px-2 py-1 rounded text-xs'
                        }
                      >
                        {b.isActive ? 'Active' : 'Off'}
                      </button>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <button onClick={() => handleEdit(b)} className="text-blue-600 hover:underline mr-3">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(b.id)} className="text-red-600 hover:underline">
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
