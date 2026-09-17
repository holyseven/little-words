export type AppUpdateStatus = 'current' | 'updating' | 'offline' | 'unavailable' | 'error'

const CHECK_INTERVAL_MS = 60_000
let registration: ServiceWorkerRegistration | undefined
let pending: Promise<AppUpdateStatus> | undefined
let lastAttempt: number | undefined
let removeListeners: (() => void) | undefined

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
      const previousWorker = current.active
      await current.update()
      if (current.installing || current.waiting || current.active !== previousWorker) return 'updating'
      return current.active ? 'current' : 'unavailable'
    } catch {
      return navigator.onLine ? 'error' : 'offline'
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
  window.addEventListener('pageshow', check)
  window.addEventListener('online', check)
  document.addEventListener('visibilitychange', check)

  const dispose = () => {
    window.removeEventListener('pageshow', check)
    window.removeEventListener('online', check)
    document.removeEventListener('visibilitychange', check)
    if (removeListeners === dispose) removeListeners = undefined
  }
  removeListeners = dispose
  check()
  return dispose
}
