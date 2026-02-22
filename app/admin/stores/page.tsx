'use client'

import { useEffect, useState } from 'react'
import AdminNav from '@/components/AdminNav'

interface Store {
  id: string
  name: string
  slug: string
  logo?: string
  website?: string
}

export default function AdminStoresPage() {
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    logo: '',
    website: '',
  })

  useEffect(() => {
    loadStores()
  }, [])

  const loadStores = async () => {
    try {
      const res = await fetch('/api/admin/stores')
      const data = await res.json()
      setStores(data.stores || [])
    } catch (error) {
      console.error('Failed to load stores:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      if (editingId) {
        await fetch(`/api/admin/stores/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })
      } else {
        await fetch('/api/admin/stores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })
      }
      
      resetForm()
      loadStores()
    } catch (error) {
      alert('Failed to save store')
    }
  }

  const handleEdit = (store: Store) => {
    setFormData({
      name: store.name,
      slug: store.slug,
      logo: store.logo || '',
      website: store.website || '',
    })
    setEditingId(store.id)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure? This will delete all associated coupons.')) return
    
    try {
      await fetch(`/api/admin/stores/${id}`, { method: 'DELETE' })
      loadStores()
    } catch (error) {
      alert('Failed to delete store')
    }
  }

  const resetForm = () => {
    setFormData({ name: '', slug: '', logo: '', website: '' })
    setEditingId(null)
    setShowForm(false)
  }

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      
      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Manage Stores</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
          >
            {showForm ? 'Cancel' : 'Add New Store'}
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">
              {editingId ? 'Edit Store' : 'Add New Store'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value })
                    if (!editingId) {
                      setFormData({ ...formData, name: e.target.value, slug: generateSlug(e.target.value) })
                    }
                  }}
                  required
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Slug</label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  required
                  pattern="[a-z0-9-]+"
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Lowercase letters, numbers, and hyphens only</p>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Logo URL (optional)</label>
                <input
                  type="url"
                  value={formData.logo}
                  onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Website URL (optional)</label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700"
                >
                  {editingId ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="bg-gray-500 text-white px-6 py-2 rounded hover:bg-gray-600"
                >
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Slug</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Website</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stores.map((store) => (
                  <tr key={store.id}>
                    <td className="px-6 py-4 text-sm font-medium">{store.name}</td>
                    <td className="px-6 py-4 text-sm font-mono text-gray-600">{store.slug}</td>
                    <td className="px-6 py-4 text-sm">
                      {store.website && (
                        <a href={store.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          Visit
                        </a>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm space-x-2">
                      <button
                        onClick={() => handleEdit(store)}
                        className="text-blue-600 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(store.id)}
                        className="text-red-600 hover:underline"
                      >
                        Delete
                      </button>
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
