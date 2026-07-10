/**
 * Reality's service worker — the delivery half of the notification system.
 *
 * Two jobs only, no caching (the app must never be served stale):
 *   1. Exist. Android Chrome refuses page-created `new Notification()` —
 *      notifications there MUST go through a service worker registration's
 *      showNotification(). Registering this worker is what makes the
 *      "shift done" ping possible on phones at all.
 *   2. Bring the player back. Tapping a notification focuses the open game
 *      tab, or opens a fresh one.
 */

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) return client.focus()
      }
      return self.clients.openWindow('/')
    }),
  )
})
