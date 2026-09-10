import { useEffect } from 'react'
import { useApp } from '../store/AppContext'
import { themes } from '../content'
import { accrueUsage } from '../logic/daily'
import { flushProgress } from '../store/progress'

/** 游戏/学习区域前台计时，家长设置与休息页不占用孩子时长。 */
export function useDailyTimer(enabled: boolean): void {
  const { settings, updateProgress } = useApp()
  useEffect(() => {
    if (!enabled) return
    let last: number | null = document.hidden ? null : Date.now()
    const tick = () => {
      const now = Date.now()
      if (last !== null) {
        const from = last
        updateProgress((p) => accrueUsage(p, from, now, themes, settings.unlockAll))
      }
      last = document.hidden ? null : now
    }
    const hide = () => { tick(); last = null; void flushProgress() }
    const visibility = () => { if (document.hidden) hide(); else { last = Date.now(); updateProgress((p) => p) } }
    const timer = window.setInterval(tick, 1000)
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('pagehide', hide)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('pagehide', hide)
      hide()
    }
  }, [enabled, settings.unlockAll, updateProgress])
}
