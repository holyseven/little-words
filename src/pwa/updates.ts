import { flushProgress } from '../store/progress'

export type AppUpdateStatus = 'current' | 'updating' | 'stale' | 'offline' | 'unavailable' | 'error'

const CHECK_INTERVAL_MS = 60_000
const VERSION_TIMEOUT_MS = 8_000
const RELOAD_KEY = 'lw-update-reload'
let registration: ServiceWorkerRegistration | undefined
let pending: Promise<AppUpdateStatus> | undefined
let lastAttempt: number | undefined
let removeListeners: (() => void) | undefined
let reloading = false

function appScope() {
  return new URL(import.meta.env.BASE_URL, window.location.href).href
}

async function findRegistration() {
  const scope = appScope()
  if (registration?.scope === scope) return registration
  // getRegistration can return an ancestor's worker. Only update our exact scope.
  const found = await navigator.serviceWorker?.getRegistration(scope)
  if (found?.scope !== scope) return undefined
  registration = found
  return found
}

async function fetchVersionResource(url: URL): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), VERSION_TIMEOUT_MS)
  try {
    const response = await fetch(url.href, { cache: 'no-store', credentials: 'same-origin', signal: controller.signal })
    if (!response.ok) throw new Error('Version check failed')
    return response
  } finally { clearTimeout(timer) }
}

async function latestBuild(): Promise<string> {
  // Excluded from the SW's precache. The query also avoids a stale CDN/HTTP copy.
  const url = new URL('app-version.json', appScope())
  url.searchParams.set('check', String(Date.now()))
  const response = await fetchVersionResource(url)
  const payload: unknown = JSON.parse(await response.text())
  if (!payload || typeof payload !== 'object' || !('build' in payload)
    || typeof payload.build !== 'string' || !/^[a-zA-Z0-9._-]{1,80}$/.test(payload.build)) {
    throw new Error('Invalid version response')
  }
  return payload.build
}

async function reloadWhenReady(latest: string): Promise<AppUpdateStatus> {
  // A new worker may already control a page restored by Safari. Check the index
  // served by that worker, not only its active/installing flags. Do not reload
  // into an old precached index while a new installation is still incomplete.
  const response = await fetchVersionResource(new URL('index.html', appScope()))
  const html = await response.text()
  const servedBuild = html.match(/<meta\b[^>]*\bname=["']little-words-build["'][^>]*\bcontent=["']([^"']+)["']/i)?.[1]
  if (servedBuild !== latest) return 'stale'
  if (reloading) return 'updating'
  const reloadAttempt = `${import.meta.env.VITE_BUILD_ID}->${latest}`
  try {
    if (window.sessionStorage.getItem(RELOAD_KEY) === reloadAttempt) return 'stale'
  } catch { /* Storage may be unavailable in private browsing. */ }
  reloading = true
  try {
    await flushProgress()
    try { window.sessionStorage.setItem(RELOAD_KEY, reloadAttempt) } catch { /* optional loop protection */ }
    window.location.reload()
    return 'updating'
  } catch (error) {
    reloading = false
    throw error
  }
}

/** A manual check bypasses the automatic throttle, sharing any request in flight. */
export function checkForAppUpdate(): Promise<AppUpdateStatus> {
  if (pending) return pending
  if (!navigator.onLine) return Promise.resolve('offline')
  if (!('serviceWorker' in navigator)) return Promise.resolve('unavailable')

  lastAttempt = Date.now()
  const request = (async (): Promise<AppUpdateStatus> => {
    try {
      const current = await findRegistration()
      if (!current) return 'unavailable'
      if (!navigator.onLine) return 'offline'
      await current.update()
      const latest = await latestBuild()
      if (current.installing || current.waiting) return 'updating'
      if (!current.active) return 'unavailable'
      if (latest === import.meta.env.VITE_BUILD_ID) {
        try { window.sessionStorage.removeItem(RELOAD_KEY) } catch { /* optional loop protection */ }
        return 'current'
      }
      return await reloadWhenReady(latest)
    } catch {
      return typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'error'
    }
  })()
  pending = request
  void request.finally(() => {
    if (pending === request) pending = undefined
  })
  return request
}

/** iPad often resumes an existing page, so registration at startup alone is insufficient. */
export function installUpdateChecks(current: ServiceWorkerRegistration): () => void {
  removeListeners?.()
  registration = current

  const check = () => {
    if (!navigator.onLine || document.visibilityState !== 'visible') return
    if (lastAttempt !== undefined && Date.now() - lastAttempt < CHECK_INTERVAL_MS) return
    void checkForAppUpdate()
  }
  let disposed = false
  const controllerChanged = () => {
    // Activation can occur during a check. Follow that check with a fresh one
    // so an in-flight 'installing' result cannot suppress the page refresh.
    void (pending ?? Promise.resolve()).then(() => {
      if (!disposed && document.visibilityState === 'visible') void checkForAppUpdate()
    })
  }
  window.addEventListener('pageshow', check)
  window.addEventListener('online', check)
  document.addEventListener('visibilitychange', check)
  if (typeof navigator.serviceWorker?.addEventListener === 'function') {
    navigator.serviceWorker.addEventListener('controllerchange', controllerChanged)
  }
  const timer = setInterval(check, CHECK_INTERVAL_MS)

  const dispose = () => {
    disposed = true
    window.removeEventListener('pageshow', check)
    window.removeEventListener('online', check)
    document.removeEventListener('visibilitychange', check)
    if (typeof navigator.serviceWorker?.removeEventListener === 'function') {
      navigator.serviceWorker.removeEventListener('controllerchange', controllerChanged)
    }
    clearInterval(timer)
    if (removeListeners === dispose) removeListeners = undefined
  }
  removeListeners = dispose
  check()
  return dispose
}
