'use client'

import { useEffect } from 'react'
import { useShoppingList } from '@/hooks/useShoppingList'
import { useCartPanel } from '@/hooks/useCartPanel'
import { newListId, listUrl } from '@/lib/shared-list'
import { currencyOf } from '@/lib/countries'
import { useI18n } from '@/components/I18nProvider'
import ListCoupon from '@/components/ListCoupon'
import { useListCoupon } from '@/hooks/useListCoupon'

// A price list is always within one country, so the currency is resolved once
// here rather than per row. See lib/countries.ts.
const CUR = currencyOf()


export default function ShoppingListWidget() {
  const { t, dir } = useI18n()
  const { items, totals, remove, toggleBought, setQty, clearPurchased, clearAll } = useShoppingList()
  // Shared store, because the mobile trigger now lives in MobileBottomNav.
  const { isOpen: open, open: openPanel, close: setClosed } = useCartPanel()

  // Retailers represented in the basket, for matching an owned code. Lists saved
  // before storeSlug existed simply contribute nothing here, and ListCoupon
  // falls back to a generic live code.
  const storeSlugs = Array.from(
    new Set(items.map((i) => i.storeSlug).filter((s): s is string => !!s))
  )

  // Fetched ONCE and shared by both surfaces — the panel strip and the WhatsApp
  // line — so the two can never offer different codes. Only runs while the panel
  // is open, so it costs nothing on views that never open the list.
  const coupon = useListCoupon(storeSlugs, open)

  // Close on ESC
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setClosed()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setClosed])

  /**
   * Share to WhatsApp, with a link that reconstitutes the list.
   *
   * ORDER MATTERS. window.open() must run synchronously inside the click handler
   * — after any `await` the popup blocker kills it. So the id is minted HERE with
   * crypto.randomUUID() (CSPRNG, never sequential), the URL is built from it
   * immediately, WhatsApp opens, and only then is the snapshot POSTed in the
   * background with `keepalive` so it survives navigating away.
   *
   * The message format is unchanged — items, store, quantities, total, savings —
   * with one line added. That link is the point: it turns a text blob into
   * something the recipient can open, adopt and re-share, which makes this a
   * distribution channel rather than only a persistence mechanism.
   */
  const shareWhatsApp = () => {
    const id = newListId()
    const lines: string[] = [t('cart.share.title'), '']
    items.forEach((i) => {
      const mark = i.bought ? '✅' : '▫️'
      const store = i.storeName ? ` (${i.storeName})` : ''
      lines.push(`${mark} ${i.name}${store} × ${i.qty} — ${(i.price * i.qty).toFixed(2)} ${CUR}`)
    })
    lines.push('')
    lines.push(`${t('cart.share.total')} ${totals.total.toFixed(2)} ${CUR}`)
    if (totals.savings > 0) lines.push(`${t('cart.share.saved')} ${totals.savings.toFixed(2)} ${CUR}`)
    lines.push('')
    // Coupon line — surface (c). Only when a live code exists. This message
    // travels into a family group, so an irrelevant or dead code here costs
    // more than one on a page the shopper chose to open. By construction, the
    // same code as the panel above (both read useListCoupon).
    if (coupon) {
      lines.push(`🏷️ ${t('cart.share.coupon', { store: coupon.storeName, code: coupon.code })}`)
    }
    // Reconstitution link — D-lite. Comes AFTER the coupon so the last thing
    // above the "via" footer is the URL the recipient will actually tap.
    lines.push(`${t('cart.share.open')} ${listUrl(id)}`)
    lines.push('')
    lines.push(t('cart.share.via'))

    const url = `https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`
    window.open(url, '_blank', 'noopener,noreferrer')

    // Fire-and-forget, AFTER the window is open. If it fails the link 404s but the
    // message still carries the full list as text, so nothing is lost.
    void fetch('/api/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        id,
        items: items.map((i) => ({
          name: i.name,
          price: i.price,
          oldPrice: i.oldPrice ?? null,
          qty: i.qty,
          storeName: i.storeName ?? null,
        })),
      }),
    }).catch(() => {})
  }

  return (
    <>
      {/* Floating button — md+ ONLY.
          On mobile this sat at `bottom-5 z-40` while the fixed bottom nav sits at
          `bottom-0 z-50` and is 56px tall, so z-40 lost and the lower ~36px of the
          button (icon included) rendered behind the nav: the single entry point to
          the shopping list was half-hidden and iconless. Mobile now gets a real
          nav item (MobileBottomNav); this survives only at breakpoints where there
          is no bottom nav to collide with. z-50 anyway, so a future nav change
          can't re-create the same bug. */}
      <button
        onClick={openPanel}
        aria-label={t('cart.title')}
        className="hidden md:flex fixed bottom-5 left-5 z-50 h-14 w-14 items-center justify-center rounded-full bg-[#E91E8C] text-white shadow-xl shadow-pink-500/30 transition hover:scale-105 hover:brightness-110"
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
        <div className="fixed inset-0 z-[60] animate-fade-in bg-black/40" onClick={setClosed} dir={dir}>
          <aside
            className="animate-slide-in-right absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={t('cart.title')}
          >
            {/* Header */}
            <header className="flex items-center justify-between bg-[#E91E8C] px-5 py-4 text-white">
              <div className="flex items-center gap-2">
                <span className="text-xl">🛒</span>
                <h2 className="text-lg font-bold">{t('cart.title')}</h2>
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">{totals.units}</span>
              </div>
              <button onClick={setClosed} aria-label={t('common.close')} className="text-2xl leading-none">
                ×
              </button>
            </header>

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-4">
              {items.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center text-gray-400">
                  <span className="mb-3 text-6xl">🛒</span>
                  <p>{t('cart.empty')}</p>
                  <p className="mt-1 text-sm">{t('cart.emptyHint')}</p>
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
                        aria-label={i.name}
                        className="h-5 w-5 flex-shrink-0 accent-[#E91E8C]"
                      />
                      {i.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={i.image} alt="" className="h-12 w-12 flex-shrink-0 rounded-lg object-cover" />
                      ) : (
                        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-pink-50 text-xl">🏷️</div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className={`line-clamp-2 text-sm font-semibold ${i.bought ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                          {i.name}
                        </p>
                        {i.storeName && <p className="truncate text-xs text-gray-400">{i.storeName}</p>}
                        <div className="mt-0.5 flex items-center gap-2">
                          <span className="text-sm font-bold text-[#E91E8C]">{(i.price * i.qty).toFixed(2)} {CUR}</span>
                          {i.oldPrice && i.oldPrice > i.price && (
                            <span className="text-xs text-gray-400 line-through">{(i.oldPrice * i.qty).toFixed(2)}</span>
                          )}
                        </div>
                      </div>
                      {/* qty stepper */}
                      <div className="flex flex-shrink-0 items-center gap-1">
                        <button
                          onClick={() => setQty(i.id, i.qty - 1)}
                          aria-label={t('cart.decrease')}
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-lg hover:bg-gray-200"
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-sm font-semibold">{i.qty}</span>
                        <button
                          onClick={() => setQty(i.id, i.qty + 1)}
                          aria-label={t('cart.increase')}
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-lg hover:bg-gray-200"
                        >
                          +
                        </button>
                      </div>
                      <button
                        onClick={() => remove(i.id)}
                        aria-label={t('cart.remove')}
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
                    <span>{t('cart.total')}</span>
                    <span className="text-lg font-extrabold text-gray-900">{totals.total.toFixed(2)} {CUR}</span>
                  </div>
                  {totals.savings > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-emerald-600">{t('cart.savings')}</span>
                      <span className="font-bold text-emerald-600">{totals.savings.toFixed(2)} {CUR}</span>
                    </div>
                  )}
                </div>

                {/* Owned coupon code — placed here deliberately: this is the
                    highest purchase-intent moment in the product. Renders
                    nothing when no live code with a real affiliate URL exists. */}
                <ListCoupon coupon={coupon} />

                <button
                  onClick={shareWhatsApp}
                  className="mb-2 flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] py-3 font-bold text-white transition hover:brightness-105"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.247-.694.247-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  {t('cart.shareWhatsapp')}
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={clearPurchased}
                    disabled={totals.purchasedCount === 0}
                    className="flex-1 rounded-full border-2 border-gray-200 py-2 text-sm font-semibold text-gray-600 transition hover:border-gray-300 disabled:opacity-40"
                  >
                    {t('cart.clearPurchased', { n: totals.purchasedCount })}
                  </button>
                  <button
                    onClick={clearAll}
                    className="flex-1 rounded-full border-2 border-red-100 py-2 text-sm font-semibold text-red-500 transition hover:bg-red-50"
                  >
                    {t('cart.clearAll')}
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
