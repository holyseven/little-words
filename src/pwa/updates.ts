import { flushProgress } from '../store/progress'

export type AppUpdateStatus = 'current' | 'updating' | 'stale' | 'offline' | 'unavailable' | 'error'

const CHECK_INTERVAL_MS = 60_000
const VERSION_TIMEOUT_MS = 8_000
const RELOAD_KEY = 'lw-update-reload'
let registration: ServiceWorkerRegistration | undefined
let pending: Promise<AppUpdateStatus> | undefined
let workerUpdate: Promise<unknown> | undefined
let lastAttempt: number | undefined
let removeListeners: (() => void) | undefined
let checked: ((status: AppUpdateStatus) => void) | undefined
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

async function fetchVersionResource(url: URL): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), VERSION_TIMEOUT_MS)
  try {
    const response = await fetch(url.href, { cache: 'no-store', credentials: 'same-origin', signal: controller.signal })
    if (!response.ok) throw new Error('Version check failed')
    // Include body download in the timeout, not just the response headers.
    return await response.text()
  } finally { clearTimeout(timer) }
}

async function latestBuild(): Promise<string> {
  const url = new URL('app-version.json', appScope())
  url.searchParams.set('check', String(Date.now()))
  const payload: unknown = JSON.parse(await fetchVersionResource(url))
  if (!payload || typeof payload !== 'object' || !('build' in payload)
    || typeof payload.build !== 'string' || !/^[a-zA-Z0-9._-]{1,80}$/.test(payload.build)) {
    throw new Error('Invalid version response')
  }
  return payload.build
}

/** Old workers only serve cached HTML; new workers can navigate online immediately. */
function hasOnlineNavigation(): Promise<boolean> {
  const controller = navigator.serviceWorker.controller
  if (!controller?.postMessage || typeof MessageChannel === 'undefined') return Promise.resolve(false)
  return new Promise((resolve) => {
    const channel = new MessageChannel()
    const finish = (supported: boolean) => {
      clearTimeout(timer)
      channel.port1.close()
      channel.port2.close()
      resolve(supported && controller === navigator.serviceWorker.controller)
    }
    const timer = setTimeout(() => finish(false), 750)
    channel.port1.onmessage = (event) => finish(event.data?.networkFirst === true)
    try { controller.postMessage({ type: 'LW_NAVIGATION_CAPABILITY' }, [channel.port2]) }
    catch { finish(false) }
  })
}

async function reloadWhenReady(latest: string): Promise<AppUpdateStatus> {
  if (reloading) return 'updating'
  const onlineNavigation = await hasOnlineNavigation()
  const index = new URL('index.html', appScope())
  // Only bypass precaching if the controlling worker can also navigate online.
  // During migration from a legacy worker, wait for a fully installed new shell.
  if (onlineNavigation) index.searchParams.set('check', String(Date.now()))
  const html = await fetchVersionResource(index)
  const servedBuild = html.match(/<meta\b[^>]*\bname=["']little-words-build["'][^>]*\bcontent=["']([^"']+)["']/i)?.[1]
  if (servedBuild !== latest) return 'stale'
  try {
    const previous = JSON.parse(window.sessionStorage.getItem(RELOAD_KEY) || 'null')
    if (previous?.from === import.meta.env.VITE_BUILD_ID && previous?.to === latest) return 'stale'
  } catch { /* Storage may be unavailable in private browsing. */ }
  reloading = true
  try {
    await flushProgress()
    try {
      window.sessionStorage.setItem(RELOAD_KEY, JSON.stringify({ from: import.meta.env.VITE_BUILD_ID, to: latest }))
    } catch { /* optional loop protection */ }
    window.location.reload()
    return 'updating'
  } catch (error) {
    reloading = false
    throw error
  }
}

/** Manual checks and foreground events share requests already in flight. */
export function checkForAppUpdate({ manual = false }: { manual?: boolean } = {}): Promise<AppUpdateStatus> {
  if (pending) return pending
  if (manual) {
    try { window.sessionStorage.removeItem(RELOAD_KEY) } catch { /* optional loop protection */ }
  }
  if (!navigator.onLine) return Promise.resolve('offline')
  if (!('serviceWorker' in navigator)) return Promise.resolve('unavailable')

  lastAttempt = Date.now()
  const request = (async (): Promise<AppUpdateStatus> => {
    try {
      const current = await findRegistration()
      if (!current) return 'unavailable'
      if (!navigator.onLine) return 'offline'
      // A slow/failed offline-cache installation must not block checking the
      // published page. Keep at most one explicit worker update in flight.
      if (!workerUpdate) {
        const update = Promise.resolve().then(() => current.update()).catch(() => undefined)
        workerUpdate = update
        void update.finally(() => { if (workerUpdate === update) workerUpdate = undefined })
      }
      const latest = await latestBuild()
      if (!navigator.onLine) return 'offline'
      if (!current.active) return current.installing || current.waiting ? 'updating' : 'unavailable'
      if (latest === import.meta.env.VITE_BUILD_ID) {
        try { window.sessionStorage.removeItem(RELOAD_KEY) } catch { /* optional loop protection */ }
        return 'current'
      }
      return await reloadWhenReady(latest)
    } catch {
      return !navigator.onLine ? 'offline' : 'error'
    }
  })()
  pending = request
  void request.then((status) => {
    if (pending === request) pending = undefined
    checked?.(status)
  })
  return request
}

/** Safari may restore an old page; recheck every foreground/network transition. */
export function installUpdateChecks(current: ServiceWorkerRegistration): () => void {
  removeListeners?.()
  registration = current
  let disposed = false
  let retry: ReturnType<typeof setTimeout> | undefined
  let retryCount = 0
  const check = () => {
    if (disposed || !navigator.onLine || document.visibilityState !== 'visible') return
    void checkForAppUpdate()
  }
  checked = (status) => {
    clearTimeout(retry)
    retry = undefined
    if (status === 'current') retryCount = 0
    if (!reloading && ['stale', 'updating', 'error'].includes(status)) {
      const delay = [5_000, 15_000, 30_000, CHECK_INTERVAL_MS][Math.min(retryCount++, 3)]
      retry = setTimeout(check, delay)
    }
  }
  const controllerChanged = () => {
    try { window.sessionStorage.removeItem(RELOAD_KEY) } catch { /* optional loop protection */ }
    // Finish any in-flight check, then inspect the newly controlling worker.
    void (pending ?? Promise.resolve()).then(check)
  }
  window.addEventListener('pageshow', check)
  window.addEventListener('online', check)
  document.addEventListener('visibilitychange', check)
  navigator.serviceWorker.addEventListener('controllerchange', controllerChanged)
  const timer = setInterval(() => {
    if (lastAttempt === undefined || Date.now() - lastAttempt >= CHECK_INTERVAL_MS) check()
  }, CHECK_INTERVAL_MS)

  const dispose = () => {
    disposed = true
    window.removeEventListener('pageshow', check)
    window.removeEventListener('online', check)
    document.removeEventListener('visibilitychange', check)
    navigator.serviceWorker.removeEventListener('controllerchange', controllerChanged)
    clearInterval(timer)
    clearTimeout(retry)
    if (removeListeners === dispose) {
      removeListeners = undefined
      checked = undefined
    }
  }
  removeListeners = dispose
  check()
  return dispose
}
