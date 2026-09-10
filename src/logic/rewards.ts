/**
 * 奖励与解锁规则（SPEC 7.1 / 7.2 / 7.8）—— 纯函数，便于单测。
 */

import { STARS_PER_STICKER, STICKER_POOL } from '../content/stickers'
import type { Theme } from '../content/types'
import type { Progress, ThemeProgress } from '../store/progress'
import { BUBBLE_TARGETS } from './bubbles'

/** 主题完成的正确率门槛（SPEC 7.2：任意一个游戏正确率 ≥ 80%） */
export const GAME_PASS_RATIO = 0.8

/* -------------------------------------------------------------------------- */
/* 贴纸                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * 按星星总数算应该拥有多少张贴纸。
 * 用「应有数量 - 已有数量」而不是累加，这样即使某次写入丢了也能自动补齐。
 */
export function stickersEarnedFor(stars: number): number {
  return Math.min(Math.floor(stars / STARS_PER_STICKER), STICKER_POOL.length)
}

export interface StickerAward {
  /** 本次新获得的贴纸 */
  gained: string[]
  /** 更新后的完整贴纸列表 */
  stickers: string[]
}

/**
 * 结算贴纸：不重复直到池空（SPEC 7.8）。
 * rng 可注入，便于测试。
 */
export function awardStickers(
  stars: number,
  owned: string[],
  rng: () => number = Math.random,
): StickerAward {
  const target = stickersEarnedFor(stars)
  const need = target - owned.length
  if (need <= 0) return { gained: [], stickers: owned }

  const remaining = STICKER_POOL.filter((s) => !owned.includes(s))
  const gained: string[] = []

  for (let i = 0; i < need && remaining.length > 0; i++) {
    const idx = Math.floor(rng() * remaining.length)
    gained.push(remaining.splice(Math.min(idx, remaining.length - 1), 1)[0]!)
  }

  return { gained, stickers: [...owned, ...gained] }
}

/* -------------------------------------------------------------------------- */
/* 主题完成判定                                                                */
/* -------------------------------------------------------------------------- */

/**
 * 主题完成条件（SPEC 7.2）：
 * 全部单词在 Learn 中标记 "I know it" **且** 任意一个游戏正确率 ≥ 80%。
 */
export function isThemeComplete(theme: Theme, tp: ThemeProgress, totalQuestions = 8): boolean {
  const allLearned = theme.words.every((w) => tp.learned.includes(w.id))
  if (!allLearned) return false

  const best = tp.best
  const pass = (score: number | undefined) =>
    score !== undefined && score / totalQuestions >= GAME_PASS_RATIO

  // Memory 只在整局配完后写入 6 / 8 对，是完成标记；不按猜牌次数处罚。
  // Bubble 共 10 个目标，记录首次点对数。不能沿用 Listen 的 8 题分母。
  return pass(best.listen)
    || (best.memory !== undefined && best.memory >= 6)
    || (best.bubble !== undefined && best.bubble / BUBBLE_TARGETS >= GAME_PASS_RATIO)
}

/* -------------------------------------------------------------------------- */
/* 关卡解锁                                                                    */
/* -------------------------------------------------------------------------- */

export type StationState = 'locked' | 'available' | 'completed'

/**
 * 解锁规则（SPEC 7.1）：第 1 个主题默认可用；完成第 N 个后解锁第 N+1 个。
 * 家长页可开「全部解锁」。
 */
export function stationState(
  themes: Theme[],
  index: number,
  progress: Progress,
  unlockAll = false,
): StationState {
  const theme = themes[index]
  if (!theme) return 'locked'

  if (progress.badges.includes(theme.id)) return 'completed'
  if (unlockAll || index === 0) return 'available'

  // 前一个主题已完成才解锁本关
  const prev = themes[index - 1]
  return prev && progress.badges.includes(prev.id) ? 'available' : 'locked'
}

/** 当前可玩的主题（用于生成每日任务，M4 会用到） */
export function firstAvailableTheme(
  themes: Theme[],
  progress: Progress,
  unlockAll = false,
): Theme | undefined {
  // 优先返回「已解锁但未完成」的第一个；全部完成时返回最后一个
  for (let i = 0; i < themes.length; i++) {
    const state = stationState(themes, i, progress, unlockAll)
    if (state === 'available') return themes[i]
  }
  return themes[themes.length - 1]
}

/* -------------------------------------------------------------------------- */
/* 启动时对账                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * 把「星星 → 贴纸」和「学完+达标 → 徽章」这两条规则重新对一遍。
 *
 * 为什么需要：这两个奖励平时是在得星的那一刻结算的。但存档可能从别处来 ——
 * 家长页导入 JSON（M4）、旧版本升级、某次写入丢了。这时候画面上的星星数
 * 和贴纸数就会对不上，孩子会觉得「明明够 10 颗星却没给我贴纸」。
 *
 * 启动时静默补齐（不弹庆祝层：这不是孩子刚挣到的）。
 */
export function reconcileRewards(
  progress: Progress,
  themes: Theme[],
  rng: () => number = Math.random,
): Progress {
  let next = progress

  // 贴纸：按星星总数补齐
  const { gained, stickers } = awardStickers(next.stars, next.stickers, rng)
  if (gained.length > 0) {
    next = { ...next, stickers }
  }

  // 徽章：把已达成完成条件但没发徽章的主题补上
  const missing = themes.filter(
    (t) => !next.badges.includes(t.id) && isThemeComplete(t, getTP(next, t.id)),
  )
  if (missing.length > 0) {
    const themeUpdates = { ...next.themes }
    for (const t of missing) {
      themeUpdates[t.id] = { ...getTP(next, t.id), completed: true }
    }
    next = {
      ...next,
      badges: [...next.badges, ...missing.map((t) => t.id)],
      themes: themeUpdates,
    }
  }

  return next
}

function getTP(p: Progress, themeId: string): ThemeProgress {
  return p.themes[themeId] ?? { learned: [], best: {}, completed: false }
}
