/** Actions settle after four seconds of story time; a held pose needs no frames. */
export const STORY_MOTION_LIMIT_MS = 4000

export interface StoryClockOptions {
  lineIndex: number
  running: boolean
  complete?: boolean
  rate?: number
  take?: number
}

export interface StoryClockSnapshot {
  /** Story-time milliseconds. Infinity requests a readable, settled poster pose. */
  elapsed: number
  reducedMotion: boolean
  started: boolean
}

interface StoryClockDependencies {
  now: () => number
  requestFrame: (callback: () => void) => number
  cancelFrame: (id: number) => void
  onChange: (snapshot: StoryClockSnapshot) => void
}

export function safeStoryRate(rate: number | undefined): number {
  return Number.isFinite(rate) && rate! > 0 ? rate! : 1
}

/** A clamped ease-in-out, including the Infinity used by static/reduced-motion poses. */
export function easeProgress(elapsed: number, duration: number, delay = 0): number {
  if (elapsed === Infinity) return 1
  if (!Number.isFinite(elapsed)) return 0
  const start = Number.isFinite(delay) ? Math.max(0, delay) : 0
  const length = Number.isFinite(duration) ? Math.max(0, duration) : 0
  if (length === 0) return elapsed >= start ? 1 : 0
  const progress = Math.max(0, Math.min(1, (elapsed - start) / length))
  return progress * progress * (3 - 2 * progress)
}

export function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress
}

/**
 * Small DOM-free clock. Updating a line/take starts a new action; pausing keeps its
 * position. The scheduler is injected so cancellation and timing can be verified.
 */
export function createStoryMotionClock(initial: StoryClockOptions, deps: StoryClockDependencies, initialReducedMotion = false) {
  let options = { ...initial }
  let reducedMotion = initialReducedMotion
  let started = initial.running
  let elapsed = 0
  let lastWallTime: number | null = null
  let frame: number | null = null
  let generation = 0

  const snapshot = (): StoryClockSnapshot => ({
    elapsed: options.complete || reducedMotion || !started ? Infinity : elapsed,
    reducedMotion,
    started,
  })
  let published = snapshot()

  const emit = () => {
    const next = snapshot()
    if (next.elapsed === published.elapsed && next.reducedMotion === published.reducedMotion && next.started === published.started) return
    published = next
    deps.onChange({ ...next })
  }
  const settle = (now: number) => {
    if (lastWallTime === null) return
    elapsed = Math.min(STORY_MOTION_LIMIT_MS, elapsed + Math.max(0, now - lastWallTime) * safeStoryRate(options.rate))
    lastWallTime = now
  }
  const cancel = () => {
    generation++
    if (frame !== null) deps.cancelFrame(frame)
    frame = null
    lastWallTime = null
  }
  const canAnimate = () => options.running && !options.complete && !reducedMotion && elapsed < STORY_MOTION_LIMIT_MS
  const schedule = () => {
    const request = generation
    frame = deps.requestFrame(() => {
      if (request !== generation) return
      frame = null
      settle(deps.now())
      emit()
      if (canAnimate()) schedule()
      else lastWallTime = null
    })
  }

  return {
    getSnapshot: snapshot,
    update(next: StoryClockOptions, nextReducedMotion = false) {
      const now = deps.now()
      // Account for time at the previous speed before applying a speed change.
      settle(now)
      cancel()
      if (!Object.is(next.lineIndex, options.lineIndex) || !Object.is(next.take, options.take)) elapsed = 0
      if (!started && next.running && !next.complete) {
        started = true
        elapsed = 0
      }
      options = { ...next }
      reducedMotion = nextReducedMotion
      if (canAnimate()) {
        lastWallTime = now
        schedule()
      }
      emit()
    },
    /** Stop is reusable, so React's development effect rehearsal can restart it. */
    stop() {
      settle(deps.now())
      cancel()
    },
  }
}
