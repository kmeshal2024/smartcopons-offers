'use client'

import { useState } from 'react'
import { shoppingList } from '@/hooks/useShoppingList'
import { cartPanel } from '@/hooks/useCartPanel'
import { useI18n } from '@/components/I18nProvider'
import type { SharedItem } from './page'

/**
 * Copies a shared list into the reader's own list.
 *
 * This is where the loop closes: someone receives a list in a family group, opens
 * it, adopts it, edits it, and re-shares — which puts the site in front of that
 * group again. It costs nothing to run: the merge is entirely localStorage, so
 * adopting a list is zero database work.
 *
 * Ids are synthesised from the item name because a snapshot deliberately does not
 * carry ProductOffer ids — the offer rows are replaced when the weekly flyer rolls
 * over, and a shared link has to keep working after that. The `shared:` prefix
 * keeps these from colliding with real product ids in the same store.
 */
export default function AdoptListButton({ items }: { items: SharedItem[] }) {
  const { t } = useI18n()
  const [done, setDone] = useState(false)

  const adopt = () => {
    for (const i of items) {
      shoppingList.add({
        id: `shared:${i.name}`,
        name: i.name,
        price: i.price,
        oldPrice: i.oldPrice,
        storeName: i.storeName,
        image: null,
        qty: i.qty,
      })
    }
    setDone(true)
    cartPanel.open()
  }

  return (
    <button
      onClick={adopt}
      disabled={done}
      className={`mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-full py-3 font-bold transition ${
        done
          ? 'cursor-default bg-green-50 text-green-600'
          : 'bg-[#E91E8C] text-white hover:brightness-110'
      }`}
    >
      {done ? t('sharedList.adopted') : t('sharedList.adopt')}
    </button>
  )
}
