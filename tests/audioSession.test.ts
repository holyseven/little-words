import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface SessionStub { type: string }

describe('microphone and playback audio session', () => {
  let type: string
  let writes: string[]
  let audioSession: SessionStub

  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    type = 'auto'
    writes = []
    audioSession = {
      get type() { return type },
      set type(value: string) { type = value; writes.push(value) },
    }
    vi.stubGlobal('navigator', { audioSession })
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('sets playback in the calling gesture and shares the short restoration turn', async () => {
    const { preparePlaybackSession } = await import('../src/audio/session')

    const ready = preparePlaybackSession()
    expect(type).toBe('playback')
    expect(preparePlaybackSession()).toBe(ready)
    let finished = false
    void ready.then(() => { finished = true })
    await Promise.resolve()
    expect(finished).toBe(false)
    await vi.runAllTimersAsync()
    await ready
    await preparePlaybackSession()
    expect(writes).toEqual(['playback'])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('owns the input category from request through track release', async () => {
    const { beginMicrophoneSession, settleMicrophoneRequest, endMicrophoneSession, preparePlaybackSession } = await import('../src/audio/session')

    const lease = beginMicrophoneSession()
    expect(type).toBe('play-and-record')
    settleMicrophoneRequest(lease)
    await preparePlaybackSession()
    expect(type).toBe('play-and-record')
    endMicrophoneSession(lease)
    expect(type).toBe('playback')
    await vi.runAllTimersAsync()
    expect(writes).toEqual(['play-and-record', 'playback'])
  })

  it('does not restore during a cancelled but still pending getUserMedia request', async () => {
    const { beginMicrophoneSession, settleMicrophoneRequest, endMicrophoneSession, preparePlaybackSession } = await import('../src/audio/session')

    const lease = beginMicrophoneSession()
    endMicrophoneSession(lease)
    await preparePlaybackSession()
    expect(type).toBe('play-and-record')
    expect(vi.getTimerCount()).toBe(0)

    // The caller stops the late stream first, then settles its request.
    settleMicrophoneRequest(lease)
    expect(type).toBe('playback')
    await vi.runAllTimersAsync()
  })

  it('does not let a late cancelled capture override a newer microphone session', async () => {
    const { beginMicrophoneSession, settleMicrophoneRequest, endMicrophoneSession, preparePlaybackSession } = await import('../src/audio/session')

    const old = beginMicrophoneSession()
    endMicrophoneSession(old)
    const current = beginMicrophoneSession()
    settleMicrophoneRequest(current)
    settleMicrophoneRequest(old)
    endMicrophoneSession(old)
    await preparePlaybackSession()
    expect(writes).toEqual(['play-and-record'])

    endMicrophoneSession(current)
    expect(type).toBe('playback')
    await vi.runAllTimersAsync()
    expect(writes).toEqual(['play-and-record', 'playback'])
  })

  it('restores after all simultaneous captures finish, regardless of release order', async () => {
    const { beginMicrophoneSession, settleMicrophoneRequest, endMicrophoneSession } = await import('../src/audio/session')

    const first = beginMicrophoneSession()
    const second = beginMicrophoneSession()
    settleMicrophoneRequest(first)
    settleMicrophoneRequest(second)
    endMicrophoneSession(second)
    expect(type).toBe('play-and-record')
    endMicrophoneSession(first)
    settleMicrophoneRequest(first)
    endMicrophoneSession(first)
    expect(type).toBe('playback')
    await vi.runAllTimersAsync()
    expect(writes).toEqual(['play-and-record', 'playback'])
  })

  it('cannot switch a new capture to playback when an earlier restoration turn finishes', async () => {
    const { beginMicrophoneSession, settleMicrophoneRequest, endMicrophoneSession, preparePlaybackSession } = await import('../src/audio/session')

    const old = beginMicrophoneSession()
    settleMicrophoneRequest(old)
    endMicrophoneSession(old)
    const ready = preparePlaybackSession()
    const current = beginMicrophoneSession()
    settleMicrophoneRequest(current)
    await vi.runAllTimersAsync()
    await ready
    expect(type).toBe('play-and-record')
    expect(writes).toEqual(['play-and-record', 'playback', 'play-and-record'])

    endMicrophoneSession(current)
    await vi.runAllTimersAsync()
    expect(type).toBe('playback')
  })

  it('recovers normal playback after getUserMedia rejects', async () => {
    const { beginMicrophoneSession, settleMicrophoneRequest, endMicrophoneSession } = await import('../src/audio/session')

    const lease = beginMicrophoneSession()
    settleMicrophoneRequest(lease)
    endMicrophoneSession(lease)
    expect(type).toBe('playback')
    await vi.runAllTimersAsync()
  })

  it('restores a capture which starts and stops before the earlier restoration turn finishes', async () => {
    const { beginMicrophoneSession, settleMicrophoneRequest, endMicrophoneSession, preparePlaybackSession } = await import('../src/audio/session')

    const old = beginMicrophoneSession()
    settleMicrophoneRequest(old)
    endMicrophoneSession(old)
    const ready = preparePlaybackSession()
    const current = beginMicrophoneSession()
    settleMicrophoneRequest(current)
    endMicrophoneSession(current)
    expect(type).toBe('playback')
    expect(preparePlaybackSession()).toBe(ready)
    await vi.runAllTimersAsync()
    expect(writes).toEqual(['play-and-record', 'playback', 'play-and-record', 'playback'])
  })

  it('waits for a cancelled capture context to close before an immediate example can play', async () => {
    const { beginMicrophoneSession, settleMicrophoneRequest, markMicrophoneReleasing, endMicrophoneSession, preparePlaybackSession } = await import('../src/audio/session')
    const lease = beginMicrophoneSession()
    settleMicrophoneRequest(lease)
    let close!: () => void
    const closing = new Promise<void>((resolve) => { close = resolve })
    markMicrophoneReleasing(lease, closing)
    void closing.then(() => endMicrophoneSession(lease))
    let canPlay = false
    const ready = preparePlaybackSession().then(() => { canPlay = true })

    await Promise.resolve()
    expect(canPlay).toBe(false)
    expect(type).toBe('play-and-record')
    close()
    await vi.runAllTimersAsync()
    await ready
    expect(canPlay).toBe(true)
    expect(type).toBe('playback')
    expect(writes).toEqual(['play-and-record', 'playback'])
  })

  it('does not restore over a new capture when an old closing context finally releases', async () => {
    const { beginMicrophoneSession, settleMicrophoneRequest, markMicrophoneReleasing, endMicrophoneSession, preparePlaybackSession } = await import('../src/audio/session')
    const old = beginMicrophoneSession()
    settleMicrophoneRequest(old)
    let close!: () => void
    const closing = new Promise<void>((resolve) => { close = resolve })
    markMicrophoneReleasing(old, closing)
    void closing.then(() => endMicrophoneSession(old))
    const ready = preparePlaybackSession()
    const current = beginMicrophoneSession()
    settleMicrophoneRequest(current)

    close()
    await ready
    expect(type).toBe('play-and-record')
    expect(writes).toEqual(['play-and-record'])
    endMicrophoneSession(current)
    await vi.runAllTimersAsync()
    expect(type).toBe('playback')
  })

  it('continues to restore after capture-context closure rejects', async () => {
    const { beginMicrophoneSession, settleMicrophoneRequest, markMicrophoneReleasing, endMicrophoneSession, preparePlaybackSession } = await import('../src/audio/session')
    const lease = beginMicrophoneSession()
    settleMicrophoneRequest(lease)
    let rejectClose!: (reason: Error) => void
    const closing = new Promise<void>((_resolve, reject) => { rejectClose = reject })
    const cleanup = closing.catch(() => undefined)
    markMicrophoneReleasing(lease, closing)
    void cleanup.then(() => endMicrophoneSession(lease))
    const ready = preparePlaybackSession()

    rejectClose(new Error('Capture context already closed'))
    await vi.runAllTimersAsync()
    await expect(ready).resolves.toBeUndefined()
    expect(type).toBe('playback')
  })

  it.each(['missing navigator', 'missing API', 'API getter throws', 'API setter throws'])(
    'is a no-op when unsupported: %s', async (scenario) => {
      if (scenario === 'missing navigator') vi.stubGlobal('navigator', undefined)
      else if (scenario === 'missing API') vi.stubGlobal('navigator', {})
      else if (scenario === 'API getter throws') vi.stubGlobal('navigator', { get audioSession() { throw new Error('Unsupported') } })
      else vi.stubGlobal('navigator', { audioSession: { get type() { return 'auto' }, set type(_value: string) { throw new Error('Unsupported') } } })
      const { beginMicrophoneSession, settleMicrophoneRequest, endMicrophoneSession, preparePlaybackSession } = await import('../src/audio/session')

      const lease = beginMicrophoneSession()
      settleMicrophoneRequest(lease)
      endMicrophoneSession(lease)
      await preparePlaybackSession()
      expect(vi.getTimerCount()).toBe(0)
    },
  )
})
