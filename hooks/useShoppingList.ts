'use client'

import { useSyncExternalStore } from 'react'

// ============================================================================
// Shopping list — a tiny provider-free external store backed by localStorage.
// Any component can call useShoppingList() and add/remove items; all consumers
// stay in sync (including across browser tabs). No <Provider> wiring needed.
// ============================================================================

export interface ListItem {
  id: string
  name: string
  price: number
  oldPrice?: number | null
  storeName?: string | null
  image?: string | null
  qty: number
  bought: boolean
}

export type AddItemInput = Omit<ListItem, 'qty' | 'bought'> & { qty?: number }

const KEY = 'sc_shopping_list_v1'

let items: ListItem[] = []
let initialized = false
const listeners = new Set<() => void>()

function read(): ListItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as ListItem[]) : []
  } catch {
    return []
  }
}

function persist() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items))
  } catch {
    /* quota / private mode — ignore */
  }
}

function emit() {
  listeners.forEach((l) => l())
}

function ensureInit() {
  if (initialized || typeof window === 'undefined') return
  initialized = true
  items = read()
  // Cross-tab sync
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      items = read()
      emit()
    }
  })
}

function set(next: ListItem[]) {
  items = next
  persist()
  emit()
}

// --- mutations ---
export const shoppingList = {
  add(input: AddItemInput) {
    ensureInit()
    const existing = items.find((i) => i.id === input.id)
    if (existing) {
      set(items.map((i) => (i.id === input.id ? { ...i, qty: i.qty + (input.qty ?? 1) } : i)))
    } else {
      set([...items, { qty: 1, bought: false, ...input }])
    }
  },
  remove(id: string) {
    ensureInit()
    set(items.filter((i) => i.id !== id))
  },
  toggleBought(id: string) {
    ensureInit()
    set(items.map((i) => (i.id === id ? { ...i, bought: !i.bought } : i)))
  },
  setQty(id: string, qty: number) {
    ensureInit()
    if (qty <= 0) return shoppingList.remove(id)
    set(items.map((i) => (i.id === id ? { ...i, qty } : i)))
  },
  clearPurchased() {
    ensureInit()
    set(items.filter((i) => !i.bought))
  },
  clearAll() {
    ensureInit()
    set([])
  },
  has(id: string) {
    ensureInit()
    return items.some((i) => i.id === id)
  },
}

function subscribe(cb: () => void) {
  ensureInit()
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function getSnapshot() {
  return items
}

function getServerSnapshot(): ListItem[] {
  return []
}

export interface ShoppingTotals {
  count: number // distinct items
  units: number // sum of qty
  total: number // total cost (qty * price)
  savings: number // sum of qty * (oldPrice - price)
  purchasedCount: number
}

export function useShoppingList() {
  const list = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const totals: ShoppingTotals = list.reduce(
    (acc, i) => {
      acc.count += 1
      acc.units += i.qty
      acc.total += i.qty * i.price
      acc.savings += i.oldPrice && i.oldPrice > i.price ? i.qty * (i.oldPrice - i.price) : 0
      if (i.bought) acc.purchasedCount += 1
      return acc
    },
    { count: 0, units: 0, total: 0, savings: 0, purchasedCount: 0 } as ShoppingTotals
  )

  return { items: list, totals, ...shoppingList }
}
