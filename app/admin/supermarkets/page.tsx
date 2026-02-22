'use client'

import { useEffect, useState } from 'react'
import AdminNav from '@/components/AdminNav'

interface Supermarket {
  id: string
  name: string
  nameAr: string
  slug: string
  logo?: string
  website?: string
  isActive: boolean
  _count: { flyers: number; productOffers: number }
}

export default function AdminSupermarketsPage() {
  const [supermarkets, setSupermarkets] = useState<Supermarket[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    name: '',
    nameAr: '',
    slug: '',
    logo: '',
    website: '',
    isActive: true,
  })

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const res = await fetch('/api/admin/supermarkets')
      const data = await res.json()
      setSupermarkets(data.supermarkets || [])
    } catch {
      setError('Failed to load supermarkets')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      const method = editingId ? 'PUT' : 'POST'
      const url = editingId
        ? `/api/admin/supermarkets/${editingId}`
        : '/api/admin/supermarkets'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to save')
        return
      }

      resetForm()
      loadData()
    } catch {
      setError('Failed to save supermarket')
    }
  }

  const handleEdit = (sm: Supermarket) => {
    setFormData({
      name: sm.name,
      nameAr: sm.nameAr,
      slug: sm.slug,
      logo: sm.logo || '',
      website: sm.website || '',
      isActive: sm.isActive,
    })
    setEditingId(sm.id)
    setShowForm(true)
    setError('')
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this supermarket? This will also delete all its products.')) return
    try {
      await fetch(`/api/admin/supermarkets/${id}`, { method: 'DELETE' })
      loadData()
    } catch {
      setError('Failed to delete')
    }
  }

  const resetForm = () => {
    setFormData({ name: '', nameAr: '', slug: '', logo: '', website: '', isActive: true })
    setEditingId(null)
    setShowForm(false)
    setError('')
  }

  const autoSlug = (name: string) => {
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Supermarkets</h1>
          <button
            onClick={() => { setShowForm(!showForm); setError('') }}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
          >
            {showForm && !editingId ? 'Cancel' : 'Add Supermarket'}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {showForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">
              {editingId ? 'Edit Supermarket' : 'Add New Supermarket'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">Name (English)</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => {
                      const name = e.target.value
                      setFormData(prev => ({
                        ...prev,
                        name,
                        slug: prev.slug || autoSlug(name),
                      }))
                    }}
                    required
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">الاسم (عربي)</label>
                  <input
                    type="text"
                    value={formData.nameAr}
                    onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                    required
                    dir="rtl"
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">Slug (URL)</label>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    required
                    placeholder="e.g., carrefour-sa"
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Website URL</label>
                  <input
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Logo URL</label>
                <input
                  type="text"
                  value={formData.logo}
                  onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                  placeholder="https://... or /logos/supermarket.png"
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="isActive" className="text-sm font-semibold">Active</label>
              </div>

              <div className="flex gap-2">
                <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700">
                  {editingId ? 'Update' : 'Create'}
                </button>
                <button type="button" onClick={resetForm} className="bg-gray-500 text-white px-6 py-2 rounded hover:bg-gray-600">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">اسم عربي</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Slug</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Flyers</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Products</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {supermarkets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      No supermarkets yet. Add one above.
                    </td>
                  </tr>
                ) : supermarkets.map(sm => (
                  <tr key={sm.id}>
                    <td className="px-6 py-4 text-sm font-medium">{sm.name}</td>
                    <td className="px-6 py-4 text-sm" dir="rtl">{sm.nameAr}</td>
                    <td className="px-6 py-4 text-sm font-mono text-gray-500">{sm.slug}</td>
                    <td className="px-6 py-4 text-sm">{sm._count.flyers}</td>
                    <td className="px-6 py-4 text-sm">{sm._count.productOffers}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2 py-1 rounded text-xs ${sm.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {sm.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm space-x-2">
                      <button onClick={() => handleEdit(sm)} className="text-blue-600 hover:underline">Edit</button>
                      <button onClick={() => handleDelete(sm.id)} className="text-red-600 hover:underline">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
