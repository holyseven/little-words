import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stopMicrophoneCapture, type CaptureResources } from '../src/audio/capture'
import { beginMicrophoneSession, settleMicrophoneRequest } from '../src/audio/session'

let mode: string
let events: string[]
let capture: CaptureResources

beforeEach(() => {
  events = []
  mode = 'playback'
  vi.stubGlobal('navigator', { audioSession: { get type() { return mode }, set type(value: string) { mode = value; events.push(value) } } })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  const microphoneLease = beginMicrophoneSession()
  settleMicrophoneRequest(microphoneLease)
  capture = {
    frame: 3, timer: null, microphoneLease, captureCleanup: null,
    audio: { state: 'running', close: vi.fn(async () => { events.push('context closed') }) } as unknown as AudioContext,
    stream: { getTracks: () => [{ stop: vi.fn(() => events.push('tracks stopped')) }] } as unknown as MediaStream,
    source: { disconnect: vi.fn() } as unknown as MediaStreamAudioSourceNode,
    processor: { disconnect: vi.fn(), onaudioprocess: vi.fn() } as unknown as ScriptProcessorNode,
    sink: { disconnect: vi.fn() } as unknown as GainNode,
  }
})

afterEach(async () => {
  await stopMicrophoneCapture(capture)
  vi.unstubAllGlobals()
})

describe('采音结束即释放麦克风', () => {
  it('先停止输入，再等待上下文关闭，最后恢复播放；保存的声音不丢失', async () => {
    let closed!: () => void
    const pcm = new Float32Array([0.1, -0.1])
    Object.assign(capture, { pcmChunks: [pcm], recognizer: { remove: vi.fn() } })
    ;(capture.audio!.close as ReturnType<typeof vi.fn>).mockReturnValue(new Promise<void>((resolve) => { closed = resolve }))
    const processor = capture.processor!
    const stopping = stopMicrophoneCapture(capture)
    expect(events).toEqual(['play-and-record', 'tracks stopped'])
    expect(processor.onaudioprocess).toBeNull()
    expect(mode).toBe('play-and-record')
    expect(capture.stream).toBeNull()
    closed()
    await stopping
    expect(mode).toBe('playback')
    expect((capture as CaptureResources & { pcmChunks: Float32Array[] }).pcmChunks[0]).toBe(pcm)
    expect((capture as CaptureResources & { recognizer: { remove: ReturnType<typeof vi.fn> } }).recognizer.remove).not.toHaveBeenCalled()
  })

  it('重复结束不会再关闭上下文或重复恢复模式', async () => {
    const closing = capture.audio!.close as ReturnType<typeof vi.fn>
    const first = stopMicrophoneCapture(capture)
    expect(stopMicrophoneCapture(capture)).toBe(first)
    await first
    await stopMicrophoneCapture(capture)
    expect(closing).toHaveBeenCalledTimes(1)
    expect(events.filter((event) => event === 'tracks stopped')).toHaveLength(1)
    expect(events.filter((event) => event === 'playback')).toHaveLength(1)
  })

  it('节点已断开、close拒绝也继续停止所有音轨并恢复模式', async () => {
    ;(capture.source!.disconnect as ReturnType<typeof vi.fn>).mockImplementation(() => { throw new Error('Disconnected') })
    ;(capture.audio!.close as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Closed'))
    await expect(stopMicrophoneCapture(capture)).resolves.toBeUndefined()
    expect(events).toContain('tracks stopped')
    expect(mode).toBe('playback')
  })
})
