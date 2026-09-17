import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const scope = 'https://example.test/little-words/'
let browser: EventTarget & { location: { href: string } }
let page: EventTarget & { visibilityState: string }
let network: { onLine: boolean; serviceWorker?: { getRegistration: ReturnType<typeof vi.fn> } }
let worker: { scope: string; active: object | null; installing: object | null; waiting: object | null; update: ReturnType<typeof vi.fn> }
let api: typeof import('../src/pwa/updates')
let cleanup: (() => void) | undefined

beforeEach(async () => {
  vi.resetModules()
  vi.stubEnv('BASE_URL', '/little-words/')
  vi.spyOn(Date, 'now').mockReturnValue(100_000)
  browser = Object.assign(new EventTarget(), { location: { href: `${scope}#/parent` } })
  page = Object.assign(new EventTarget(), { visibilityState: 'visible' })
  worker = { scope, active: {}, installing: null, waiting: null, update: vi.fn() }
  worker.update.mockResolvedValue(worker)
  network = { onLine: true, serviceWorker: { getRegistration: vi.fn().mockResolvedValue(worker) } }
  vi.stubGlobal('window', browser)
  vi.stubGlobal('document', page)
  vi.stubGlobal('navigator', network)
  api = await import('../src/pwa/updates')
})

afterEach(() => {
  cleanup?.()
  cleanup = undefined
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
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
})
