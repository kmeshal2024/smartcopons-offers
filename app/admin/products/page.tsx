'use client'

import { useEffect, useState } from 'react'
import AdminNav from '@/components/AdminNav'

interface Product {
  id: string
  nameAr?: string
  nameEn?: string
  brand?: string
  price: number
  oldPrice?: number
  discountPercent?: number
  sizeText?: string
  imageUrl?: string
  isHidden: boolean
  supermarket: { nameAr: string }
  category?: { nameAr: string }
  flyer?: { title: string; endDate: string }
}

interface Supermarket {
  id: string
  nameAr: string
}

interface Category {
  id: string
  nameAr: string
  children: { id: string; nameAr: string }[]
}

interface Flyer {
  id: string
  title: string
  supermarketId: string
}

interface Pagination {
  page: number
  total: number
  totalPages: number
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [supermarkets, setSupermarkets] = useState<Supermarket[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [flyers, setFlyers] = useState<Flyer[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')
  const [filterSupermarket, setFilterSupermarket] = useState('')
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const [formData, setFormData] = useState({
    flyerId: '',
    supermarketId: '',
    categoryId: '',
    nameAr: '',
    nameEn: '',
    brand: '',
    price: '',
    oldPrice: '',
    discountPercent: '',
    sizeText: '',
    imageUrl: '',
    tags: '',
    isHidden: false,
  })

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/supermarkets').then(r => r.json()),
      fetch('/api/admin/categories').then(r => r.json()),
    ]).then(([smData, catData]) => {
      setSupermarkets(smData.supermarkets || [])
      setCategories(catData.categories || [])
    })
  }, [])

  useEffect(() => {
    loadProducts()
  }, [page, filterSupermarket])

  const loadProducts = async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: page.toString() })
    if (search) params.set('search', search)
    if (filterSupermarket) params.set('supermarketId', filterSupermarket)

    const res = await fetch(`/api/admin/products?${params}`)
    const data = await res.json()
    setProducts(data.products || [])
    setPagination(data.pagination || null)
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      const method = editingId ? 'PUT' : 'POST'
      const url = editingId ? `/api/admin/products/${editingId}` : '/api/admin/products'

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
      loadProducts()
    } catch {
      setError('Failed to save product')
    }
  }

  const handleEdit = (product: Product) => {
    setFormData({
      flyerId: '',
      supermarketId: '',
      categoryId: product.category ? '' : '',
      nameAr: product.nameAr || '',
      nameEn: product.nameEn || '',
      brand: product.brand || '',
      price: product.price.toString(),
      oldPrice: product.oldPrice?.toString() || '',
      discountPercent: product.discountPercent?.toString() || '',
      sizeText: product.sizeText || '',
      imageUrl: product.imageUrl || '',
      tags: '',
      isHidden: product.isHidden,
    })
    setEditingId(product.id)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this product?')) return
    await fetch(`/api/admin/products/${id}`, { method: 'DELETE' })
    loadProducts()
  }

  const handleToggleHidden = async (id: string, isHidden: boolean) => {
    await fetch(`/api/admin/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isHidden: !isHidden }),
    })
    loadProducts()
  }

  const resetForm = () => {
    setFormData({
      flyerId: '', supermarketId: '', categoryId: '',
      nameAr: '', nameEn: '', brand: '',
      price: '', oldPrice: '', discountPercent: '',
      sizeText: '', imageUrl: '', tags: '', isHidden: false,
    })
    setEditingId(null)
    setShowForm(false)
    setError('')
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(products.map(p => p.id)))
    }
  }

  const handleBulkAction = async (action: string) => {
    if (selectedIds.size === 0) return
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/admin/products/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ids: Array.from(selectedIds) }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed'); return }
      setSuccess(`${action}: ${data.count} products updated`)
      setSelectedIds(new Set())
      loadProducts()
    } catch {
      setError('Bulk action failed')
    }
  }

  const allCategories = categories.flatMap(c => [c, ...c.children])

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Products</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
          >
            {showForm && !editingId ? 'Cancel' : 'Add Product'}
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

        {showForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">{editingId ? 'Edit Product' : 'Add New Product'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!editingId && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-1">Supermarket *</label>
                    <select
                      value={formData.supermarketId}
                      onChange={(e) => setFormData({ ...formData, supermarketId: e.target.value })}
                      required={!editingId}
                      className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select supermarket</option>
                      {supermarkets.map(sm => (
                        <option key={sm.id} value={sm.id}>{sm.nameAr}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">Flyer ID *</label>
                    <input
                      type="text"
                      value={formData.flyerId}
                      onChange={(e) => setFormData({ ...formData, flyerId: e.target.value })}
                      required={!editingId}
                      placeholder="Flyer ID from database"
                      className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">الاسم (عربي)</label>
                  <input
                    type="text"
                    value={formData.nameAr}
                    onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                    dir="rtl"
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Name (English)</label>
                  <input
                    type="text"
                    value={formData.nameEn}
                    onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">Brand</label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Size</label>
                  <input
                    type="text"
                    value={formData.sizeText}
                    onChange={(e) => setFormData({ ...formData, sizeText: e.target.value })}
                    placeholder="1kg, 500ml..."
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Category</label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">No category</option>
                    {allCategories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.nameAr}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">Price (SAR) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    required
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Old Price</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.oldPrice}
                    onChange={(e) => setFormData({ ...formData, oldPrice: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Discount %</label>
                  <input
                    type="number"
                    value={formData.discountPercent}
                    onChange={(e) => setFormData({ ...formData, discountPercent: e.target.value })}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Product Image</label>
                <div className="flex gap-3 items-start">
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        setError('')
                        const fd = new FormData()
                        fd.append('file', file)
                        fd.append('folder', 'products')
                        try {
                          const res = await fetch('/api/admin/upload', { method: 'POST', body: fd })
                          const data = await res.json()
                          if (data.url) {
                            setFormData(prev => ({ ...prev, imageUrl: data.url }))
                          } else {
                            setError(data.error || 'Upload failed')
                          }
                        } catch {
                          setError('Upload failed')
                        }
                      }}
                      className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                      placeholder="Or paste image URL..."
                      className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 mt-2 text-sm"
                    />
                  </div>
                  {formData.imageUrl && (
                    <img src={formData.imageUrl} alt="Preview" className="w-16 h-16 object-cover rounded border" />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="dairy,milk,organic"
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isHidden"
                  checked={formData.isHidden}
                  onChange={(e) => setFormData({ ...formData, isHidden: e.target.checked })}
                />
                <label htmlFor="isHidden" className="text-sm font-semibold">Hidden (not shown publicly)</label>
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

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6 flex gap-4">
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadProducts()}
            className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={filterSupermarket}
            onChange={(e) => { setFilterSupermarket(e.target.value); setPage(1) }}
            className="px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Supermarkets</option>
            {supermarkets.map(sm => (
              <option key={sm.id} value={sm.id}>{sm.nameAr}</option>
            ))}
          </select>
          <button
            onClick={() => { setPage(1); loadProducts() }}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Search
          </button>
        </div>

        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-center gap-3">
            <span className="text-sm font-semibold text-blue-700">{selectedIds.size} selected</span>
            <button onClick={() => handleBulkAction('show')} className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700">
              Show All
            </button>
            <button onClick={() => handleBulkAction('hide')} className="bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700">
              Hide All
            </button>
            <button onClick={() => { if (confirm(`Delete ${selectedIds.size} products?`)) handleBulkAction('delete') }} className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700">
              Delete All
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="text-gray-500 hover:text-gray-700 text-sm ml-auto">
              Clear Selection
            </button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            {pagination && (
              <div className="mb-3 text-sm text-gray-600">
                Showing {products.length} of {pagination.total} products
              </div>
            )}
            <div className="bg-white rounded-lg shadow-md overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-3 w-8">
                      <input type="checkbox" checked={selectedIds.size === products.length && products.length > 0} onChange={toggleSelectAll} />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Brand</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Discount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supermarket</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                        No products found. Add products through flyer upload or manually.
                      </td>
                    </tr>
                  ) : products.map(p => (
                    <tr key={p.id} className={p.isHidden ? 'opacity-50' : ''}>
                      <td className="px-3 py-3">
                        <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)} />
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div dir="rtl">{p.nameAr || '-'}</div>
                        <div className="text-gray-400 text-xs">{p.nameEn || ''}</div>
                      </td>
                      <td className="px-4 py-3 text-sm">{p.brand || '-'}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="font-semibold">{p.price.toFixed(2)} SAR</div>
                        {p.oldPrice && <div className="text-gray-400 text-xs line-through">{p.oldPrice.toFixed(2)}</div>}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {p.discountPercent ? (
                          <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-bold">
                            -{p.discountPercent}%
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm">{p.supermarket.nameAr}</td>
                      <td className="px-4 py-3 text-sm">{p.category?.nameAr || '-'}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded text-xs ${p.isHidden ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-800'}`}>
                          {p.isHidden ? 'Hidden' : 'Visible'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm space-x-2">
                        <button onClick={() => handleEdit(p)} className="text-blue-600 hover:underline">Edit</button>
                        <button onClick={() => handleToggleHidden(p.id, p.isHidden)} className="text-yellow-600 hover:underline">
                          {p.isHidden ? 'Show' : 'Hide'}
                        </button>
                        <button onClick={() => handleDelete(p.id)} className="text-red-600 hover:underline">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pagination && pagination.totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-4">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border rounded disabled:opacity-40 hover:bg-gray-100"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-sm text-gray-600">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={page === pagination.totalPages}
                  className="px-4 py-2 border rounded disabled:opacity-40 hover:bg-gray-100"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
