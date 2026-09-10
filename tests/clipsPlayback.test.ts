import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const speech = vi.hoisted(() => ({ speak: vi.fn(), cancelSpeech: vi.fn() }))
vi.mock('../src/audio/tts', () => speech)
let context: object
vi.mock('../src/audio/audioUnlock', () => ({ getAudioContext: () => context, isAudioUnlocked: () => true }))

const sources: { start: ReturnType<typeof vi.fn> }[] = []
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
afterEach(() => vi.unstubAllGlobals())

function deliver(word: string, ok = true) {
  requests.get(`/audio/w/${word}.m4a`)!({ ok, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) })
}

describe('人声异步加载与游戏切换', () => {
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
