import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createStoryMotionClock, type StoryClockOptions, type StoryClockSnapshot } from '../logic/storyMotion'

const useBrowserLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect
const motionQuery = '(prefers-reduced-motion: reduce)'

function prefersReducedMotion() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(motionQuery).matches
}

/** A bounded per-line clock: previews/endings settle, pauses freeze, replays reset. */
export function useStoryClock({ lineIndex, running, complete = false, rate = 1, take }: StoryClockOptions): StoryClockSnapshot {
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion)
  const [snapshot, setSnapshot] = useState<StoryClockSnapshot>(() => ({
    elapsed: running && !complete && !reducedMotion ? 0 : Infinity,
    reducedMotion,
    started: running,
  }))
  const clock = useRef<ReturnType<typeof createStoryMotionClock> | null>(null)
  if (clock.current === null) {
    clock.current = createStoryMotionClock({ lineIndex, running, complete, rate, take }, {
      now: () => performance.now(),
      requestFrame: (callback) => requestAnimationFrame(callback),
      cancelFrame: (id) => cancelAnimationFrame(id),
      onChange: setSnapshot,
    }, reducedMotion)
  }

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const media = window.matchMedia(motionQuery)
    const change = () => setReducedMotion(media.matches)
    change()
    media.addEventListener('change', change)
    return () => media.removeEventListener('change', change)
  }, [])

  useBrowserLayoutEffect(() => {
    const current = clock.current!
    current.update({ lineIndex, running, complete, rate, take }, reducedMotion)
    return () => current.stop()
  }, [lineIndex, running, complete, rate, take, reducedMotion])

  return snapshot
}
