/* SmartCopons service worker.
 *
 * Deliberately minimal: it exists to make the site an installable PWA (a fetch
 * handler is part of Chrome's install criteria and the TWA quality bar) and to
 * give a usable offline experience, not to aggressively cache dynamic data —
 * deals change daily, so stale prices would be worse than a spinner.
 *
 * Strategy:
 *   - navigations: network-first, fall back to the cached page, then /offline.
 *   - static assets (/_next/static, /icons, /logos): cache-first.
 *   - everything else (API, images): straight to the network.
 */
const VERSION = 'v2'
const STATIC_CACHE = `sc-static-${VERSION}`
const PAGE_CACHE = `sc-pages-${VERSION}`
const OFFLINE_URL = '/offline'

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache =>
      cache.addAll([OFFLINE_URL, '/icons/icon-192.png', '/icons/icon-512.png'])
    )
  )
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== STATIC_CACHE && k !== PAGE_CACHE)
          .map(k => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

/* --- Push notifications ------------------------------------------------- */

self.addEventListener('push', event => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'سمارت كوبونز', body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'سمارت كوبونز'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      dir: 'rtl',
      lang: 'ar',
      // tag collapses repeats of the same alert instead of stacking them
      tag: data.tag || 'sc-notification',
      data: { url: data.url || '/' },
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      // Reuse an open tab when there is one rather than piling up windows.
      for (const c of list) {
        if ('focus' in c) {
          c.navigate(target)
          return c.focus()
        }
      }
      return self.clients.openWindow(target)
    })
  )
})

function isStatic(url) {
  return (
    url.pathname.startsWith('/_next/static') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/logos/')
  )
}

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return // let cross-origin images/APIs pass through

  // App-shell navigations: fresh when online, cached page or offline when not.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(res => {
          const copy = res.clone()
          caches.open(PAGE_CACHE).then(c => c.put(request, copy))
          return res
        })
        .catch(() => caches.match(request).then(r => r || caches.match(OFFLINE_URL)))
    )
    return
  }

  if (isStatic(url)) {
    event.respondWith(
      caches.match(request).then(
        cached =>
          cached ||
          fetch(request).then(res => {
            const copy = res.clone()
            caches.open(STATIC_CACHE).then(c => c.put(request, copy))
            return res
          })
      )
    )
  }
})
