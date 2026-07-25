'use client'

import { useSyncExternalStore } from 'react'
import { getDeviceId } from '@/hooks/useFavorites'

/**
 * Set of watched product ids, mirrored to /api/watches by device token.
 * Same provider-free pattern as useFavorites; only the endpoint differs.
 */
let ids = new Set<string>()
let version = 0
let loaded = false
const listeners = new Set<() => void>()
const emit = () => {
  version++
  listeners.forEach(l => l())
}

async function ensureLoaded() {
  if (loaded) return
  loaded = true
  try {
    const r = await fetch(`/api/watches?deviceId=${getDeviceId()}`)
    const j = await r.json()
    ids = new Set<string>((j.watches || []).map((w: any) => w.productId))
    emit()
  } catch {
    /* first visit / offline */
  }
}

export async function toggleWatch(productId: string) {
  const had = ids.has(productId)
  if (had) ids.delete(productId)
  else ids.add(productId)
  emit()
  try {
    await fetch('/api/watches', {
      method: had ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: getDeviceId(), productId }),
    })
  } catch {
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

export function useWatches() {
  useSyncExternalStore(
    subscribe,
    () => version,
    () => 0
  )
  return {
    count: ids.size,
    isWatching: (id: string) => ids.has(id),
    toggle: toggleWatch,
  }
}
