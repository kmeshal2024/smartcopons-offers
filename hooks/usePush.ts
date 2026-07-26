'use client'

import { useCallback, useEffect, useState } from 'react'
import { getDeviceId } from '@/hooks/useFavorites'

/** VAPID keys travel as base64url; the subscribe API wants raw bytes. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export type PushState = 'unsupported' | 'default' | 'granted' | 'denied' | 'busy'

/**
 * Web push subscribe/unsubscribe against our own service worker.
 * Support is genuinely absent on iOS Safari unless the PWA is installed, so the
 * UI has to handle 'unsupported' rather than assume a prompt is possible.
 */
export function usePush() {
  const [state, setState] = useState<PushState>('default')
  const [subscribed, setSubscribed] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setState('unsupported')
      return
    }
    setState(Notification.permission as PushState)
    navigator.serviceWorker.ready
      .then(reg => reg.pushManager.getSubscription())
      .then(sub => setSubscribed(!!sub))
      .catch(() => {})
  }, [])

  const enable = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false
    setState('busy')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission as PushState)
        return false
      }
      const reg = await navigator.serviceWorker.ready
      const { publicKey } = await fetch('/api/push/subscribe').then(r => r.json())
      const sub =
        (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
        }))
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: getDeviceId(), subscription: sub.toJSON() }),
      })
      setSubscribed(true)
      setState('granted')
      return true
    } catch {
      setState(Notification.permission as PushState)
      return false
    }
  }, [])

  const disable = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setSubscribed(false)
    } catch {
      /* ignore */
    }
  }, [])

  return { state, subscribed, enable, disable }
}
