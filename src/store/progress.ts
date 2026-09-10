/**
 * 进度（SPEC 12.1 / 12.2）
 *
 * 写入策略：得星/答题立即调用，内部 300ms 防抖合并；
 * 关键节点（局末、获得贴纸）调用 flushProgress() 立即落盘。
 */

import { dbGet, dbSet, KEY_PROGRESS } from './db'

export interface DailyTask {
  id: string
  kind: 'learn' | 'listen' | 'review' | 'memory' | 'course'
  target: number
  themeId?: string
  wordIds?: string[]
  completedWordIds?: string[]
  count?: number
  assetId?: string
}

export type PlayedRange = [number, number]
export interface MediaProgress {
  position: number
  covered: PlayedRange[]
  completed: boolean
  lastPlayed: number
  dailyDate: string
  dailyCovered: PlayedRange[]
}
export interface CurriculumProgress { lastAssetId?: string; media: Record<string, MediaProgress> }

export interface ThemeProgress {
  /** 已标记 I know it 的词 id */
  learned: string[]
  /** listen：8 题计分数；memory：完整配完的对数（6/8）；bubble：10 题首次点对数。 */
  best: { listen?: number; memory?: number; bubble?: number }
  completed: boolean
}

export interface WordStat {
  seen: number
  correct: number
  wrong: number
  lastSeen: number
}

export interface Progress {
  version: 1
  stars: number
  stickers: string[]
  badges: string[]
  themes: Record<string, ThemeProgress>
  wordStats: Record<string, WordStat>
  curriculum?: CurriculumProgress
  daily: {
    date: string
    tasks: DailyTask[]
    done: string[]
    usedMs: number
    bonusMs: number
    rewarded?: boolean
  }
}

export function emptyProgress(): Progress {
  return {
    version: 1,
    stars: 0,
    stickers: [],
    badges: [],
    themes: {},
    wordStats: {},
    daily: { date: todayKey(), tasks: [], done: [], usedMs: 0, bonusMs: 0 },
  }
}

/** 本地日期 YYYY-MM-DD（每日任务按本地时区跨天） */
export function todayKey(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function emptyThemeProgress(): ThemeProgress {
  return { learned: [], best: {}, completed: false }
}

export function getThemeProgress(p: Progress, themeId: string): ThemeProgress {
  return p.themes[themeId] ?? emptyThemeProgress()
}

export async function loadProgress(): Promise<Progress> {
  const saved = await dbGet<Progress>(KEY_PROGRESS)
  if (!saved || saved.version !== 1) return emptyProgress()

  // 逐字段兜底：存档来自旧版本或被截断时也不会崩
  return {
    ...emptyProgress(),
    ...saved,
    themes: saved.themes ?? {},
    wordStats: saved.wordStats ?? {},
    daily: { ...emptyProgress().daily, ...saved.daily },
  }
}

/* -------------------------------------------------------------------------- */
/* 防抖写入                                                                    */
/* -------------------------------------------------------------------------- */

const DEBOUNCE_MS = 300

let pending: Progress | null = null
let timer: number | undefined

/** 防抖保存（≤ 300ms 合并，SPEC 12.2） */
export function saveProgress(p: Progress): void {
  pending = p
  if (timer !== undefined) return

  timer = window.setTimeout(() => {
    timer = undefined
    const snapshot = pending
    pending = null
    if (snapshot) void dbSet(KEY_PROGRESS, snapshot)
  }, DEBOUNCE_MS)
}

/** 立即落盘：局末、获得贴纸、页面即将隐藏时调用 */
export async function flushProgress(): Promise<void> {
  if (timer !== undefined) {
    window.clearTimeout(timer)
    timer = undefined
  }
  const snapshot = pending
  pending = null
  if (snapshot) await dbSet(KEY_PROGRESS, snapshot)
}

/** 孩子可能直接按 Home 键退出，这里抢在页面冻结前写一次 */
export function installProgressFlushOnHide(): () => void {
  const flush = () => {
    void flushProgress()
  }
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') flush()
  }
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', flush)
  return () => {
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pagehide', flush)
  }
}
