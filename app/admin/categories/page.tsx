'use client'

import { useEffect, useState } from 'react'
import AdminNav from '@/components/AdminNav'

interface Category {
  id: string
  nameAr: string
  nameEn: string
  slug: string
  icon?: string
  order: number
  isActive: boolean
  parentId?: string
  _count: { products: number }
  children: {
    id: string
    nameAr: string
    nameEn: string
    slug: string
    icon?: string
    order: number
    isActive: boolean
    _count: { products: number }
  }[]
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    nameAr: '',
    nameEn: '',
    slug: '',
    icon: '',
    parentId: '',
    order: '0',
    isActive: true,
  })

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const res = await fetch('/api/admin/categories')
    const data = await res.json()
    setCategories(data.categories || [])
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      const method = editingId ? 'PUT' : 'POST'
      const url = editingId ? `/api/admin/categories/${editingId}` : '/api/admin/categories'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, order: parseInt(formData.order) }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to save')
        return
      }

      resetForm()
      loadData()
    } catch {
      setError('Failed to save category')
    }
  }

  const handleEdit = (cat: any) => {
    setFormData({
      nameAr: cat.nameAr,
      nameEn: cat.nameEn,
      slug: cat.slug,
      icon: cat.icon || '',
      parentId: cat.parentId || '',
      order: cat.order.toString(),
      isActive: cat.isActive,
    })
    setEditingId(cat.id)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this category?')) return
    await fetch(`/api/admin/categories/${id}`, { method: 'DELETE' })
    loadData()
  }

  const resetForm = () => {
    setFormData({ nameAr: '', nameEn: '', slug: '', icon: '', parentId: '', order: '0', isActive: true })
    setEditingId(null)
    setShowForm(false)
    setError('')
  }

  const autoSlug = (str: string) =>
    str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Categories</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
          >
            {showForm && !editingId ? 'Cancel' : 'Add Category'}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">{error}</div>
        )}

        {showForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">{editingId ? 'Edit Category' : 'Add New Category'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">الاسم (عربي) *</label>
                  <input
                    type="text"
                    value={formData.nameAr}
                    onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                    required dir="rtl"
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Name (English) *</label>
                  <input
                    type="text"
                    value={formData.nameEn}
                    onChange={(e) => {
                      const nameEn = e.target.value
                      setFormData(prev => ({
                        ...prev,
                        nameEn,
                        slug: prev.slug || autoSlug(nameEn),
                      }))
                    }}
                    required
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">Slug *</label>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    required
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Icon (emoji)</label>
                  <input
                    type="text"
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    placeholder="🥛 🥩 🥦"
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Order</label>
                  <input
                    type="number"
                    value={formData.order}
                    onChange={(e) => setFormData({ ...formData, order: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Parent Category (optional)</label>
                <select
                  value={formData.parentId}
                  onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">No parent (top-level)</option>
                  {categories.filter(c => !c.parentId).map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.nameAr} — {cat.nameEn}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="catActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                />
                <label htmlFor="catActive" className="text-sm font-semibold">Active</label>
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

        {/* Predefined categories quick-add */}
        {!showForm && categories.length === 0 && !loading && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-blue-800 font-semibold mb-2">Quick start: Add common supermarket categories</p>
            <p className="text-blue-700 text-sm">
              Suggested categories: 🥛 Dairy, 🥩 Meat & Poultry, 🥦 Vegetables, 🍎 Fruits, 🍞 Bakery, 🧴 Personal Care, 🧹 Household, ☕ Beverages, 🍫 Snacks
            </p>
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Icon</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Arabic Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">English Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Slug</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Products</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      No categories yet. Add some categories to organize products.
                    </td>
                  </tr>
                ) : categories.map(cat => (
                  <>
                    <tr key={cat.id} className="bg-gray-50">
                      <td className="px-6 py-3 text-lg">{cat.icon || '📦'}</td>
                      <td className="px-6 py-3 text-sm font-semibold" dir="rtl">{cat.nameAr}</td>
                      <td className="px-6 py-3 text-sm font-semibold">{cat.nameEn}</td>
                      <td className="px-6 py-3 text-sm font-mono text-gray-500">{cat.slug}</td>
                      <td className="px-6 py-3 text-sm">{cat._count.products}</td>
                      <td className="px-6 py-3 text-sm">
                        <span className={`px-2 py-1 rounded text-xs ${cat.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {cat.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm space-x-2">
                        <button onClick={() => handleEdit(cat)} className="text-blue-600 hover:underline">Edit</button>
                        <button onClick={() => handleDelete(cat.id)} className="text-red-600 hover:underline">Delete</button>
                      </td>
                    </tr>
                    {cat.children.map(child => (
                      <tr key={child.id}>
                        <td className="px-6 py-2 text-base pl-10">{child.icon || '└'}</td>
                        <td className="px-6 py-2 text-sm pl-10 text-gray-700" dir="rtl">{child.nameAr}</td>
                        <td className="px-6 py-2 text-sm text-gray-700">{child.nameEn}</td>
                        <td className="px-6 py-2 text-sm font-mono text-gray-400">{child.slug}</td>
                        <td className="px-6 py-2 text-sm">{child._count.products}</td>
                        <td className="px-6 py-2 text-sm">
                          <span className={`px-2 py-1 rounded text-xs ${child.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {child.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-2 text-sm space-x-2">
                          <button onClick={() => handleEdit(child)} className="text-blue-600 hover:underline">Edit</button>
                          <button onClick={() => handleDelete(child.id)} className="text-red-600 hover:underline">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
