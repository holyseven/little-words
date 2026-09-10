/**
 * 全局状态：进度 + 设置。
 * 单一 Provider 挂在 App 顶层，避免 M0 就引入状态库。
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import {
  emptyProgress,
  flushProgress,
  getThemeProgress,
  installProgressFlushOnHide,
  loadProgress,
  saveProgress,
  type Progress,
} from './progress'
import {
  applyAppearance,
  defaultSettings,
  loadSettings,
  saveSettings,
  type Settings,
} from './settings'
import { dbReplace, requestPersistence } from './db'
import { setRate, setVoiceName } from '../audio/tts'
import { setSfxEnabled } from '../audio/sfx'
import { awardStickers, isThemeComplete, reconcileRewards } from '../logic/rewards'
import { getTheme, themes } from '../content'
import { applyDailyEvent, awardDailyBonus, ensureDaily, type DailyEvent } from '../logic/daily'
import { setClipRate } from '../audio/clips'

/** 一次得星后新解锁的奖励，用于驱动庆祝动画 */
export interface RewardEvent {
  /** 新获得的贴纸 emoji */
  stickers: string[]
  /** 新完成的主题 id（徽章） */
  badges: string[]
}

interface AppState {
  /** IndexedDB 读取完成前为 false，UI 显示轻量加载态 */
  ready: boolean
  progress: Progress
  settings: Settings
  /** 用更新函数改进度，自动防抖落盘 */
  updateProgress: (fn: (p: Progress) => Progress) => void
  updateSettings: (patch: Partial<Settings>) => void
  /** 加星；会顺带结算贴纸 */
  addStars: (n: number) => void
  /** 标记「我认识了」，首次标记 +1 星；已标记过返回 false */
  markLearned: (themeId: string, wordId: string) => boolean
  isLearned: (themeId: string, wordId: string) => boolean
  /** 检查某主题是否刚刚达成完成条件，达成则发徽章 */
  checkThemeComplete: (themeId: string) => boolean
  /** 待展示的奖励（贴纸/徽章）；展示完调 clearReward */
  reward: RewardEvent | null
  clearReward: () => void
  recordDaily: (event: DailyEvent) => void
  dailyCelebration: string | null
  clearDailyCelebration: () => void
  parentAuthorized: boolean
  authorizeParent: () => void
  revokeParent: () => void
  replaceData: (p: Progress, s: Settings) => Promise<void>
  dataEpoch: number
}

