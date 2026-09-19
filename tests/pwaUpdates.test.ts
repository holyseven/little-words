import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const scope = 'https://example.test/little-words/'
let browser: EventTarget & { location: { href: string; reload: ReturnType<typeof vi.fn> } }
let page: EventTarget & { visibilityState: string }
let serviceWorker: EventTarget & { controller: object | null; getRegistration: ReturnType<typeof vi.fn> }
let network: { onLine: boolean; serviceWorker?: typeof serviceWorker }
let worker: EventTarget & { scope: string; active: object | null; installing: object | null; waiting: object | null; update: ReturnType<typeof vi.fn> }
let fetchMock: ReturnType<typeof vi.fn>
let api: typeof import('../src/pwa/updates')
let cleanup: (() => void) | undefined

beforeEach(async () => {
  vi.resetModules()
  vi.stubEnv('BASE_URL', '/little-words/')
  vi.stubEnv('VITE_BUILD_ID', 'build-a')
  vi.useFakeTimers()
  vi.spyOn(Date, 'now').mockReturnValue(100_000)
  browser = Object.assign(new EventTarget(), { location: { href: `${scope}#/parent`, reload: vi.fn() } })
  page = Object.assign(new EventTarget(), { visibilityState: 'visible' })
  serviceWorker = Object.assign(new EventTarget(), { controller: {}, getRegistration: vi.fn() })
  worker = Object.assign(new EventTarget(), { scope, active: {}, installing: null, waiting: null, update: vi.fn() })
  worker.update.mockResolvedValue(worker)
  serviceWorker.getRegistration.mockResolvedValue(worker)
  network = { onLine: true, serviceWorker }
  fetchMock = vi.fn().mockImplementation((input: string | URL) => {
    if (String(input).includes('app-version.json')) return Promise.resolve({ ok: true, status: 200, json: async () => ({ build: 'build-a' }), text: async () => '{"build":"build-a"}' })
    return Promise.resolve({ ok: true, status: 200, text: async () => '<meta name="little-words-build" content="build-a">' })
  })
  vi.stubGlobal('window', browser)
  vi.stubGlobal('document', page)
  vi.stubGlobal('navigator', network)
  vi.stubGlobal('fetch', fetchMock)
  api = await import('../src/pwa/updates')
})

