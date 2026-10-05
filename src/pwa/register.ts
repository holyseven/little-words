import { installUpdateChecks } from './updates'

/** Keep registration and all page reloads under the application's update flow. */
export async function registerAppServiceWorker(onRegistered: () => void): Promise<(() => void) | undefined> {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return undefined
  const scope = new URL(import.meta.env.BASE_URL, window.location.href)
  try {
    const registration = await navigator.serviceWorker.register(new URL('sw.js', scope).href, {
      scope: scope.href,
      updateViaCache: 'none',
    })
    onRegistered()
    return installUpdateChecks(registration)
  } catch (error) {
    console.warn('[sw] 注册失败', error)
    // Updating registration options can fail while an already installed worker
    // still controls this page. Keep its foreground/online recovery listeners.
    try {
      const existing = await navigator.serviceWorker.getRegistration(scope.href)
      if (existing?.scope === scope.href && existing.active) {
        onRegistered()
        return installUpdateChecks(existing)
      }
    } catch { /* No usable registration is available yet. */ }
    return undefined
  }
}