const AppContext = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [progress, setProgress] = useState<Progress>(emptyProgress)
  const progressRef = useRef(progress)
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const settingsRef = useRef(settings)
  const [reward, setReward] = useState<RewardEvent | null>(null)
  const [dailyCelebration, setDailyCelebration] = useState<string | null>(null)
  const [parentAuthorized, setParentAuthorized] = useState(false)
  const [dataEpoch, setDataEpoch] = useState(0)

  // 首屏加载完成前不要把默认值写回库，否则会覆盖真实存档
  const loadedRef = useRef(false)

  /**
   * 同一次交互可能同时发贴纸和徽章，先收集，再随 progress 提交统一展示。
   */
  const pendingReward = useRef<RewardEvent>({ stickers: [], badges: [] })

  // 每次 progress 变化后检查有没有待展示的奖励
  useEffect(() => {
    const p = pendingReward.current
    if (p.stickers.length === 0 && p.badges.length === 0) return

    // 合并同一轮交互产生的贴纸和徽章。
    const stickers = [...new Set(p.stickers)]
    const badges = [...new Set(p.badges)]
    pendingReward.current = { stickers: [], badges: [] }

    setReward((prev) =>
      prev
        ? {
            stickers: [...new Set([...prev.stickers, ...stickers])],
            badges: [...new Set([...prev.badges, ...badges])],
          }
        : { stickers, badges },
    )
  }, [progress])

  useEffect(() => {
    let alive = true

    void (async () => {
      const [p, s] = await Promise.all([loadProgress(), loadSettings()])
      if (!alive) return

      // 存档可能来自导入/旧版本/丢过写入，启动时把奖励规则重新对一遍
      const reconciled = ensureDaily(reconcileRewards(p, themes), themes, s.unlockAll, new Date(), s.dailySource === 'course' ? s.currentUnitId : undefined)
      progressRef.current = reconciled
      setProgress(reconciled)
      setSettings(s)
      settingsRef.current = s
      loadedRef.current = true
      setReady(true)

      // 补齐结果要写回去，否则每次启动都重算一遍
      if (reconciled !== p) saveProgress(reconciled)

      // 申请持久化存储，结果记进设置供家长页展示（SPEC 11.4）
      const persisted = await requestPersistence()
      if (!alive) return
      if (persisted !== s.persisted) {
        const next = { ...settingsRef.current, persisted }
        settingsRef.current = next
        setSettings(next)
        void saveSettings(next)
      }
    })()

    const uninstallFlush = installProgressFlushOnHide()

    return () => {
      alive = false
      uninstallFlush()
    }
  }, [])

  // 设置里与音频/外观相关的部分同步到各模块
  useEffect(() => {
    applyAppearance(settings.appearance)
    setSfxEnabled(settings.sfx)
    setRate(settings.rate)
    setClipRate(settings.rate)
    setVoiceName(settings.voiceName)
  }, [settings.appearance, settings.sfx, settings.rate, settings.voiceName])

  useEffect(() => {
    const refresh = () => applyAppearance(settingsRef.current.appearance)
    const media = matchMedia('(prefers-color-scheme: dark)')
    const timer = window.setInterval(refresh, 30000)
    media.addEventListener('change', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => { clearInterval(timer); media.removeEventListener('change', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [])

  const updateProgress = useCallback((fn: (p: Progress) => Progress) => {
    // 同步处理事件中的结算，让紧随其后的检查/flush 读到最新存档。
    // 随机发贴纸与写盘不能放进 React 会重复执行的 state updater。
    const previous = progressRef.current
    const today = ensureDaily(previous, themes, settingsRef.current.unlockAll, new Date(), settingsRef.current.dailySource === 'course' ? settingsRef.current.currentUnitId : undefined)
    let next = awardDailyBonus(fn(today))
    if (next.daily.rewarded && (!today.daily.rewarded || today.daily.date !== next.daily.date)) setDailyCelebration(next.daily.date)
    const { gained, stickers } = awardStickers(next.stars, next.stickers)
    if (gained.length) {
      pendingReward.current.stickers.push(...gained)
      next = { ...next, stickers }
    }
    if (next === previous) return
    progressRef.current = next
    if (loadedRef.current) saveProgress(next)
    setProgress(next)
    if (gained.length || next.daily.rewarded !== previous.daily.rewarded) void flushProgress()
  }, [])

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    const next = { ...settingsRef.current, ...patch }
    settingsRef.current = next
    setSettings(next)
    if (loadedRef.current) void saveSettings(next)
  }, [])

  /**
   * 加星并结算贴纸（SPEC 7.8：每 10 颗星自动获得 1 张）。
   * 贴纸按「应有数量 - 已有数量」补齐，所以即使某次写入丢了也能自愈。
   */
  const addStars = useCallback(
    (n: number) => {
      if (n === 0) return

      updateProgress((p) => ({ ...p, stars: p.stars + n }))
    },
    [updateProgress],
  )

  const isLearned = useCallback(
    (themeId: string, wordId: string) =>
      getThemeProgress(progress, themeId).learned.includes(wordId),
    [progress],
  )

  const markLearned = useCallback(
    (themeId: string, wordId: string) => {
      let firstTime = false

      updateProgress((p) => {
        const theme = getThemeProgress(p, themeId)
        if (theme.learned.includes(wordId)) return p

        firstTime = true
        // 首次标记 +1 星；贴纸由 updateProgress 统一结算并立即保存。
        const stars = p.stars + 1

        return applyDailyEvent({
          ...p,
          stars,
          themes: {
            ...p.themes,
            [themeId]: { ...theme, learned: [...theme.learned, wordId] },
          },
        }, { kind: 'learn', wordId })
      })

      // 得星是关键节点，立即落盘
      if (firstTime) void flushProgress()
      return firstTime
    },
    [updateProgress],
  )

  /**
   * 检查主题是否刚达成完成条件（SPEC 7.2），达成则发徽章。
   * 由页面在得星/局末之后调用。
   */
  const checkThemeComplete = useCallback(
    (themeId: string) => {
      const theme = getTheme(themeId)
      if (!theme) return false

      let justCompleted = false

      updateProgress((p) => {
        if (p.badges.includes(themeId)) return p

        const tp = getThemeProgress(p, themeId)
        if (!isThemeComplete(theme, tp)) return p

        justCompleted = true
        pendingReward.current.badges.push(themeId)

        return {
          ...p,
          badges: [...p.badges, themeId],
          themes: { ...p.themes, [themeId]: { ...tp, completed: true } },
        }
      })

      if (justCompleted) void flushProgress()
      return justCompleted
    },
    [updateProgress],
  )

  const clearReward = useCallback(() => setReward(null), [])
  const recordDaily = useCallback((event: DailyEvent) => updateProgress((p) => applyDailyEvent(p, event)), [updateProgress])
  const clearDailyCelebration = useCallback(() => setDailyCelebration(null), [])
  const authorizeParent = useCallback(() => setParentAuthorized(true), [])
  const revokeParent = useCallback(() => setParentAuthorized(false), [])
  const replaceData = useCallback(async (p: Progress, s: Settings) => {
    const next = ensureDaily(reconcileRewards(p, themes), themes, s.unlockAll, new Date(), s.dailySource === 'course' ? s.currentUnitId : undefined)
    await flushProgress()
    await dbReplace(next, s)
    pendingReward.current = { stickers: [], badges: [] }
    setReward(null)
    setDailyCelebration(null)
    progressRef.current = next
    settingsRef.current = s
    setProgress(next)
    setSettings(s)
    setDataEpoch((n) => n + 1)
  }, [])

  const value = useMemo<AppState>(
    () => ({
      ready,
      progress,
      settings,
      updateProgress,
      updateSettings,
      addStars,
      markLearned,
      isLearned,
      checkThemeComplete,
      reward,
      clearReward,
      recordDaily, dailyCelebration, clearDailyCelebration,
      parentAuthorized, authorizeParent, revokeParent, replaceData, dataEpoch,
    }),
    [
      ready,
      progress,
      settings,
      updateProgress,
      updateSettings,
      addStars,
      markLearned,
      isLearned,
      checkThemeComplete,
      reward,
      clearReward,
      recordDaily, dailyCelebration, clearDailyCelebration,
      parentAuthorized, authorizeParent, revokeParent, replaceData, dataEpoch,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppState {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp 必须在 <AppProvider> 内使用')
  return ctx
}
