import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const session = vi.hoisted(() => ({ preparePlaybackSession: vi.fn() }))
vi.mock('../src/audio/session', () => session)

class FakeUtterance {
  voice: SpeechSynthesisVoice | null = null
  lang = ''
  rate = 1
  pitch = 1
  volume = 1
  onend: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(public text: string) {}
}

const localVoice = { name: 'Samantha', lang: 'en-US', localService: true } as SpeechSynthesisVoice
let speech: {
  cancel: ReturnType<typeof vi.fn>
  speak: ReturnType<typeof vi.fn>
  getVoices: ReturnType<typeof vi.fn>
}

async function queuedSpeech() {
  await Promise.resolve()
  await Promise.resolve()
}

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  session.preparePlaybackSession.mockReset().mockResolvedValue(undefined)
  speech = { cancel: vi.fn(), speak: vi.fn(), getVoices: vi.fn(() => [localVoice]) }
  vi.stubGlobal('window', {
    speechSynthesis: speech,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
  })
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('fallback speech waits for microphone release', () => {
  it('starts only after output restoration and counts its timeout from actual speech', async () => {
    let ready!: () => void
    session.preparePlaybackSession.mockReturnValue(new Promise<void>((resolve) => { ready = resolve }))
    const { speak } = await import('../src/audio/tts')
    const ended = vi.fn()
    speak('cat', { onEnd: ended })

    expect(speech.speak).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(ended).not.toHaveBeenCalled()
    ready()
    await queuedSpeech()
    expect(speech.speak).toHaveBeenCalledTimes(1)
    expect(speech.speak.mock.calls[0][0]).toMatchObject({ text: 'cat', voice: localVoice, lang: 'en-US', volume: 1 })
    expect(vi.getTimerCount()).toBe(1)
    const utterance = speech.speak.mock.calls[0][0] as FakeUtterance
    utterance.onend?.()
    expect(ended).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not resurrect pending speech after cancellation or navigation', async () => {
    let ready!: () => void
    session.preparePlaybackSession.mockReturnValue(new Promise<void>((resolve) => { ready = resolve }))
    const { speak, cancelSpeech } = await import('../src/audio/tts')
    const ended = vi.fn()
    speak('cat', { onEnd: ended })
    cancelSpeech()
    ready()
    await queuedSpeech()

    expect(speech.speak).not.toHaveBeenCalled()
    expect(ended).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('lets the latest word supersede an older word awaiting microphone closure', async () => {
    let firstReady!: () => void
    let secondReady!: () => void
    session.preparePlaybackSession
      .mockReturnValueOnce(new Promise<void>((resolve) => { firstReady = resolve }))
      .mockReturnValueOnce(new Promise<void>((resolve) => { secondReady = resolve }))
    const { speak } = await import('../src/audio/tts')
    const firstEnded = vi.fn()
    const secondEnded = vi.fn()
    speak('cat', { onEnd: firstEnded })
    speak('dog', { onEnd: secondEnded })
    firstReady()
    await queuedSpeech()
    expect(speech.speak).not.toHaveBeenCalled()
    secondReady()
    await queuedSpeech()

    expect(speech.speak).toHaveBeenCalledTimes(1)
    const utterance = speech.speak.mock.calls[0][0] as FakeUtterance
    expect(utterance.text).toBe('dog')
    utterance.onend?.()
    expect(firstEnded).not.toHaveBeenCalled()
    expect(secondEnded).toHaveBeenCalledTimes(1)
  })

  it('ignores old utterance events instead of ending a new word or clearing its watchdog', async () => {
    const { speak } = await import('../src/audio/tts')
    const oldEnded = vi.fn()
    const currentEnded = vi.fn()
    speak('cat', { onEnd: oldEnded })
    await queuedSpeech()
    const old = speech.speak.mock.calls[0][0] as FakeUtterance
    speak('dog', { onEnd: currentEnded })
    await queuedSpeech()
    const current = speech.speak.mock.calls[1][0] as FakeUtterance
    old.onend?.()
    old.onerror?.()

    expect(oldEnded).not.toHaveBeenCalled()
    expect(currentEnded).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(1)
    current.onend?.()
    current.onerror?.()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(currentEnded).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('finishes a stuck utterance exactly once even if cancel emits an error', async () => {
    const { speak } = await import('../src/audio/tts')
    const ended = vi.fn()
    speak('cat', { onEnd: ended })
    await queuedSpeech()
    const utterance = speech.speak.mock.calls[0][0] as FakeUtterance
    speech.cancel.mockImplementation(() => utterance.onerror?.())

    await vi.advanceTimersByTimeAsync(5_180)
    utterance.onend?.()
    utterance.onerror?.()
    expect(ended).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['restoration', 'synthesis'])('finishes once after a %s failure', async (failure) => {
    if (failure === 'restoration') session.preparePlaybackSession.mockRejectedValue(new Error('Unavailable'))
    else speech.speak.mockImplementation(() => { throw new Error('Synthesis unavailable') })
    const { speak } = await import('../src/audio/tts')
    const ended = vi.fn()
    speak('cat', { onEnd: ended })
    await queuedSpeech()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(ended).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('retains configured voice and rate, while explicit options override the default', async () => {
    const selected = { name: 'Daniel', lang: 'en-GB', localService: true } as SpeechSynthesisVoice
    const remote = { name: 'Remote Ava', lang: 'en-US', localService: false } as SpeechSynthesisVoice
    speech.getVoices.mockReturnValue([remote, localVoice, selected])
    const { speak, setVoiceName, setRate } = await import('../src/audio/tts')
    setVoiceName('Daniel')
    setRate(0.7)
    speak('cat')
    await queuedSpeech()
    expect(speech.speak.mock.calls[0][0]).toMatchObject({ voice: selected, lang: 'en-GB', rate: 0.7, pitch: 1.05 })
    speak('dog', { rate: 0.9, pitch: 1 })
    await queuedSpeech()
    expect(speech.speak.mock.calls[1][0]).toMatchObject({ voice: selected, rate: 0.9, pitch: 1 })
  })

  it.each(['missing synthesis', 'blank text', 'missing English voice'])(
    'finishes synchronously without a queued playback when %s', async (scenario) => {
      if (scenario === 'missing synthesis') vi.stubGlobal('window', {})
      if (scenario === 'missing English voice') speech.getVoices.mockReturnValue([{ name: 'Tingting', lang: 'zh-CN', localService: true }])
      const { speak } = await import('../src/audio/tts')
      const ended = vi.fn()
      speak(scenario === 'blank text' ? ' ' : 'cat', { onEnd: ended })

      expect(ended).toHaveBeenCalledTimes(1)
      expect(speech.speak).not.toHaveBeenCalled()
      expect(session.preparePlaybackSession).not.toHaveBeenCalled()
      expect(vi.getTimerCount()).toBe(0)
    },
  )
})
