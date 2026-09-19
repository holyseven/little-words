import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const speech = vi.hoisted(() => ({ speak: vi.fn(), cancelSpeech: vi.fn() }))
vi.mock('../src/audio/tts', () => speech)
let context: object
vi.mock('../src/audio/audioUnlock', () => ({ getAudioContext: () => context, isAudioUnlocked: () => true }))

const sources: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; onended: (() => void) | null }[] = []
let requests: Map<string, (response: object) => void>

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  sources.length = 0
  requests = new Map()
  vi.stubGlobal('fetch', vi.fn((url: string) => new Promise((resolve) => requests.set(url, resolve))))
  context = {
    state: 'running', destination: {},
    decodeAudioData: (_bytes: ArrayBuffer, resolve: (buffer: object) => void) => {
      const buffer = { duration: 1 }
      resolve(buffer)
      return Promise.resolve(buffer)
    },
    createBufferSource: () => {
      const source = { start: vi.fn(), stop: vi.fn(), connect: vi.fn(), buffer: null, onended: null, playbackRate: { value: 1 } }
      sources.push(source)
      return source
    },
  }
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function deliver(word: string, ok = true) {
  requests.get(`/audio/w/${word}.m4a`)!({ ok, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) })
}

describe('人声异步加载与游戏切换', () => {
  it('首次播放等待音频恢复，恢复后只播放一次', async () => {
    let resume!: () => void
    Object.assign(context, {
      state: 'suspended',
      resume: () => new Promise<void>((resolve) => {
        resume = () => { Object.assign(context, { state: 'running' }); resolve() }
      }),
    })
    const { playClip } = await import('../src/audio/clips')
    const playing = playClip('w/cat')
    expect(sources).toHaveLength(0)
    expect(requests.size).toBe(0)
    resume()
    await Promise.resolve()
    deliver('cat')
    await playing
    expect(sources).toHaveLength(1)
    expect(sources[0].start).toHaveBeenCalledOnce()
  })

  it('解码期间被 iPad 暂停后，会在输出前再次恢复 AudioContext', async () => {
    const resume = vi.fn(async () => { Object.assign(context, { state: 'running' }) })
    Object.assign(context, {
      decodeAudioData: (_bytes: ArrayBuffer, resolve: (buffer: object) => void) => {
        resolve({ duration: 1 })
        Object.assign(context, { state: 'suspended', resume })
        return Promise.resolve({ duration: 1 })
      },
    })
    const { playClip } = await import('../src/audio/clips')
    const playing = playClip('w/cat')
    deliver('cat')
    await playing
    expect(resume).toHaveBeenCalledOnce()
    expect(sources[0]?.start).toHaveBeenCalledOnce()
  })

  it.each([true, false])('等待音频恢复时取消，不能再播放或兜底（恢复成功：%s）', async (succeeds) => {
    let settle!: () => void
    Object.assign(context, {
      state: 'suspended',
      resume: () => new Promise<void>((resolve, reject) => {
        settle = () => {
          if (succeeds) { Object.assign(context, { state: 'running' }); resolve() }
          else reject(new Error('Audio unavailable'))
        }
      }),
    })
    const { playClip, stopClip } = await import('../src/audio/clips')
    const playing = playClip('w/cat', { fallbackText: 'cat' })
    stopClip()
    settle()
    await playing
    expect(requests.size).toBe(0)
    expect(sources).toHaveLength(0)
    expect(speech.speak).not.toHaveBeenCalled()
  })

  it('连续翻牌时，旧单词先解码完成也不能抢播', async () => {
    const { playClip } = await import('../src/audio/clips')
    const old = playClip('w/cat')
    const latest = playClip('w/dog')
    deliver('cat')
    await old
    expect(sources).toHaveLength(0)
    deliver('dog')
    await latest
    expect(sources).toHaveLength(1)
    expect(sources[0].start).toHaveBeenCalledOnce()
  })

  it('离开页面或切后台后，尚未解码的人声不能自行开始', async () => {
    const { playClip, stopClip } = await import('../src/audio/clips')
    const playing = playClip('w/cat')
    stopClip()
    deliver('cat')
    await playing
    expect(sources).toHaveLength(0)
  })

  it('取消的请求后来加载失败，也不能再触发 TTS 兜底', async () => {
    const { playClip, stopClip } = await import('../src/audio/clips')
    const playing = playClip('w/cat', { fallbackText: 'cat' })
    stopClip()
    deliver('cat', false)
    await playing
    expect(speech.speak).not.toHaveBeenCalled()
  })
})

