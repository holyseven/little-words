/**
 * 选词算法（SPEC 12.3）
 *
 * 目标：优先出孩子答错过、没见过、或还不熟的词，而不是均匀随机。
 * 纯函数 + 可注入随机源，便于单测。
 */

import type { Word } from '../content/types'
import type { WordStat } from '../store/progress'

export interface Question {
  word: Word
  /** 4 个选项（含正确项），已打乱顺序 */
  options: Word[]
}

/** 每题的选项数（SPEC 7.4：1 正确 + 3 干扰） */
export const OPTIONS_PER_QUESTION = 4

/** 每局题数（SPEC 7.4） */
export const QUESTIONS_PER_ROUND = 8

/** 可注入的随机源，测试时替换成确定序列 */
export type Rng = () => number

/**
 * 权重 = 1 + wrong*2 + (unseen ? 3 : 0) + max(0, 3 - correct)
 *
 * - 答错过的词权重翻倍加成，会更快回到孩子面前
 * - 没见过的词加 3，保证新词优先露面
 * - 答对不足 3 次的词仍有额外权重，答对 3 次后这项归零（视为已掌握）
 */
export function weightOf(stat: WordStat | undefined): number {
  if (!stat || stat.seen === 0) return 1 + 3 + 3 // unseen：1 + 3 + max(0, 3-0)
  return 1 + stat.wrong * 2 + Math.max(0, 3 - stat.correct)
}

/**
 * 按权重不重复抽样（加权 reservoir 的简化版：每次抽完移除）。
 * count 大于候选数时返回全部候选（打乱顺序）。
 */
export function weightedSample<T>(
  items: T[],
  count: number,
  weight: (item: T) => number,
  rng: Rng = Math.random,
): T[] {
  const pool = items.map((item) => ({ item, w: Math.max(0, weight(item)) }))
  const picked: T[] = []
  const n = Math.min(count, pool.length)

  for (let k = 0; k < n; k++) {
    const total = pool.reduce((sum, p) => sum + p.w, 0)

    // 所有剩余权重都为 0：退化为均匀随机，避免死循环
    if (total <= 0) {
      const i = Math.floor(rng() * pool.length)
      picked.push(pool.splice(Math.min(i, pool.length - 1), 1)[0]!.item)
      continue
    }

    let r = rng() * total
    let idx = pool.length - 1
    for (let i = 0; i < pool.length; i++) {
      r -= pool[i]!.w
      if (r < 0) {
        idx = i
        break
      }
    }
    picked.push(pool.splice(idx, 1)[0]!.item)
  }

  return picked
}

/** Fisher–Yates 洗牌，不改原数组 */
export function shuffle<T>(items: T[], rng: Rng = Math.random): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = out[i]!
    out[i] = out[j]!
    out[j] = tmp
  }
  return out
}

/**
 * 生成一局的题目。
 *
 * - 一局内正确答案不重复（SPEC 12.3）
 * - 干扰项从同主题里随机取，与正确项不同
 * - 主题词数少于 4 时，选项数相应减少（不会重复填充同一个词）
 */
export function buildRound(
  words: Word[],
  stats: Record<string, WordStat>,
  {
    count = QUESTIONS_PER_ROUND,
    optionCount = OPTIONS_PER_QUESTION,
    rng = Math.random,
  }: { count?: number; optionCount?: number; rng?: Rng } = {},
): Question[] {
  if (words.length === 0) return []

  const targets = weightedSample(words, count, (w) => weightOf(stats[w.id]), rng)

  return targets.map((word) => {
    const others = words.filter((w) => w.id !== word.id)
    const distractors = shuffle(others, rng).slice(0, Math.max(0, optionCount - 1))
    return { word, options: shuffle([word, ...distractors], rng) }
  })
}