afterEach(() => {
  cleanup?.()
  cleanup = undefined
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function install() {
  cleanup = api.installUpdateChecks(worker as unknown as ServiceWorkerRegistration)
}

async function finishCheck() {
  // If an automatic check is pending this observes the same request.
  return api.checkForAppUpdate()
}

describe('PWA update checks', () => {
  it('checks at registration and on foreground resume after the throttle interval', async () => {
    install()
    expect(await finishCheck()).toBe('current')
    expect(worker.update).toHaveBeenCalledTimes(1)
    page.visibilityState = 'hidden'
    vi.mocked(Date.now).mockReturnValue(160_001)
    page.dispatchEvent(new Event('visibilitychange'))
    expect(worker.update).toHaveBeenCalledTimes(1)
    page.visibilityState = 'visible'
    page.dispatchEvent(new Event('visibilitychange'))
    expect(await finishCheck()).toBe('current')
    expect(worker.update).toHaveBeenCalledTimes(2)
  })

  it('checks pageshow while throttling repeated foreground events', async () => {
    install()
    await finishCheck()
    vi.mocked(Date.now).mockReturnValue(120_000)
    browser.dispatchEvent(new Event('pageshow'))
    browser.dispatchEvent(new Event('online'))
    page.dispatchEvent(new Event('visibilitychange'))
    await Promise.resolve()
    expect(worker.update).toHaveBeenCalledTimes(1)
    vi.mocked(Date.now).mockReturnValue(160_000)
    browser.dispatchEvent(new Event('pageshow'))
    await finishCheck()
    expect(worker.update).toHaveBeenCalledTimes(2)
  })

  it('skips offline startup and checks when the connection returns', async () => {
    network.onLine = false
    install()
    expect(await finishCheck()).toBe('offline')
    expect(worker.update).not.toHaveBeenCalled()
    network.onLine = true
    browser.dispatchEvent(new Event('online'))
    expect(await finishCheck()).toBe('current')
    expect(worker.update).toHaveBeenCalledTimes(1)
  })

  it('does not automatically check while hidden, including online and pageshow events', async () => {
    page.visibilityState = 'hidden'
    install()
    browser.dispatchEvent(new Event('online'))
    browser.dispatchEvent(new Event('pageshow'))
    await Promise.resolve()
    expect(worker.update).not.toHaveBeenCalled()
  })

  it('lets a manual check bypass the automatic throttle', async () => {
    install()
    await finishCheck()
    expect(await api.checkForAppUpdate()).toBe('current')
    expect(worker.update).toHaveBeenCalledTimes(2)
  })

  it('shares concurrent manual and automatic requests', async () => {
    let resolve!: () => void
    worker.update.mockReturnValue(new Promise<void>((done) => { resolve = done }))
    install()
    const first = api.checkForAppUpdate()
    const second = api.checkForAppUpdate()
    expect(second).toBe(first)
    await Promise.resolve()
    expect(worker.update).toHaveBeenCalledTimes(1)
    resolve()
    expect(await first).toBe('current')
    expect(await second).toBe('current')
  })

  it('reports installing or waiting workers as updating', async () => {
    worker.installing = {}
    expect(await api.checkForAppUpdate()).toBe('updating')
    worker.installing = null
    worker.waiting = {}
    expect(await api.checkForAppUpdate()).toBe('updating')
  })

  it('does not call a failed network check current and permits a retry', async () => {
    worker.update.mockRejectedValueOnce(new Error('Network request failed'))
    expect(await api.checkForAppUpdate()).toBe('error')
    expect(await api.checkForAppUpdate()).toBe('current')
    expect(worker.update).toHaveBeenCalledTimes(2)
  })

  it('reports offline if the connection is lost during an update request', async () => {
    worker.update.mockImplementation(async () => {
      network.onLine = false
      throw new Error('Offline')
    })
    expect(await api.checkForAppUpdate()).toBe('offline')
  })

  it('finds only the app scope and rejects a broader registration', async () => {
    expect(await api.checkForAppUpdate()).toBe('current')
    expect(network.serviceWorker?.getRegistration).toHaveBeenCalledWith(scope)
    vi.resetModules()
    api = await import('../src/pwa/updates')
    worker.scope = 'https://example.test/'
    worker.update.mockClear()
    expect(await api.checkForAppUpdate()).toBe('unavailable')
    expect(worker.update).not.toHaveBeenCalled()
  })

  it('does not report current without a registration or service worker support', async () => {
    network.serviceWorker?.getRegistration.mockResolvedValue(undefined)
    expect(await api.checkForAppUpdate()).toBe('unavailable')
    delete network.serviceWorker
    expect(await api.checkForAppUpdate()).toBe('unavailable')
  })

  it('reports registration lookup failures and removes event listeners on cleanup', async () => {
    network.serviceWorker?.getRegistration.mockRejectedValueOnce(new Error('Blocked'))
    expect(await api.checkForAppUpdate()).toBe('error')
    install()
    await finishCheck()
    cleanup?.()
    vi.mocked(Date.now).mockReturnValue(200_000)
    browser.dispatchEvent(new Event('pageshow'))
    browser.dispatchEvent(new Event('online'))
    page.dispatchEvent(new Event('visibilitychange'))
    await Promise.resolve()
    expect(worker.update).toHaveBeenCalledTimes(1)
  })

  it('does not report current when the active worker is old and the published build is newer', async () => {
    fetchMock.mockImplementation((input: string | URL) => {
      if (String(input).includes('app-version.json')) return Promise.resolve({ ok: true, status: 200, json: async () => ({ build: 'build-b' }), text: async () => '{"build":"build-b"}' })
      return Promise.resolve({ ok: true, status: 200, text: async () => '<meta name="little-words-build" content="build-a">' })
    })
    expect(await api.checkForAppUpdate()).toBe('stale')
    expect(browser.location.reload).not.toHaveBeenCalled()
  })

  it('reloads once when the new published shell is already served by the worker', async () => {
    fetchMock.mockImplementation((input: string | URL) => {
      if (String(input).includes('app-version.json')) return Promise.resolve({ ok: true, status: 200, json: async () => ({ build: 'build-b' }), text: async () => '{"build":"build-b"}' })
      return Promise.resolve({ ok: true, status: 200, text: async () => '<meta name="little-words-build" content="build-b">' })
    })
    expect(await api.checkForAppUpdate()).toBe('updating')
    expect(browser.location.reload).toHaveBeenCalledTimes(1)
    expect(await api.checkForAppUpdate()).toBe('updating')
    expect(browser.location.reload).toHaveBeenCalledTimes(1)
  })

  it('reports a failed version check instead of claiming the page is current', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network failed'))
    expect(await api.checkForAppUpdate()).toBe('error')
    expect(browser.location.reload).not.toHaveBeenCalled()
  })

  it('reports offline before requesting the published version', async () => {
    network.onLine = false
    expect(await api.checkForAppUpdate()).toBe('offline')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not reload on a first install without an active worker', async () => {
    worker.active = null
    serviceWorker.controller = null
    expect(await api.checkForAppUpdate()).toBe('unavailable')
    expect(browser.location.reload).not.toHaveBeenCalled()
  })

  it('checks immediately after a service worker controller change', async () => {
    install()
    await finishCheck()
    fetchMock.mockClear()
    vi.mocked(Date.now).mockReturnValue(100_001)
    serviceWorker.dispatchEvent(new Event('controllerchange'))
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    expect(fetchMock).toHaveBeenCalled()
  })
})