describe('整组单词串行朗读', () => {
  beforeEach(() => vi.useFakeTimers())

  it('按顺序播放，词间留 250ms，整组只完成一次', async () => {
    const { playClipSequence, stopClip } = await import('../src/audio/clips')
    const onEnd = vi.fn()
    const onCancel = vi.fn()
    const playing = playClipSequence([{ key: 'w/cat' }, { key: 'w/dog' }], { onEnd, onCancel })
    deliver('cat')
    await playing
    expect(sources).toHaveLength(1)
    expect(requests.has('/audio/w/dog.m4a')).toBe(false)
    const firstEnd = sources[0].onended!
    firstEnd()
    firstEnd()
    expect(onEnd).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(249)
    expect(requests.has('/audio/w/dog.m4a')).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    deliver('dog')
    await vi.advanceTimersByTimeAsync(0)
    expect(sources).toHaveLength(2)
    const lastEnd = sources[1].onended!
    lastEnd()
    lastEnd()
    expect(onEnd).toHaveBeenCalledOnce()
    stopClip()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('词间暂停时取消，剩余词不会重新开始', async () => {
    const { playClipSequence, stopClip } = await import('../src/audio/clips')
    const onEnd = vi.fn()
    const onCancel = vi.fn()
    const playing = playClipSequence([{ key: 'w/cat' }, { key: 'w/dog' }], { onEnd, onCancel })
    deliver('cat')
    await playing
    sources[0].onended!()
    stopClip()
    stopClip()
    await vi.advanceTimersByTimeAsync(1000)
    expect(requests.has('/audio/w/dog.m4a')).toBe(false)
    expect(onEnd).not.toHaveBeenCalled()
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('另一个角色开始讲话时取消旧序列，旧序列不会在插话后复活', async () => {
    const { playClipSequence, playClip } = await import('../src/audio/clips')
    const onEnd = vi.fn()
    const onCancel = vi.fn()
    const playing = playClipSequence([{ key: 'w/cat' }, { key: 'w/dog' }], { onEnd, onCancel })
    deliver('cat')
    await playing
    sources[0].onended!()
    const other = playClip('w/cow')
    deliver('cow')
    await other
    sources[1].onended!()
    await vi.advanceTimersByTimeAsync(1000)
    expect(requests.has('/audio/w/dog.m4a')).toBe(false)
    expect(sources).toHaveLength(2)
    expect(onEnd).not.toHaveBeenCalled()
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('等待解码时取消，解码完成不能开始播放或排下一词', async () => {
    let completeDecode!: () => void
    Object.assign(context, {
      decodeAudioData: (_bytes: ArrayBuffer, resolve: (buffer: object) => void) => {
        completeDecode = () => resolve({ duration: 1 })
      },
    })
    const { playClipSequence, stopClip } = await import('../src/audio/clips')
    const onEnd = vi.fn()
    const playing = playClipSequence([{ key: 'w/cat' }, { key: 'w/dog' }], { onEnd })
    deliver('cat')
    await vi.advanceTimersByTimeAsync(0)
    stopClip()
    completeDecode()
    await playing
    await vi.advanceTimersByTimeAsync(1000)
    expect(sources).toHaveLength(0)
    expect(requests.has('/audio/w/dog.m4a')).toBe(false)
    expect(onEnd).not.toHaveBeenCalled()
  })

  it('重播的新序列抢占旧序列，旧片段结束回调也不能继续旧队列', async () => {
    const { playClipSequence } = await import('../src/audio/clips')
    const oldEnd = vi.fn()
    const newEnd = vi.fn()
    const old = playClipSequence([{ key: 'w/cat' }, { key: 'w/dog' }], { onEnd: oldEnd })
    deliver('cat')
    await old
    const staleEnd = sources[0].onended!
    const latest = playClipSequence([{ key: 'w/cow' }, { key: 'w/pig' }], { onEnd: newEnd })
    expect(sources[0].stop).toHaveBeenCalledOnce()
    staleEnd()
    deliver('cow')
    await latest
    sources[1].onended!()
    await vi.advanceTimersByTimeAsync(250)
    expect(requests.has('/audio/w/dog.m4a')).toBe(false)
    deliver('pig')
    await vi.advanceTimersByTimeAsync(0)
    sources[2].onended!()
    expect(oldEnd).not.toHaveBeenCalled()
    expect(newEnd).toHaveBeenCalledOnce()
  })

  it('TTS 同步完成也逐项播放，不递归、不重复完成', async () => {
    speech.speak.mockImplementation((_text: string, opts: { onEnd?: () => void }) => {
      opts.onEnd?.()
      opts.onEnd?.()
    })
    const { playClipSequence } = await import('../src/audio/clips')
    const onEnd = vi.fn()
    await playClipSequence([
      { key: 'missing/one', fallbackText: 'one' },
      { key: 'missing/two', fallbackText: 'two' },
      { key: 'missing/three', fallbackText: 'three' },
    ], { onEnd })
    expect(speech.speak).toHaveBeenCalledTimes(1)
    expect(onEnd).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(500)
    expect(speech.speak.mock.calls.map(([text]) => text)).toEqual(['one', 'two', 'three'])
    expect(onEnd).toHaveBeenCalledOnce()
  })

  it('TTS 被取消后才返回结束事件，不会排入后续词', async () => {
    let staleEnd!: () => void
    speech.speak.mockImplementation((_text: string, opts: { onEnd: () => void }) => { staleEnd = opts.onEnd })
    const { playClipSequence, stopClip } = await import('../src/audio/clips')
    const onEnd = vi.fn()
    await playClipSequence([
      { key: 'missing/one', fallbackText: 'one' },
      { key: 'w/cat' },
    ], { onEnd })
    stopClip()
    staleEnd()
    await vi.advanceTimersByTimeAsync(1000)
    expect(requests.size).toBe(0)
    expect(onEnd).not.toHaveBeenCalled()
  })

  it('空序列立即完成一次', async () => {
    const { playClipSequence } = await import('../src/audio/clips')
    const onEnd = vi.fn()
    await playClipSequence([], { onEnd })
    await vi.runAllTimersAsync()
    expect(onEnd).toHaveBeenCalledOnce()
    expect(sources).toHaveLength(0)
  })
})
