/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { ExpirationPlugin } from 'workbox-expiration'
import { RangeRequestsPlugin } from 'workbox-range-requests'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>
}

const scope = new URL(self.registration.scope)
const indexUrl = new URL('index.html', scope)
const NAVIGATION_TIMEOUT_MS = 4_000

// The update checker can refresh into a verified online page before the next
// full audio precache finishes, but only if the controlling worker supports it.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'LW_NAVIGATION_CAPABILITY' && event.ports[0]) {
    event.ports[0].postMessage({ networkFirst: true })
  }
})

// Register before precaching: otherwise '/' and '/index.html' always hit the
// old precached page, even while the next complete offline version installs.
registerRoute(
  ({ request, url }) => request.mode === 'navigate'
    && url.origin === scope.origin
    && (url.pathname === scope.pathname || url.pathname === indexUrl.pathname),
  async () => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), NAVIGATION_TIMEOUT_MS)
    try {
      const freshIndex = new URL(indexUrl)
      freshIndex.searchParams.set('lw-nav', String(Date.now()))
      const response = await fetch(freshIndex.href, {
        cache: 'no-store',
        credentials: 'same-origin',
        signal: controller.signal,
      })
      if (!response.ok || !response.headers.get('Content-Type')?.includes('text/html')) {
        throw new Error('The online application page is unavailable')
      }
      // Read the entire body before ending the timeout. Return a normal response
      // so navigation does not retain a redirected response or a partial stream.
      const html = await response.text()
      const headers = new Headers(response.headers)
      // fetch has already decoded compression; these original byte headers no
      // longer describe the newly created response body.
      headers.delete('Content-Encoding')
      headers.delete('Content-Length')
      return new Response(html, { status: response.status, headers })
    } catch (error) {
      // Only the complete installed build is safe offline. Never cache just the
      // new HTML here: its JavaScript/audio may not have finished installing.
      const cached = await matchPrecache(indexUrl.href)
      if (cached) return cached
      throw error
    } finally {
      clearTimeout(timer)
    }
  },
)

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

registerRoute(
  /\/course-media\/[^/]+\.(?:mp3|m4a|mp4)$/,
  new CacheFirst({
    cacheName: 'little-words-course-v1',
    plugins: [new CacheableResponsePlugin({ statuses: [200] }), new RangeRequestsPlugin()],
  }),
)

registerRoute(
  /\/speech-model\/model\.tar\.gz$/,
  new CacheFirst({
    cacheName: 'little-words-speech-model-v1',
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 1, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  }),
)

registerRoute(
  /\/speech-runtime\/vosk\.js$/,
  new CacheFirst({
    cacheName: 'little-words-speech-runtime-v1',
    plugins: [new CacheableResponsePlugin({ statuses: [200] })],
  }),
)

void self.skipWaiting()
clientsClaim()
