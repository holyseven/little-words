import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

class FakeUtterance {
  volume = 1
  rate = 1
  constructor(public text: string) {}
}

class FakeContext {
  state = 'running'
  currentTime = 0
  destination = {}
  resume = vi.fn(async () => { this.state = 'running' })
  close = vi.fn(async () => { this.state = 'closed' })
  createOscillator = vi.fn(() => ({
    connect: vi.fn((next: unknown) => next),
    start: vi.fn(),
    stop: vi.fn(),
  }))
  createGain = vi.fn(() => ({ gain: { value: 1 }, connect: vi.fn((next: unknown) => next) }))
}

describe('gesture audio unlock', () => {
  let context: FakeContext
  let construct: ReturnType<typeof vi.fn>
  let speech: { cancel: ReturnType<typeof vi.fn>; speak: ReturnType<typeof vi.fn> }
  let browser: EventTarget & { AudioContext?: unknown; speechSynthesis?: typeof speech }

  beforeEach(() => {
    vi.resetModules()
    context = new FakeContext()
    construct = vi.fn(function () { return context })
    speech = { cancel: vi.fn(), speak: vi.fn() }
    browser = Object.assign(new EventTarget(), { AudioContext: construct, speechSynthesis: speech })
    vi.stubGlobal('window', browser)
    vi.stubGlobal('navigator', {})
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)
  })

  afterEach(() => { vi.unstubAllGlobals() })

  it('primes speech only once across repeated play gestures and reuses the unlocked context', async () => {
    const { unlockAudio, getAudioContext, isAudioUnlocked, onAudioUnlockChange } = await import('../src/audio/audioUnlock')
    const changed = vi.fn()
    onAudioUnlockChange(changed)

    unlockAudio()
    unlockAudio()
    unlockAudio()

    expect(construct).toHaveBeenCalledTimes(1)
    expect(getAudioContext()).toBe(context)
    expect(isAudioUnlocked()).toBe(true)
    expect(changed).toHaveBeenCalledTimes(1)
    expect(changed).toHaveBeenCalledWith(true)
    expect(speech.cancel).toHaveBeenCalledTimes(1)
    expect(speech.speak).toHaveBeenCalledTimes(1)
    expect(speech.speak.mock.calls[0][0]).toMatchObject({ text: ' ', volume: 0, rate: 1 })
    expect(context.close).not.toHaveBeenCalled()
  })

  it('does not interrupt a later spoken word by injecting another silent utterance', async () => {
    const { unlockAudio } = await import('../src/audio/audioUnlock')
    unlockAudio()
    const word = new FakeUtterance('cat')
    speech.speak(word)

    unlockAudio()
    unlockAudio()

    expect(speech.cancel).toHaveBeenCalledTimes(1)
    expect(speech.speak).toHaveBeenCalledTimes(2)
    expect(speech.speak.mock.calls[1][0]).toBe(word)
  })

  it('resumes an interrupted Safari context within the next gesture without replacing it', async () => {
    const { unlockAudio, getAudioContext } = await import('../src/audio/audioUnlock')
    unlockAudio()
    context.state = 'interrupted'

    unlockAudio()

    expect(context.resume).toHaveBeenCalledTimes(1)
    await Promise.resolve()
    expect(context.state).toBe('running')
    expect(getAudioContext()).toBe(context)
    expect(construct).toHaveBeenCalledTimes(1)
    expect(context.close).not.toHaveBeenCalled()
    expect(speech.speak).toHaveBeenCalledTimes(1)
  })

  it('still unlocks speech when Web Audio resume rejects', async () => {
    const { unlockAudio, isAudioUnlocked } = await import('../src/audio/audioUnlock')
    context.state = 'suspended'
    context.resume.mockRejectedValue(new Error('Gesture unavailable'))

    expect(() => unlockAudio()).not.toThrow()
    await Promise.resolve()
    expect(isAudioUnlocked()).toBe(true)
    expect(speech.speak).toHaveBeenCalledTimes(1)
  })

  it('does not require the Audio Session API or AudioContext to initialize available speech', async () => {
    browser.AudioContext = undefined
    vi.stubGlobal('navigator', { get audioSession() { throw new Error('Unsupported') } })
    const { unlockAudio, isAudioUnlocked, getAudioContext } = await import('../src/audio/audioUnlock')

    expect(() => unlockAudio()).not.toThrow()
    unlockAudio()

    expect(getAudioContext()).toBeNull()
    expect(isAudioUnlocked()).toBe(true)
    expect(speech.speak).toHaveBeenCalledTimes(1)
  })

  it('removes the initial unlock listeners after the first input', async () => {
    const { installAudioUnlock, isAudioUnlocked } = await import('../src/audio/audioUnlock')
    const remove = vi.spyOn(browser, 'removeEventListener')
    installAudioUnlock()

    browser.dispatchEvent(new Event('pointerdown'))

    expect(isAudioUnlocked()).toBe(true)
    expect(context.createOscillator).toHaveBeenCalledTimes(1)
    expect(speech.speak).toHaveBeenCalledTimes(1)
    expect(remove).toHaveBeenCalledWith('pointerdown', expect.any(Function), true)
    expect(remove).toHaveBeenCalledWith('touchstart', expect.any(Function), true)
    expect(remove).toHaveBeenCalledWith('keydown', expect.any(Function), true)
  })
})
