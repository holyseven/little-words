export interface StoryPlaybackState {
  index: number
  status: 'idle' | 'playing' | 'paused' | 'ended'
  speaking: boolean
}

export interface StoryPlaybackDependencies {
  lineCount: number
  /** The promise reports startup only; onEnd reports the end of the actual audio. */
  playLine: (index: number, onEnd: () => void) => Promise<void> | void
  stop: () => void
  onChange: (state: StoryPlaybackState) => void
  gapMs?: number
}

/** Coordinate narrated scenes without depending on the DOM or an audio implementation. */
export function createStoryPlayback(deps: StoryPlaybackDependencies) {
  const count = Number.isFinite(deps.lineCount) ? Math.max(0, Math.floor(deps.lineCount)) : 0
  const gapMs = Number.isFinite(deps.gapMs) ? Math.max(0, deps.gapMs!) : 900
  let state: StoryPlaybackState = { index: 0, status: 'idle', speaking: false }
  let generation = 0
  let disposed = false
  let timer: ReturnType<typeof setTimeout> | null = null

  const emit = () => deps.onChange({ ...state })
  const clamp = (index: number) => Math.max(0, Math.min(count - 1, Number.isNaN(index) ? 0 : Math.trunc(index)))
  const active = (request: number) => !disposed && request === generation && state.status === 'playing'

  function cancel() {
    generation++
    if (timer !== null) clearTimeout(timer)
    timer = null
    // Cancellation still needs to invalidate callbacks if an audio implementation throws.
    try { deps.stop() } catch { /* The controller can still return to a usable paused state. */ }
  }

  function begin(index: number) {
    if (disposed) return
    cancel()
    if (count === 0) {
      state = { index: 0, status: 'ended', speaking: false }
      emit()
      return
    }

    const request = generation
    const currentIndex = clamp(index)
    let finished = false
    state = { index: currentIndex, status: 'playing', speaking: true }
    emit()
    if (!active(request)) return

    const fail = () => {
      if (finished || !active(request)) return
      finished = true
      cancel()
      state = { index: currentIndex, status: 'paused', speaking: false }
      emit()
    }

    const onEnd = () => {
      if (finished || !active(request)) return
      finished = true
      const last = currentIndex === count - 1
      state = { index: currentIndex, status: last ? 'ended' : 'playing', speaking: false }
      emit()
      if (last || !active(request)) return
      timer = setTimeout(() => {
        timer = null
        if (active(request)) begin(currentIndex + 1)
      }, gapMs)
    }

    try {
      // A synchronous onEnd is valid, and a late rejection after that end is ignored.
      const started = deps.playLine(currentIndex, onEnd)
      if (started) void Promise.resolve(started).catch(fail)
    } catch {
      fail()
    }
  }

  emit()

  return {
    play(index?: number): void {
      if (disposed) return
      if (state.status === 'playing' && (index === undefined || clamp(index) === state.index)) return
      begin(index ?? (state.status === 'ended' ? 0 : state.index))
    },
    pause(): void {
      if (disposed || state.status !== 'playing') return
      cancel()
      state = { index: state.index, status: 'paused', speaking: false }
      emit()
    },
    seek(index: number, autoplay = false): void {
      if (disposed) return
      if (autoplay) {
        begin(index)
      } else {
        cancel()
        state = { index: clamp(index), status: 'paused', speaking: false }
        emit()
      }
    },
    replay(): void {
      begin(state.index)
    },
    dispose(): void {
      if (disposed) return
      disposed = true
      cancel()
    },
  }
}
