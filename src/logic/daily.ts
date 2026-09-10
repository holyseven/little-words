import type { Theme } from '../content/types'
import { getThemeProgress, todayKey, type DailyTask, type Progress } from '../store/progress'
import { firstAvailableTheme, stationState } from './rewards'
import { getCourseUnit, unitAssets } from '../content/curriculum'

export type DailyEvent =
  | { kind: 'learn' | 'review'; wordId: string }
  | { kind: 'listen' | 'memory'; themeId: string }
  | { kind: 'course'; assetId: string }

/** 任务当天固定；从已解锁主题选词，词不够时缩小目标，全部学过则改为复习。 */
export function ensureDaily(p: Progress, themes: Theme[], unlockAll: boolean, now = new Date(), courseUnitId?: string): Progress {
  const date = todayKey(now)
  if (p.daily.date === date && p.daily.tasks.length === 3 && p.daily.tasks.every((task) => (task.kind !== 'learn' && task.kind !== 'review') || task.wordIds?.length)) return p
  if (getCourseUnit(courseUnitId)) {
    const assets = unitAssets(courseUnitId!)
    const select = (kind: string) => {
      const group = assets.filter((a) => a.kind === kind)
      return group.find((a) => !p.curriculum?.media[a.id]?.completed) ?? group[now.getDate() % group.length]!
    }
    const tasks: DailyTask[] = ['lesson-audio', 'animation', 'vocabulary-audio'].map((kind) => ({
      id: `course-${kind}`, kind: 'course', assetId: select(kind).id, target: 1, count: 0,
    }))
    const sameDate = p.daily.date === date
    return { ...p, daily: { date, tasks, done: [], rewarded: false, usedMs: sameDate ? p.daily.usedMs : 0, bonusMs: sameDate ? p.daily.bonusMs : 0 } }
  }
  const available = themes.filter((_, i) => stationState(themes, i, p, unlockAll) !== 'locked')
  const current = firstAvailableTheme(themes, p, unlockAll) ?? themes[0]
  const learning = available.find((t) => t.words.some((w) => !getThemeProgress(p, t.id).learned.includes(w.id)))
  const fresh = learning?.words.filter((w) => !getThemeProgress(p, learning.id).learned.includes(w.id)).slice(0, 5) ?? []
  const review = available.flatMap((t) => t.words).filter((w) => (p.wordStats[w.id]?.wrong ?? 0) > 0)
    .sort((a, b) => (p.wordStats[b.id]?.wrong ?? 0) - (p.wordStats[a.id]?.wrong ?? 0)).slice(0, 5)
  const tasks: DailyTask[] = ([
    fresh.length
      ? { id: 'learn', kind: 'learn', themeId: learning!.id, target: fresh.length, wordIds: fresh.map((w) => w.id) }
      : { id: 'learn', kind: 'review', themeId: current.id, target: Math.min(5, current.words.length), wordIds: current.words.slice(0, 5).map((w) => w.id) },
    { id: 'listen', kind: 'listen', themeId: current.id, target: 1 },
    review.length
      ? { id: 'review', kind: 'review', target: review.length, wordIds: review.map((w) => w.id) }
      : { id: 'review', kind: 'memory', themeId: current.id, target: 1 },
  ] satisfies DailyTask[]).map((task) => ({ ...task, count: 0, completedWordIds: [] }))
  const sameDate = p.daily.date === date
  return { ...p, daily: {
    date, tasks, done: [], rewarded: false,
    usedMs: sameDate ? p.daily.usedMs : 0, bonusMs: sameDate ? p.daily.bonusMs : 0,
  } }
}

export function applyDailyEvent(p: Progress, event: DailyEvent): Progress {
  let changed = false
  const tasks = p.daily.tasks.map((task) => {
    if (task.kind !== event.kind || p.daily.done.includes(task.id)) return task
    if ('assetId' in event) {
      if (task.assetId !== event.assetId) return task
      changed = true
      return { ...task, count: 1 }
    }
    if ('wordId' in event) {
      if (!task.wordIds?.includes(event.wordId) || task.completedWordIds?.includes(event.wordId)) return task
      const completedWordIds = [...(task.completedWordIds ?? []), event.wordId]
      changed = true
      return { ...task, completedWordIds, count: completedWordIds.length }
    }
    if (task.themeId && task.themeId !== event.themeId) return task
    changed = true
    return { ...task, count: Math.min(task.target, (task.count ?? 0) + 1) }
  })
  if (!changed) return p
  return { ...p, daily: { ...p.daily, tasks, done: tasks.filter((t) => (t.count ?? 0) >= t.target).map((t) => t.id) } }
}

/** 只标记一次，星星与贴纸由同一笔进度更新结算。 */
export function awardDailyBonus(p: Progress): Progress {
  if (p.daily.rewarded || p.daily.tasks.length !== 3 || p.daily.done.length !== 3) return p
  return { ...p, stars: p.stars + 10, daily: { ...p.daily, rewarded: true } }
}

/** 前台时间按真实时间差计算。跨午夜只把新一天的部分计入新一天。 */
export function accrueUsage(p: Progress, from: number, to: number, themes: Theme[], unlockAll: boolean): Progress {
  const now = new Date(to)
  const next = ensureDaily(p, themes, unlockAll, now)
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const delta = Math.max(0, to - Math.max(from, midnight))
  if (!delta) return next
  return { ...next, daily: { ...next.daily, usedMs: next.daily.usedMs + delta } }
}

export function dailyLimitReached(p: Progress, limitMin: number): boolean {
  return limitMin > 0 && p.daily.usedMs >= limitMin * 60000 + p.daily.bonusMs
}
