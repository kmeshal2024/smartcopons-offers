'use client'

import { useEffect, useState } from 'react'
import { useShoppingList } from '@/hooks/useShoppingList'
import { useI18n } from '@/components/I18nProvider'
import { track } from '@/lib/track'

interface Props {
  product: {
    id: string
    name: string
    price: number
    oldPrice?: number | null
    image?: string | null
    storeName: string
    storeSlug: string
  }
  /** Absolute, market-correct URL of this product page (urlFor on the server). */
  url: string
  /** Currency label, resolved on the server from the product's own country. */
  currency: string
}

/**
 * Add-to-list and share for the product page.
 *
 * The page had neither: a shopper who arrived from Google on exactly the product
 * they wanted could only watch its price or leave for the store's listing. Both
 * actions already existed on ProductCard, so the page a card links TO offered
 * less than the card itself.
 */
export default function ProductActions({ product, url, currency }: Props) {
  const { t } = useI18n()
  const { add, has } = useShoppingList()
  const inList = has(product.id)

  const shareText = `${product.name} - ${product.price.toFixed(2)} ${currency}${
    product.oldPrice && product.oldPrice > product.price
      ? ` (${t('card.was')} ${product.oldPrice.toFixed(2)})`
      : ''
  } - ${product.storeName}`

  const shareWhatsApp = () => {
    // Synchronous inside the click handler — after an await the popup blocker
    // kills window.open.
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${url}`)}`,
      '_blank',
      'noopener,noreferrer'
    )
    track('share', { method: 'whatsapp', content_type: 'product', item_id: product.id, surface: 'product_page' })
  }

  const shareNative = async () => {
    track('share', { method: 'native', content_type: 'product', item_id: product.id, surface: 'product_page' })
    try {
      await navigator.share({ title: product.name, text: shareText, url })
    } catch {
      /* dismissed by the shopper — not an error */
    }
  }

  // Decided after mount: navigator.share is unknowable on the server, and
  // branching on it during render would mismatch the server HTML.
  const [canNativeShare, setCanNativeShare] = useState(false)
  useEffect(() => {
    setCanNativeShare(typeof navigator.share === 'function')
  }, [])

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button
        onClick={() => {
          add({
            id: product.id,
            name: product.name,
            price: product.price,
            oldPrice: product.oldPrice,
            storeName: product.storeName,
            storeSlug: product.storeSlug,
            image: product.image,
          })
          track('add_to_list', { item_id: product.id, store: product.storeSlug, value: product.price, surface: 'product_page' })
        }}
        disabled={inList}
        className={`rounded-lg px-4 py-2.5 text-sm font-bold transition ${
          inList
            ? 'cursor-default bg-green-50 text-green-600'
            : 'bg-pink-50 text-[#E91E8C] hover:bg-[#E91E8C] hover:text-white'
        }`}
      >
        {inList ? t('card.inList') : t('card.addToList')}
      </button>

      <button
        onClick={shareWhatsApp}
        className="inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-bold text-green-700 transition hover:bg-green-100"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
        {t('product.shareWhatsapp')}
      </button>

      {canNativeShare && (
        <button
          onClick={shareNative}
          aria-label={t('product.share')}
          title={t('product.share')}
          className="inline-flex h-[42px] w-[42px] items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:border-pink-300 hover:text-pink-600"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
        </button>
      )}
    </div>
  )
}
