'use client'

import { useSyncExternalStore } from 'react'
import { ALL_CITIES } from '@/lib/cities'

// ============================================================================
// Selected-city store — provider-free, localStorage-backed, cross-tab synced.
// Value is a CitySlug or 'all'. Shared by CityFilterBar, FlyerStoreGrid, and
// the offers feed so a single selection filters everything.
// ============================================================================

const KEY = 'sc_selected_city_v1'

let city: string = ALL_CITIES
let initialized = false
const listeners = new Set<() => void>()

function ensureInit() {
  if (initialized || typeof window === 'undefined') return
  initialized = true
  try {
    city = window.localStorage.getItem(KEY) || ALL_CITIES
  } catch {
    city = ALL_CITIES
  }
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      city = e.newValue || ALL_CITIES
      listeners.forEach((l) => l())
    }
  })
}

function subscribe(cb: () => void) {
  ensureInit()
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function getSnapshot() {
  return city
}

function getServerSnapshot() {
  return ALL_CITIES
}

export function setCity(next: string) {
  ensureInit()
  city = next
  try {
    window.localStorage.setItem(KEY, next)
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l())
}

export function useCity(): [string, (next: string) => void] {
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return [value, setCity]
}
