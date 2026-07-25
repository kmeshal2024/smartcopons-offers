'use client'

import { useSyncExternalStore } from 'react'

/**
 * Provider-free favourites store, mirrored to the server by device token.
 *
 * A single module-level Set is the source of truth; components subscribe via
 * useSyncExternalStore. The set loads once from /api/favorites on first use and
 * writes are optimistic (revert on failure). Same shape as useShoppingList.
 */

const DEVICE_KEY = 'sc-device'
let ids = new Set<string>()
let version = 0
let loaded = false
const listeners = new Set<() => void>()

function emit() {
  version++
  listeners.forEach(l => l())
}

function deviceId(): string {
  let d = localStorage.getItem(DEVICE_KEY)
  if (!d || !/^[A-Za-z0-9_-]{16,64}$/.test(d)) {
    const rnd =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID().replace(/-/g, '')
        : Math.random().toString(36).slice(2) + Date.now().toString(36)
    d = rnd.slice(0, 32).padEnd(16, '0')
    localStorage.setItem(DEVICE_KEY, d)
  }
  return d
}

async function ensureLoaded() {
  if (loaded) return
  loaded = true
  try {
    const r = await fetch(`/api/favorites?deviceId=${deviceId()}`)
    const j = await r.json()
    ids = new Set<string>(j.ids || [])
    emit()
  } catch {
    /* offline / first visit — start empty */
  }
}

export async function toggleFavorite(productId: string) {
  const had = ids.has(productId)
  if (had) ids.delete(productId)
  else ids.add(productId)
  emit()
  try {
    await fetch('/api/favorites', {
      method: had ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: deviceId(), productId }),
    })
  } catch {
    // revert on network failure
    if (had) ids.add(productId)
    else ids.delete(productId)
    emit()
  }
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  ensureLoaded()
  return () => {
    listeners.delete(l)
  }
}
const getSnapshot = () => version
const getServerSnapshot = () => 0

export function useFavorites() {
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return {
    ids: Array.from(ids),
    count: ids.size,
    isFavorite: (id: string) => ids.has(id),
    toggle: toggleFavorite,
  }
}

/** The device token, for pages (e.g. /favorites) that fetch the full list. */
export function getDeviceId(): string {
  if (typeof window === 'undefined') return ''
  return deviceId()
}
