import { describe, expect, it, vi } from 'vitest'
import { createStoryMotionClock, easeProgress, lerp, safeStoryRate, STORY_MOTION_LIMIT_MS, type StoryClockOptions } from '../src/logic/storyMotion'

function setup(initial: StoryClockOptions = { lineIndex: 0, running: false }, reducedMotion = false) {
  let now = 0
  let nextId = 0
  const pending = new Map<number, () => void>()
  const allFrames = new Map<number, () => void>()
  const onChange = vi.fn()
  const cancelFrame = vi.fn((id: number) => { pending.delete(id) })
  const clock = createStoryMotionClock(initial, {
    now: () => now,
    requestFrame: (callback) => {
      const id = ++nextId
      pending.set(id, callback)
      allFrames.set(id, callback)
      return id
    },
    cancelFrame,
    onChange,
  }, reducedMotion)
  return {
    clock, pending, allFrames, onChange, cancelFrame,
    setTime(time: number) { now = time },
    frame(time: number) {
      now = time
      const callbacks = [...pending.values()]
      pending.clear()
      callbacks.forEach((callback) => callback())
    },
  }
}

describe('story motion clock', () => {
  it('shows a settled preview, then starts the first spoken action from zero', () => {
    const s = setup()
    expect(s.clock.getSnapshot()).toEqual({ elapsed: Infinity, reducedMotion: false, started: false })
    s.clock.update({ lineIndex: 0, running: false })
    expect(s.pending.size).toBe(0)
    s.setTime(2000)
    s.clock.update({ lineIndex: 0, running: true })
    expect(s.clock.getSnapshot()).toEqual({ elapsed: 0, reducedMotion: false, started: true })
    s.frame(2250)
    expect(s.clock.getSnapshot().elapsed).toBe(250)
  })

  it('freezes on pause and resumes without counting the paused wall time', () => {
    const s = setup({ lineIndex: 0, running: true })
    s.clock.update({ lineIndex: 0, running: true })
    s.frame(200)
    s.setTime(250)
    s.clock.update({ lineIndex: 0, running: false })
    expect(s.clock.getSnapshot().elapsed).toBe(250)
    expect(s.pending.size).toBe(0)
    s.frame(2000)
    expect(s.clock.getSnapshot().elapsed).toBe(250)
    s.clock.update({ lineIndex: 0, running: true })
    s.frame(2100)
    expect(s.clock.getSnapshot().elapsed).toBe(350)
  })

  it('resets a changed line or replay take and ignores canceled frame callbacks', () => {
    const s = setup({ lineIndex: 0, running: true, take: 1 })
    s.clock.update({ lineIndex: 0, running: true, take: 1 })
    const stale = s.allFrames.get(1)!
    s.frame(600)
    s.clock.update({ lineIndex: 1, running: true, take: 1 })
    expect(s.clock.getSnapshot().elapsed).toBe(0)
    const changes = s.onChange.mock.calls.length
    stale()
    expect(s.onChange.mock.calls.length).toBe(changes)
    expect(s.pending.size).toBe(1)
    s.frame(1000)
    expect(s.clock.getSnapshot().elapsed).toBe(400)
    s.clock.update({ lineIndex: 1, running: false, take: 2 })
    expect(s.clock.getSnapshot().elapsed).toBe(0)
    expect(s.pending.size).toBe(0)
  })

  it('settles the previous speed before changing rate, with invalid rates using 1', () => {
    const s = setup({ lineIndex: 0, running: true, rate: 0.7 })
    s.clock.update({ lineIndex: 0, running: true, rate: 0.7 })
    s.frame(1000)
    expect(s.clock.getSnapshot().elapsed).toBe(700)
    s.setTime(1100)
    s.clock.update({ lineIndex: 0, running: true, rate: 2 })
    expect(s.clock.getSnapshot().elapsed).toBe(770)
    s.frame(1200)
    expect(s.clock.getSnapshot().elapsed).toBe(970)
    s.clock.update({ lineIndex: 0, running: true, rate: NaN })
    s.frame(1300)
    expect(s.clock.getSnapshot().elapsed).toBe(1070)
    for (const rate of [undefined, NaN, Infinity, -1, 0]) expect(safeStoryRate(rate)).toBe(1)
  })

  it('stops scheduling at four seconds of story time and can animate the next line', () => {
    const s = setup({ lineIndex: 0, running: true, rate: 0.5 })
    s.clock.update({ lineIndex: 0, running: true, rate: 0.5 })
    s.frame(6000)
    expect(s.clock.getSnapshot().elapsed).toBe(3000)
    expect(s.pending.size).toBe(1)
    s.frame(10_000)
    expect(s.clock.getSnapshot().elapsed).toBe(STORY_MOTION_LIMIT_MS)
    expect(s.pending.size).toBe(0)
    s.clock.update({ lineIndex: 0, running: true, rate: 0.5 })
    expect(s.pending.size).toBe(0)
    s.clock.update({ lineIndex: 1, running: true, rate: 0.5 })
    expect(s.clock.getSnapshot().elapsed).toBe(0)
    expect(s.pending.size).toBe(1)
  })

  it('shows final poses for completion and reduced motion without scheduling frames', () => {
    const s = setup({ lineIndex: 0, running: true }, true)
    s.clock.update({ lineIndex: 0, running: true }, true)
    expect(s.clock.getSnapshot()).toEqual({ elapsed: Infinity, reducedMotion: true, started: true })
    expect(s.pending.size).toBe(0)
    s.clock.update({ lineIndex: 0, running: true }, false)
    s.frame(300)
    expect(s.clock.getSnapshot().elapsed).toBe(300)
    s.clock.update({ lineIndex: 0, running: true, complete: true })
    expect(s.clock.getSnapshot().elapsed).toBe(Infinity)
    expect(s.pending.size).toBe(0)
  })

  it('replays from a completed last line using the new take rather than the held ending', () => {
    const s = setup({ lineIndex: 8, running: true, take: 3 })
    s.clock.update({ lineIndex: 8, running: true, take: 3 })
    s.frame(1800)
    s.clock.update({ lineIndex: 8, running: false, complete: true, take: 3 })
    expect(s.clock.getSnapshot().elapsed).toBe(Infinity)
    s.setTime(6000)
    s.clock.update({ lineIndex: 0, running: true, complete: false, take: 4 })
    expect(s.clock.getSnapshot().elapsed).toBe(0)
    s.frame(6100)
    expect(s.clock.getSnapshot().elapsed).toBe(100)
  })

  it('immediately settles when reduced motion is enabled and rejects the old frame', () => {
    const s = setup({ lineIndex: 1, running: true })
    s.clock.update({ lineIndex: 1, running: true })
    s.frame(200)
    const stale = [...s.pending.values()][0]
    s.clock.update({ lineIndex: 1, running: true }, true)
    expect(s.pending.size).toBe(0)
    expect(s.clock.getSnapshot().elapsed).toBe(Infinity)
    s.setTime(8000)
    stale()
    expect(s.pending.size).toBe(0)
    expect(s.clock.getSnapshot().elapsed).toBe(Infinity)
    // Preference changes do not secretly accrue eight seconds of story time.
    s.clock.update({ lineIndex: 1, running: true }, false)
    expect(s.clock.getSnapshot().elapsed).toBe(200)
    s.frame(8100)
    expect(s.clock.getSnapshot().elapsed).toBe(300)
  })

  it('cancels pending frames on cleanup and supports an effect restart', () => {
    const s = setup({ lineIndex: 0, running: true })
    s.clock.update({ lineIndex: 0, running: true })
    const stale = s.allFrames.get(1)!
    s.setTime(50)
    s.clock.stop()
    expect(s.pending.size).toBe(0)
    stale()
    expect(s.onChange).not.toHaveBeenCalled()
    s.setTime(1000)
    s.clock.update({ lineIndex: 0, running: true })
    s.frame(1100)
    expect(s.clock.getSnapshot().elapsed).toBe(150)
  })
})

describe('story motion interpolation', () => {
  it('holds before a delayed beat, eases through it, and settles after it', () => {
    expect(easeProgress(100, 1000, 200)).toBe(0)
    expect(easeProgress(450, 1000, 200)).toBeCloseTo(0.15625)
    expect(easeProgress(700, 1000, 200)).toBe(0.5)
    expect(easeProgress(1200, 1000, 200)).toBe(1)
    expect(easeProgress(Infinity, 1000, 200)).toBe(1)
    expect(lerp(150, 350, easeProgress(700, 1000, 200))).toBe(250)
  })

  it('handles zero-duration beats and malformed elapsed values without NaN poses', () => {
    expect(easeProgress(99, 0, 100)).toBe(0)
    expect(easeProgress(100, 0, 100)).toBe(1)
    expect(easeProgress(NaN, 1000)).toBe(0)
    expect(easeProgress(-Infinity, 1000)).toBe(0)
    expect(easeProgress(-100, 1000)).toBe(0)
  })
})
