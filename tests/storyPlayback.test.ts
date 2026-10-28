import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createStoryPlayback, type StoryPlaybackDependencies, type StoryPlaybackState } from '../src/logic/storyPlayback'

function setup(overrides: Partial<StoryPlaybackDependencies> = {}) {
  const ends: (() => void)[] = []
  const changes: StoryPlaybackState[] = []
  const playLine = vi.fn((_index: number, onEnd: () => void) => { ends.push(onEnd) })
  const stop = vi.fn()
  const playback = createStoryPlayback({
    lineCount: 9,
    playLine,
    stop,
    onChange: (state) => { changes.push(state) },
    ...overrides,
  })
  return { playback, playLine, stop, ends, changes, last: () => changes[changes.length - 1] }
}

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('动画短片配音播放协调', () => {
  it('初始快照完整；九句只在实际音频结束后顺播，并留出看动作的间隔', async () => {
    const s = setup({ playLine: vi.fn(async (_index, onEnd) => { s.ends.push(onEnd) }) })
    expect(s.last()).toEqual({ index: 0, status: 'idle', speaking: false })
    s.playback.play()
    expect(s.last()).toEqual({ index: 0, status: 'playing', speaking: true })
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(10_000)
    // Resolving playLine means startup succeeded, not that the narration ended.
    expect(s.last()).toEqual({ index: 0, status: 'playing', speaking: true })

    for (let index = 0; index < 9; index++) {
      s.ends[index]()
      expect(s.last()).toEqual({ index, status: index === 8 ? 'ended' : 'playing', speaking: false })
      if (index < 8) {
        await vi.advanceTimersByTimeAsync(899)
        expect(s.last().index).toBe(index)
        await vi.advanceTimersByTimeAsync(1)
        expect(s.last()).toEqual({ index: index + 1, status: 'playing', speaking: true })
      }
    }
    await vi.runAllTimersAsync()
    expect(s.ends).toHaveLength(9)
    s.playback.play()
    expect(s.last()).toEqual({ index: 0, status: 'playing', speaking: true })
  })

  it('暂停会打断当前句，继续从本句开头重播，旧结束事件不能推进', async () => {
    const s = setup()
    s.playback.play(3)
    s.playback.pause()
    expect(s.stop).toHaveBeenCalledTimes(2)
    expect(s.last()).toEqual({ index: 3, status: 'paused', speaking: false })
    s.playback.play()
    expect(s.playLine.mock.calls.map(([index]) => index)).toEqual([3, 3])
    s.ends[0]()
    await vi.runAllTimersAsync()
    expect(s.last()).toEqual({ index: 3, status: 'playing', speaking: true })
    s.ends[1]()
    await vi.advanceTimersByTimeAsync(900)
    expect(s.last().index).toBe(4)
  })

  it('句间暂停取消计时器，再播放会重读当前句', async () => {
    const s = setup()
    s.playback.play(2)
    s.ends[0]()
    s.playback.pause()
    await vi.runAllTimersAsync()
    expect(s.last()).toEqual({ index: 2, status: 'paused', speaking: false })
    s.playback.play()
    expect(s.playLine.mock.calls.map(([index]) => index)).toEqual([2, 2])
  })

  it('上下一句和重听使旧计时器、旧结束事件失效，并限定合法句号', async () => {
    const s = setup()
    s.playback.play()
    s.ends[0]()
    s.playback.seek(100)
    expect(s.last()).toEqual({ index: 8, status: 'paused', speaking: false })
    await vi.runAllTimersAsync()
    expect(s.playLine).toHaveBeenCalledOnce()
    s.playback.seek(-5, true)
    expect(s.last()).toEqual({ index: 0, status: 'playing', speaking: true })
    s.playback.seek(4.9, true)
    s.playback.replay()
    expect(s.playLine.mock.calls.map(([index]) => index)).toEqual([0, 0, 4, 4])
    s.ends[1]()
    s.ends[2]()
    await vi.runAllTimersAsync()
    expect(s.last()).toEqual({ index: 4, status: 'playing', speaking: true })
    s.ends[3]()
    await vi.advanceTimersByTimeAsync(900)
    expect(s.last().index).toBe(5)
  })

  it('播放中重复点播放保持幂等，句间也不会重播或提前进入下一句', async () => {
    const s = setup()
    s.playback.play(2)
    s.playback.play()
    s.playback.play(2)
    expect(s.playLine).toHaveBeenCalledOnce()
    s.ends[0]()
    s.playback.play()
    await vi.advanceTimersByTimeAsync(900)
    expect(s.playLine.mock.calls.map(([index]) => index)).toEqual([2, 3])
  })

  it('同步结束和重复结束都只推进一次，结束后的迟到拒绝不暂停下一句', async () => {
    const ends: (() => void)[] = []
    let rejectFirst!: (reason?: unknown) => void
    const playLine = vi.fn((index: number, onEnd: () => void) => {
      ends.push(onEnd)
      if (index === 0) {
        onEnd()
        onEnd()
        return new Promise<void>((_resolve, reject) => { rejectFirst = reject })
      }
    })
    const s = setup({ playLine, gapMs: 20 })
    s.playback.play()
    expect(s.last()).toEqual({ index: 0, status: 'playing', speaking: false })
    await vi.advanceTimersByTimeAsync(20)
    rejectFirst(new Error('late startup failure'))
    await Promise.resolve()
    ends[0]()
    expect(s.last()).toEqual({ index: 1, status: 'playing', speaking: true })
    expect(playLine.mock.calls.map(([index]) => index)).toEqual([0, 1])
  })

  it('当前句启动失败回到可重试状态，失败后的结束回调不能继续', async () => {
    let reject!: (reason?: unknown) => void
    let end!: () => void
    const s = setup({ playLine: vi.fn((_index, onEnd) => {
      end = onEnd
      return new Promise<void>((_resolve, rejectPromise) => { reject = rejectPromise })
    }) })
    s.playback.play(4)
    reject(new Error('audio unavailable'))
    await Promise.resolve()
    expect(s.last()).toEqual({ index: 4, status: 'paused', speaking: false })
    end()
    await vi.runAllTimersAsync()
    expect(s.last().status).toBe('paused')
    s.playback.play()
    expect(s.last()).toEqual({ index: 4, status: 'playing', speaking: true })
  })

  it('同步异常会停止并暂停，新的句子不受旧异步拒绝影响', async () => {
    let reject!: (reason?: unknown) => void
    const playLine = vi.fn((index: number) => {
      if (index === 0) return new Promise<void>((_resolve, fail) => { reject = fail })
      if (index === 1) throw new Error('unsupported clip')
    })
    const s = setup({ playLine })
    s.playback.play()
    s.playback.seek(2, true)
    reject(new Error('old request'))
    await Promise.resolve()
    expect(s.last()).toEqual({ index: 2, status: 'playing', speaking: true })
    s.playback.seek(1, true)
    expect(s.last()).toEqual({ index: 1, status: 'paused', speaking: false })
  })

  it('销毁后所有入口、旧计时器、迟到回调和异步错误都不会复活播放', async () => {
    let reject!: (reason?: unknown) => void
    let end!: () => void
    const playLine = vi.fn((_index: number, onEnd: () => void) => {
      end = onEnd
      return new Promise<void>((_resolve, fail) => { reject = fail })
    })
    const s = setup({ playLine })
    s.playback.play()
    s.playback.dispose()
    const changeCount = s.changes.length
    const stopCount = s.stop.mock.calls.length
    end()
    reject(new Error('late'))
    s.playback.play()
    s.playback.seek(8, true)
    s.playback.replay()
    s.playback.pause()
    s.playback.dispose()
    await vi.runAllTimersAsync()
    expect(playLine).toHaveBeenCalledOnce()
    expect(s.changes).toHaveLength(changeCount)
    expect(s.stop).toHaveBeenCalledTimes(stopCount)

    const gap = setup()
    gap.playback.play()
    gap.ends[0]()
    gap.playback.dispose()
    await vi.runAllTimersAsync()
    expect(gap.playLine).toHaveBeenCalledOnce()
  })

  it('传出的快照被修改不会污染内部状态，空短片不会调用音频', () => {
    const s = setup()
    s.last().index = 8
    s.playback.play()
    expect(s.playLine.mock.calls[0][0]).toBe(0)
    const empty = setup({ lineCount: 0 })
    empty.playback.play()
    expect(empty.last()).toEqual({ index: 0, status: 'ended', speaking: false })
    expect(empty.playLine).not.toHaveBeenCalled()
  })
})
