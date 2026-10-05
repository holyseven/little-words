import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const installUpdateChecks = vi.hoisted(() => vi.fn())
vi.mock('../src/pwa/updates', () => ({ installUpdateChecks }))

let register: ReturnType<typeof vi.fn>
let getRegistration: ReturnType<typeof vi.fn>
let onRegistered: ReturnType<typeof vi.fn>
const cleanup = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('DEV', false)
  vi.stubEnv('BASE_URL', '/little-words/')
  vi.stubGlobal('window', { location: { href: 'https://example.test/little-words/?refresh=1#/parent' } })
  register = vi.fn().mockResolvedValue({ scope: 'https://example.test/little-words/' })
  getRegistration = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', { serviceWorker: { register, getRegistration } })
  onRegistered = vi.fn()
  installUpdateChecks.mockReturnValue(cleanup)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('application service worker registration', () => {
  it('uses the stable scoped URL without the HTTP cache and starts the single update flow', async () => {
    const { registerAppServiceWorker } = await import('../src/pwa/register')
    expect(await registerAppServiceWorker(onRegistered)).toBe(cleanup)
    expect(register).toHaveBeenCalledWith('https://example.test/little-words/sw.js', {
      scope: 'https://example.test/little-words/', updateViaCache: 'none',
    })
    expect(onRegistered).toHaveBeenCalledTimes(1)
    expect(installUpdateChecks).toHaveBeenCalledWith({ scope: 'https://example.test/little-words/' })
  })

  it('leaves development previews free of service workers', async () => {
    vi.stubEnv('DEV', true)
    const { registerAppServiceWorker } = await import('../src/pwa/register')
    expect(await registerAppServiceWorker(onRegistered)).toBeUndefined()
    expect(register).not.toHaveBeenCalled()
    expect(installUpdateChecks).not.toHaveBeenCalled()
  })

  it('reports registration failures without claiming offline readiness', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const error = new Error('blocked')
    register.mockRejectedValueOnce(error)
    const { registerAppServiceWorker } = await import('../src/pwa/register')
    expect(await registerAppServiceWorker(onRegistered)).toBeUndefined()
    expect(warn).toHaveBeenCalledWith('[sw] 注册失败', error)
    expect(onRegistered).not.toHaveBeenCalled()
    expect(installUpdateChecks).not.toHaveBeenCalled()
  })

  it('keeps recovery listeners when registration fails but the app has an active worker', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    register.mockRejectedValueOnce(new Error('offline during registration options update'))
    const existing = { scope: 'https://example.test/little-words/', active: {} }
    getRegistration.mockResolvedValueOnce(existing)
    const { registerAppServiceWorker } = await import('../src/pwa/register')
    expect(await registerAppServiceWorker(onRegistered)).toBe(cleanup)
    expect(getRegistration).toHaveBeenCalledWith('https://example.test/little-words/')
    expect(onRegistered).toHaveBeenCalledTimes(1)
    expect(installUpdateChecks).toHaveBeenCalledWith(existing)
  })

  it.each([
    { scope: 'https://example.test/', active: {} },
    { scope: 'https://example.test/little-words/', active: null },
  ])('does not recover through a broader or inactive registration: %j', async (existing) => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    register.mockRejectedValueOnce(new Error('offline'))
    getRegistration.mockResolvedValueOnce(existing)
    const { registerAppServiceWorker } = await import('../src/pwa/register')
    expect(await registerAppServiceWorker(onRegistered)).toBeUndefined()
    expect(onRegistered).not.toHaveBeenCalled()
    expect(installUpdateChecks).not.toHaveBeenCalled()
  })
})
