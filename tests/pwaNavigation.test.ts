import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const workbox = vi.hoisted(() => ({
  route: vi.fn(), precache: vi.fn(), match: vi.fn(), cleanup: vi.fn(), claim: vi.fn(),
}))
vi.mock('workbox-routing', () => ({ registerRoute: workbox.route }))
vi.mock('workbox-precaching', () => ({
  precacheAndRoute: workbox.precache, matchPrecache: workbox.match, cleanupOutdatedCaches: workbox.cleanup,
}))
vi.mock('workbox-core', () => ({ clientsClaim: workbox.claim }))
vi.mock('workbox-strategies', () => ({ CacheFirst: class { constructor(readonly options: unknown) {} } }))
vi.mock('workbox-cacheable-response', () => ({ CacheableResponsePlugin: class {} }))
vi.mock('workbox-expiration', () => ({ ExpirationPlugin: class {} }))
vi.mock('workbox-range-requests', () => ({ RangeRequestsPlugin: class {} }))

const scope = 'https://example.test/little-words/'
let fetchMock: ReturnType<typeof vi.fn>
let workerEvents: EventTarget
let matchNavigation: (args: { request: { mode: string }; url: URL }) => boolean
let navigate: () => Promise<Response>

beforeEach(async () => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(100_000)
  fetchMock = vi.fn().mockResolvedValue(new Response('<html>new version</html>', {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  }))
  vi.stubGlobal('fetch', fetchMock)
  workerEvents = Object.assign(new EventTarget(), {
    registration: { scope }, __WB_MANIFEST: [], skipWaiting: vi.fn().mockResolvedValue(undefined),
  })
  vi.stubGlobal('self', workerEvents)
  workbox.match.mockResolvedValue(new Response('<html>installed version</html>'))
  await import('../src/pwa/sw')
  ;[matchNavigation, navigate] = workbox.route.mock.calls[0]
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('online page navigation with a complete offline fallback', () => {
  it('advertises network-first navigation only through the requested reply port', () => {
    const postMessage = vi.fn()
    const message = (type: string, ports: unknown[] = []) => Object.assign(new Event('message'), { data: { type }, ports })
    workerEvents.dispatchEvent(message('LW_NAVIGATION_CAPABILITY', [{ postMessage }]))
    expect(postMessage).toHaveBeenCalledTimes(1)
    expect(postMessage).toHaveBeenCalledWith({ networkFirst: true })
    workerEvents.dispatchEvent(message('UNRELATED_MESSAGE', [{ postMessage }]))
    workerEvents.dispatchEvent(message('LW_NAVIGATION_CAPABILITY'))
    expect(postMessage).toHaveBeenCalledTimes(1)
  })

  it('takes precedence over precaching and only handles the app entry navigation', () => {
    expect(workbox.route.mock.invocationCallOrder[0]).toBeLessThan(workbox.precache.mock.invocationCallOrder[0])
    const matches = (url: string, mode = 'navigate') => matchNavigation({ request: { mode }, url: new URL(url) })
    expect(matches(`${scope}?source=home`)).toBe(true)
    expect(matches(`${scope}index.html`)).toBe(true)
    expect(matches(`${scope}index.html`, 'cors')).toBe(false)
    expect(matches(`${scope}app-version.json`)).toBe(false)
    expect(matches(`${scope}course-media/example.mp4`)).toBe(false)
    expect(matches('https://example.test/another-app/')).toBe(false)
    expect(matches('https://other.test/little-words/')).toBe(false)
  })

  it('fetches the new online HTML without relying on an older HTTP or precache copy', async () => {
    expect(await (await navigate()).text()).toBe('<html>new version</html>')
    expect(fetchMock).toHaveBeenCalledWith(`${scope}index.html?lw-nav=100000`, expect.objectContaining({
      cache: 'no-store', credentials: 'same-origin', signal: expect.any(AbortSignal),
    }))
    expect(workbox.match).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['offline', 'http-error', 'not-html'])('uses only the fully installed fallback after %s', async (failure) => {
    if (failure === 'offline') fetchMock.mockRejectedValueOnce(new Error('offline'))
    if (failure === 'http-error') fetchMock.mockResolvedValueOnce(new Response('bad gateway', { status: 502 }))
    if (failure === 'not-html') fetchMock.mockResolvedValueOnce(new Response('{"error":"not a page"}', {
      headers: { 'Content-Type': 'application/json' },
    }))
    expect(await (await navigate()).text()).toBe('<html>installed version</html>')
    expect(workbox.match).toHaveBeenCalledWith(`${scope}index.html`)
  })

  it('keeps the deadline until the HTML body finishes, then falls back on a stalled connection', async () => {
    fetchMock.mockImplementation(async (_url: string, options: RequestInit) => ({
      ok: true, headers: new Headers({ 'Content-Type': 'text/html' }),
      text: () => new Promise((_resolve, reject) => options.signal?.addEventListener('abort', () => reject(new Error('timeout')))),
    }))
    const response = navigate()
    await vi.advanceTimersByTimeAsync(4_000)
    expect(await (await response).text()).toBe('<html>installed version</html>')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not replace the installed fallback with a newer page whose assets may be incomplete', async () => {
    expect(await (await navigate()).text()).toContain('new version')
    fetchMock.mockRejectedValueOnce(new Error('offline before new assets finished'))
    expect(await (await navigate()).text()).toBe('<html>installed version</html>')
    // The only precache mutation is installation using the entire injected manifest.
    expect(workbox.precache).toHaveBeenCalledTimes(1)
  })

  it('preserves the course and speech runtime cache names', () => {
    const cacheNames = workbox.route.mock.calls.slice(1).map(([, strategy]) => strategy.options.cacheName)
    expect(cacheNames).toEqual(['little-words-course-v1', 'little-words-speech-model-v1', 'little-words-speech-runtime-v1'])
    expect(workbox.cleanup).toHaveBeenCalledTimes(1)
    expect(workbox.claim).toHaveBeenCalledTimes(1)
  })
})
