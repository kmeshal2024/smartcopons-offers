'use client'

import { useEffect, useState } from 'react'
import AdminNav from '@/components/AdminNav'

interface Store {
  id: string
  name: string
}

interface Coupon {
  id: string
  title: string
  code: string
  discountText: string
  url: string
  description?: string
  storeId: string
  isActive: boolean
  store: {
    name: string
  }
}

interface BulkRow {
  code: string
  discountText: string
  storeName: string
  title: string
  url: string
}

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'list' | 'bulk'>('list')

  // Single coupon form
  const [formData, setFormData] = useState({
    title: '',
    code: '',
    discountText: '',
    url: '',
    description: '',
    storeId: '',
    isActive: true,
  })

  // Bulk import state
  const [bulkMode, setBulkMode] = useState<'paste' | 'quick'>('paste')
  const [bulkText, setBulkText] = useState('')
  const [bulkParsed, setBulkParsed] = useState<BulkRow[]>([])
  const [bulkErrors, setBulkErrors] = useState<string[]>([])
  const [bulkImporting, setBulkImporting] = useState(false)
  const [bulkResult, setBulkResult] = useState<{ created: number; errors: any[]; storesCreated: string[] } | null>(null)
  const [quickRows, setQuickRows] = useState<BulkRow[]>(
    Array.from({ length: 5 }, () => ({ code: '', discountText: '', storeName: '', title: '', url: '' }))
  )

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [couponsRes, storesRes] = await Promise.all([
        fetch('/api/admin/coupons'),
        fetch('/api/admin/stores'),
      ])

      const couponsData = await couponsRes.json()
      const storesData = await storesRes.json()

      setCoupons(couponsData.coupons || [])
      setStores(storesData.stores || [])
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      if (editingId) {
        await fetch(`/api/admin/coupons/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })
      } else {
        await fetch('/api/admin/coupons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })
      }

      resetForm()
      loadData()
    } catch (error) {
      alert('Failed to save coupon')
    }
  }

  const handleEdit = (coupon: Coupon) => {
    setFormData({
      title: coupon.title,
      code: coupon.code,
      discountText: coupon.discountText,
      url: coupon.url,
      description: coupon.description || '',
      storeId: coupon.storeId,
      isActive: coupon.isActive,
    })
    setEditingId(coupon.id)
    setShowForm(true)
    setActiveTab('list')
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this coupon?')) return

    try {
      await fetch(`/api/admin/coupons/${id}`, { method: 'DELETE' })
      loadData()
    } catch (error) {
      alert('Failed to delete coupon')
    }
  }

  const resetForm = () => {
    setFormData({
      title: '',
      code: '',
      discountText: '',
      url: '',
      description: '',
      storeId: '',
      isActive: true,
    })
    setEditingId(null)
    setShowForm(false)
  }

  // Bulk import: parse CSV text
  const handleParseBulk = () => {
    setBulkResult(null)
    const lines = bulkText.trim().split('\n').filter(l => l.trim())
    if (lines.length === 0) {
      setBulkErrors(['No data to parse'])
      setBulkParsed([])
      return
    }

    const errors: string[] = []
    const parsed: BulkRow[] = []

    // Skip header row if detected
    const firstLine = lines[0].toLowerCase()
    const startIdx = (firstLine.includes('code') || firstLine.includes('title') || firstLine.includes('store')) ? 1 : 0

    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      // Support comma or tab separation
      const parts = line.includes('\t') ? line.split('\t') : line.split(',')
      const trimmed = parts.map(p => p.trim())

      if (trimmed.length < 3) {
        errors.push(`Line ${i + 1}: Need at least code, discount, store (got ${trimmed.length} fields)`)
        continue
      }

      parsed.push({
        code: trimmed[0],
        discountText: trimmed[1],
        storeName: trimmed[2],
        title: trimmed[3] || `${trimmed[1]} - ${trimmed[2]}`,
        url: trimmed[4] || '#',
      })
    }

    setBulkParsed(parsed)
    setBulkErrors(errors)
  }

  // Bulk import: submit parsed or quick rows
  const handleBulkImport = async (rows: BulkRow[]) => {
    const valid = rows.filter(r => r.code && r.discountText && r.storeName)
    if (valid.length === 0) {
      setBulkErrors(['No valid rows to import'])
      return
    }

    setBulkImporting(true)
    setBulkResult(null)

    try {
      const res = await fetch('/api/admin/coupons/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coupons: valid.map(r => ({
            code: r.code,
            discountText: r.discountText,
            storeName: r.storeName,
            title: r.title || `${r.discountText} - ${r.storeName}`,
            url: r.url || '#',
          })),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setBulkErrors([data.error || 'Import failed'])
        return
      }

      setBulkResult(data)
      if (data.created > 0) {
        loadData()
        setBulkText('')
        setBulkParsed([])
      }
    } catch {
      setBulkErrors(['Network error during import'])
    } finally {
      setBulkImporting(false)
    }
  }

  const addQuickRows = () => {
    setQuickRows([...quickRows, ...Array.from({ length: 5 }, () => ({ code: '', discountText: '', storeName: '', title: '', url: '' }))])
  }

  const updateQuickRow = (index: number, field: keyof BulkRow, value: string) => {
    const updated = [...quickRows]
    updated[index] = { ...updated[index], [field]: value }
    setQuickRows(updated)
  }

  const removeQuickRow = (index: number) => {
    if (quickRows.length <= 1) return
    setQuickRows(quickRows.filter((_, i) => i !== index))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />

      <main className="container mx-auto px-4 py-8">
        {/* Tab Navigation */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('list')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                activeTab === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Coupons ({coupons.length})
            </button>
            <button
              onClick={() => setActiveTab('bulk')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                activeTab === 'bulk' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Bulk Import
            </button>
          </div>
          {activeTab === 'list' && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
            >
              {showForm ? 'Cancel' : 'Add New Coupon'}
            </button>
          )}
        </div>

        {/* ===== LIST TAB ===== */}
        {activeTab === 'list' && (
          <>
            {showForm && (
              <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                <h2 className="text-xl font-bold mb-4">
                  {editingId ? 'Edit Coupon' : 'Add New Coupon'}
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold mb-1">Title</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                      className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold mb-1">Code</label>
                      <input
                        type="text"
                        value={formData.code}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                        required
                        className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold mb-1">Discount Text</label>
                      <input
                        type="text"
                        value={formData.discountText}
                        onChange={(e) => setFormData({ ...formData, discountText: e.target.value })}
                        required
                        placeholder="e.g., 20% OFF"
                        className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-1">URL</label>
                    <input
                      type="url"
                      value={formData.url}
                      onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                      required
                      className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-1">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-1">Store</label>
                    <select
                      value={formData.storeId}
                      onChange={(e) => setFormData({ ...formData, storeId: e.target.value })}
                      required
                      className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Store</option>
                      {stores.map((store) => (
                        <option key={store.id} value={store.id}>
                          {store.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="mr-2"
                    />
                    <label className="text-sm font-semibold">Active</label>
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Discount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Store</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {coupons.map((coupon) => (
                      <tr key={coupon.id}>
                        <td className="px-6 py-4 text-sm">{coupon.title}</td>
                        <td className="px-6 py-4 text-sm font-mono">{coupon.code}</td>
                        <td className="px-6 py-4 text-sm">{coupon.discountText}</td>
                        <td className="px-6 py-4 text-sm">{coupon.store.name}</td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`px-2 py-1 rounded text-xs ${coupon.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {coupon.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm space-x-2">
                          <button onClick={() => handleEdit(coupon)} className="text-blue-600 hover:underline">Edit</button>
                          <button onClick={() => handleDelete(coupon.id)} className="text-red-600 hover:underline">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ===== BULK IMPORT TAB ===== */}
        {activeTab === 'bulk' && (
          <div className="space-y-6">
            {/* Mode toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => setBulkMode('paste')}
                className={`px-4 py-2 rounded text-sm font-medium ${
                  bulkMode === 'paste' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border hover:bg-gray-50'
                }`}
              >
                Paste CSV / Text
              </button>
              <button
                onClick={() => setBulkMode('quick')}
                className={`px-4 py-2 rounded text-sm font-medium ${
                  bulkMode === 'quick' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border hover:bg-gray-50'
                }`}
              >
                Quick Add Rows
              </button>
            </div>

            {/* Success / Error Messages */}
            {bulkResult && (
              <div className={`p-4 rounded-lg border ${bulkResult.created > 0 ? 'bg-green-50 border-green-200 text-green-800' : 'bg-yellow-50 border-yellow-200 text-yellow-800'}`}>
                <p className="font-semibold">{bulkResult.created} coupons imported successfully!</p>
                {bulkResult.storesCreated.length > 0 && (
                  <p className="text-sm mt-1">New stores created: {bulkResult.storesCreated.join(', ')}</p>
                )}
                {bulkResult.errors.length > 0 && (
                  <p className="text-sm mt-1 text-red-600">{bulkResult.errors.length} errors occurred</p>
                )}
              </div>
            )}
            {bulkErrors.length > 0 && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
                {bulkErrors.map((e, i) => <p key={i} className="text-sm">{e}</p>)}
              </div>
            )}

            {/* CSV Paste Mode */}
            {bulkMode === 'paste' && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-lg font-bold mb-2">Paste Coupons</h2>
                <p className="text-sm text-gray-500 mb-4">
                  Format: <code className="bg-gray-100 px-1 rounded">code, discount, store, title, url</code> (one per line).
                  Title and URL are optional. Stores are auto-created if new.
                </p>
                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  rows={10}
                  placeholder={`SAVE20, 20% OFF, Noon, خصم 20% على الإلكترونيات, https://noon.com\nFREE50, Free Shipping, Amazon, شحن مجاني, https://amazon.sa\nWELCOME10, 10% OFF, Namshi, خصم ترحيبي`}
                  className="w-full px-3 py-2 border rounded font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleParseBulk}
                    disabled={!bulkText.trim()}
                    className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    Parse & Preview
                  </button>
                  {bulkParsed.length > 0 && (
                    <button
                      onClick={() => { setBulkParsed([]); setBulkText(''); setBulkErrors([]); setBulkResult(null) }}
                      className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Preview Table */}
                {bulkParsed.length > 0 && (
                  <div className="mt-6">
                    <h3 className="font-semibold mb-2">{bulkParsed.length} coupons parsed</h3>
                    <div className="overflow-x-auto border rounded">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">#</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Code</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Discount</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Store</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Title</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">URL</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {bulkParsed.map((row, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                              <td className="px-3 py-2 font-mono">{row.code}</td>
                              <td className="px-3 py-2">{row.discountText}</td>
                              <td className="px-3 py-2">{row.storeName}</td>
                              <td className="px-3 py-2">{row.title}</td>
                              <td className="px-3 py-2 text-blue-600 truncate max-w-[200px]">{row.url}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <button
                      onClick={() => handleBulkImport(bulkParsed)}
                      disabled={bulkImporting}
                      className="mt-4 bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:opacity-50"
                    >
                      {bulkImporting ? 'Importing...' : `Import ${bulkParsed.length} Coupons`}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Quick Add Mode */}
            {bulkMode === 'quick' && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-lg font-bold mb-2">Quick Add Coupons</h2>
                <p className="text-sm text-gray-500 mb-4">
                  Fill in the rows below. Stores are auto-created if new. Empty rows are skipped.
                </p>

                {/* Store datalist for autocomplete */}
                <datalist id="store-suggestions">
                  {stores.map(s => <option key={s.id} value={s.name} />)}
                </datalist>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 w-8">#</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">Code *</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">Discount *</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">Store *</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">Title</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">URL</th>
                        <th className="px-2 py-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {quickRows.map((row, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="px-2 py-1 text-gray-400">{i + 1}</td>
                          <td className="px-2 py-1">
                            <input
                              type="text"
                              value={row.code}
                              onChange={e => updateQuickRow(i, 'code', e.target.value)}
                              placeholder="CODE"
                              className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input
                              type="text"
                              value={row.discountText}
                              onChange={e => updateQuickRow(i, 'discountText', e.target.value)}
                              placeholder="20% OFF"
                              className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input
                              type="text"
                              value={row.storeName}
                              onChange={e => updateQuickRow(i, 'storeName', e.target.value)}
                              list="store-suggestions"
                              placeholder="Store name"
                              className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input
                              type="text"
                              value={row.title}
                              onChange={e => updateQuickRow(i, 'title', e.target.value)}
                              placeholder="Optional title"
                              className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input
                              type="text"
                              value={row.url}
                              onChange={e => updateQuickRow(i, 'url', e.target.value)}
                              placeholder="https://..."
                              className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <button
                              onClick={() => removeQuickRow(i)}
                              className="text-red-400 hover:text-red-600 text-lg"
                              title="Remove row"
                            >
                              &times;
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={addQuickRows}
                    className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300 text-sm"
                  >
                    + Add 5 More Rows
                  </button>
                  <button
                    onClick={() => handleBulkImport(quickRows)}
                    disabled={bulkImporting || quickRows.every(r => !r.code)}
                    className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    {bulkImporting ? 'Saving...' : 'Save All'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
