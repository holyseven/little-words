import { useEffect, useRef, useState } from 'react'

export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(() => !document.hidden)
  useEffect(() => {
    const show = () => setVisible(!document.hidden)
    const hide = () => setVisible(false)
    document.addEventListener('visibilitychange', show)
    window.addEventListener('pagehide', hide)
    window.addEventListener('pageshow', show)
    return () => {
      document.removeEventListener('visibilitychange', show)
      window.removeEventListener('pagehide', hide)
      window.removeEventListener('pageshow', show)
    }
  }, [])
  return visible
}

/** 游戏时间只在前台且无奖励遮罩时推进，恢复首帧不补算后台时间。 */
export function useGameLoop(enabled: boolean, onFrame: (deltaMs: number) => void): void {
  const callback = useRef(onFrame)
  callback.current = onFrame
  useEffect(() => {
    if (!enabled) return
    let frame = 0
    let previous: number | null = null
    const tick = (now: number) => {
      if (document.hidden) {
        previous = null
      } else {
        const delta = previous === null ? 0 : Math.min(now - previous, 64)
        previous = now
        callback.current(delta)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [enabled])
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const change = () => setReduced(media.matches)
    media.addEventListener('change', change)
    return () => media.removeEventListener('change', change)
  }, [])
  return reduced
}
