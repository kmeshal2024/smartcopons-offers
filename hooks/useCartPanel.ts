'use client'

import { useSyncExternalStore } from 'react'

/**
 * Open/closed state for the shopping-list panel, as a provider-free external
 * store — same pattern as useShoppingList.
 *
 * It has to be shared because the trigger and the panel now live in different
 * components: the trigger is an item in MobileBottomNav (and a desktop-only FAB
 * in ShoppingListWidget), while the panel itself stays in ShoppingListWidget.
 *
 * Why they were split: the trigger used to be a single FAB at `bottom-5 z-40`,
 * and the fixed bottom nav sits at `bottom-0 z-50` and is 56px tall. z-40 loses
 * to z-50, so the lower ~36px of the button — including its icon — rendered
 * behind the nav. The only entry point to the shopping list was half-hidden and
 * showed no icon, on the site's best feature. On mobile it is now a real nav
 * item; the FAB survives only at md+ where there is no bottom nav to collide
 * with.
 */

let open = false
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach(l => l())
}

export const cartPanel = {
  open() {
    if (open) return
    open = true
    emit()
  },
  close() {
    if (!open) return
    open = false
    emit()
  },
  toggle() {
    open = !open
    emit()
  },
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

const getSnapshot = () => open
const getServerSnapshot = () => false

export function useCartPanel() {
  const isOpen = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return { isOpen, ...cartPanel }
}
