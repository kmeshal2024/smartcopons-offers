'use client'

import { useEffect, useState } from 'react'
import { useShoppingList } from '@/hooks/useShoppingList'

export default function ShoppingListWidget() {
  const { items, totals, remove, toggleBought, setQty, clearPurchased, clearAll } = useShoppingList()
  const [open, setOpen] = useState(false)

  // Close on ESC
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const shareWhatsApp = () => {
    const lines: string[] = ['🛒 *قائمة التسوق - SmartCopons*', '']
    items.forEach((i) => {
      const mark = i.bought ? '✅' : '▫️'
      const store = i.storeName ? ` (${i.storeName})` : ''
      lines.push(`${mark} ${i.name}${store} × ${i.qty} — ${(i.price * i.qty).toFixed(2)} ر.س`)
    })
    lines.push('')
    lines.push(`💰 الإجمالي: ${totals.total.toFixed(2)} ر.س`)
    if (totals.savings > 0) lines.push(`🎉 وفّرت: ${totals.savings.toFixed(2)} ر.س`)
    lines.push('')
    lines.push('عبر sa.smartcopons.com')
    const url = `https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="قائمة التسوق"
        className="fixed bottom-5 left-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#E91E8C] text-white shadow-xl shadow-pink-500/30 transition hover:scale-105 hover:brightness-110"
      >
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
        {totals.count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-white px-1.5 text-xs font-bold text-[#E91E8C] shadow">
            {totals.units}
          </span>
        )}
      </button>

      {/* Overlay + slide-in panel */}
      {open && (
        <div className="fixed inset-0 z-50 animate-fade-in bg-black/40" onClick={() => setOpen(false)} dir="rtl">
          <aside
            className="animate-slide-in-right absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="قائمة التسوق"
          >
            {/* Header */}
            <header className="flex items-center justify-between bg-[#E91E8C] px-5 py-4 text-white">
              <div className="flex items-center gap-2">
                <span className="text-xl">🛒</span>
                <h2 className="text-lg font-bold">قائمة التسوق</h2>
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">{totals.units}</span>
              </div>
              <button onClick={() => setOpen(false)} aria-label="إغلاق" className="text-2xl leading-none">
                ×
              </button>
            </header>

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-4">
              {items.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center text-gray-400">
                  <span className="mb-3 text-6xl">🛒</span>
                  <p>قائمتك فارغة</p>
                  <p className="mt-1 text-sm">أضف العروض التي تنوي شراءها</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {items.map((i) => (
                    <li
                      key={i.id}
                      className={`flex items-center gap-3 rounded-xl border p-2.5 transition ${
                        i.bought ? 'border-gray-100 bg-gray-50 opacity-60' : 'border-gray-100 bg-white'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={i.bought}
                        onChange={() => toggleBought(i.id)}
                        aria-label={`تحديد ${i.name} كمشترى`}
                        className="h-5 w-5 flex-shrink-0 accent-[#E91E8C]"
                      />
                      {i.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={i.image} alt="" className="h-12 w-12 flex-shrink-0 rounded-lg object-cover" />
                      ) : (
                        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-pink-50 text-xl">🏷️</div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-sm font-semibold ${i.bought ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                          {i.name}
                        </p>
                        {i.storeName && <p className="truncate text-xs text-gray-400">{i.storeName}</p>}
                        <div className="mt-0.5 flex items-center gap-2">
                          <span className="text-sm font-bold text-[#E91E8C]">{(i.price * i.qty).toFixed(2)} ر.س</span>
                          {i.oldPrice && i.oldPrice > i.price && (
                            <span className="text-xs text-gray-400 line-through">{(i.oldPrice * i.qty).toFixed(2)}</span>
                          )}
                        </div>
                      </div>
                      {/* qty stepper */}
                      <div className="flex flex-shrink-0 items-center gap-1">
                        <button
                          onClick={() => setQty(i.id, i.qty - 1)}
                          aria-label="إنقاص"
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-lg hover:bg-gray-200"
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-sm font-semibold">{i.qty}</span>
                        <button
                          onClick={() => setQty(i.id, i.qty + 1)}
                          aria-label="زيادة"
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-lg hover:bg-gray-200"
                        >
                          +
                        </button>
                      </div>
                      <button
                        onClick={() => remove(i.id)}
                        aria-label="حذف"
                        className="flex-shrink-0 text-gray-300 transition hover:text-red-500"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Footer / totals */}
            {items.length > 0 && (
              <footer className="border-t bg-white p-4">
                <div className="mb-3 space-y-1">
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>الإجمالي</span>
                    <span className="text-lg font-extrabold text-gray-900">{totals.total.toFixed(2)} ر.س</span>
                  </div>
                  {totals.savings > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-emerald-600">إجمالي التوفير 🎉</span>
                      <span className="font-bold text-emerald-600">{totals.savings.toFixed(2)} ر.س</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={shareWhatsApp}
                  className="mb-2 flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] py-3 font-bold text-white transition hover:brightness-105"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.247-.694.247-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  مشاركة القائمة عبر واتساب
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={clearPurchased}
                    disabled={totals.purchasedCount === 0}
                    className="flex-1 rounded-full border-2 border-gray-200 py-2 text-sm font-semibold text-gray-600 transition hover:border-gray-300 disabled:opacity-40"
                  >
                    حذف المشترى ({totals.purchasedCount})
                  </button>
                  <button
                    onClick={clearAll}
                    className="flex-1 rounded-full border-2 border-red-100 py-2 text-sm font-semibold text-red-500 transition hover:bg-red-50"
                  >
                    إفراغ القائمة
                  </button>
                </div>
              </footer>
            )}
          </aside>
        </div>
      )}
    </>
  )
}
