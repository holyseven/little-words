import { describe, expect, it } from 'vitest'

import {
  buildRound,
  shuffle,
  weightOf,
  weightedSample,
  OPTIONS_PER_QUESTION,
  QUESTIONS_PER_ROUND,
} from '../src/logic/pickWords'
import type { Word } from '../src/content/types'
import type { WordStat } from '../src/store/progress'

const stat = (p: Partial<WordStat> = {}): WordStat => ({
  seen: 1,
  correct: 0,
  wrong: 0,
  lastSeen: 0,
  ...p,
})

const words: Word[] = Array.from({ length: 10 }, (_, i) => ({
  id: `w${i}`,
  text: `word${i}`,
  emoji: '🐱',
  zh: '词',
  sentence: 'This is a word.',
}))

/** 确定性随机源：循环给出固定序列，让抽样结果可预测 */
function seq(values: number[]) {
  let i = 0
  return () => values[i++ % values.length]!
}

describe('weightOf（SPEC 12.3）', () => {
  it('没见过的词权重最高', () => {
    // 1 + 0 + 3 + max(0, 3-0) = 7
    expect(weightOf(undefined)).toBe(7)
    expect(weightOf(stat({ seen: 0 }))).toBe(7)
  })

  it('答错会显著提升权重', () => {
    expect(weightOf(stat({ wrong: 0 }))).toBe(4) // 1 + 0 + 3
    expect(weightOf(stat({ wrong: 1 }))).toBe(6) // 1 + 2 + 3
    expect(weightOf(stat({ wrong: 3 }))).toBe(10) // 1 + 6 + 3
  })

  it('答对 3 次后额外权重归零', () => {
    expect(weightOf(stat({ correct: 1 }))).toBe(3) // 1 + 0 + 2
    expect(weightOf(stat({ correct: 3 }))).toBe(1) // 1 + 0 + 0
    expect(weightOf(stat({ correct: 10 }))).toBe(1) // 不会变成负数
  })

  it('答错过的词永远比已掌握的词权重高', () => {
    const mastered = weightOf(stat({ correct: 5, wrong: 0 }))
    const struggling = weightOf(stat({ correct: 5, wrong: 1 }))
    expect(struggling).toBeGreaterThan(mastered)
  })
})

describe('weightedSample', () => {
  it('不重复抽样', () => {
    const out = weightedSample(words, 5, () => 1, seq([0.1, 0.5, 0.9, 0.3, 0.7]))
    expect(out.length).toBe(5)
    expect(new Set(out.map((w) => w.id)).size).toBe(5)
  })

  it('count 超过候选数时返回全部', () => {
    const out = weightedSample(words.slice(0, 3), 10, () => 1)
    expect(out.length).toBe(3)
  })

  it('权重为 0 的项也能被抽到（全零时退化为均匀随机）', () => {
    const out = weightedSample(words, 3, () => 0)
    expect(out.length).toBe(3)
    expect(new Set(out.map((w) => w.id)).size).toBe(3)
  })

  it('高权重的项显著更常被抽中', () => {
    // w0 权重 100，其余 1；抽 1 个，跑多次统计
    let hits = 0
    const runs = 400
    for (let i = 0; i < runs; i++) {
      const [first] = weightedSample(words, 1, (w) => (w.id === 'w0' ? 100 : 1))
      if (first!.id === 'w0') hits++
    }
    // 理论命中率 100/109 ≈ 92%，放宽到 80% 避免偶发抖动
    expect(hits / runs).toBeGreaterThan(0.8)
  })

  it('空候选返回空数组', () => {
    expect(weightedSample([], 5, () => 1)).toEqual([])
  })
})

describe('shuffle', () => {
  it('不改原数组，元素不丢不重', () => {
    const src = [1, 2, 3, 4, 5]
    const out = shuffle(src, seq([0.9, 0.1, 0.5, 0.3]))
    expect(src).toEqual([1, 2, 3, 4, 5])
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5])
  })

  it('确实会打乱顺序', () => {
    const src = Array.from({ length: 20 }, (_, i) => i)
    // 用真随机跑几次，至少有一次和原序不同
    const anyDifferent = Array.from({ length: 5 }, () => shuffle(src)).some(
      (out) => out.join() !== src.join(),
    )
    expect(anyDifferent).toBe(true)
  })
})

describe('buildRound（SPEC 7.4 / 12.3）', () => {
  it('默认出 8 题、每题 4 个选项', () => {
    const round = buildRound(words, {})
    expect(round.length).toBe(QUESTIONS_PER_ROUND)
    for (const q of round) {
      expect(q.options.length).toBe(OPTIONS_PER_QUESTION)
    }
  })

  it('一局内正确答案不重复', () => {
    const round = buildRound(words, {})
    const ids = round.map((q) => q.word.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('每题的选项含正确项且互不重复', () => {
    const round = buildRound(words, {})
    for (const q of round) {
      expect(q.options.some((o) => o.id === q.word.id)).toBe(true)
      expect(new Set(q.options.map((o) => o.id)).size).toBe(q.options.length)
    }
  })

  it('干扰项来自同一批词', () => {
    const round = buildRound(words, {})
    const known = new Set(words.map((w) => w.id))
    for (const q of round) {
      for (const o of q.options) expect(known.has(o.id)).toBe(true)
    }
  })

  it('词数少于选项数时不会重复填充', () => {
    const three = words.slice(0, 3)
    const round = buildRound(three, {}, { count: 3 })
    for (const q of round) {
      expect(q.options.length).toBe(3)
      expect(new Set(q.options.map((o) => o.id)).size).toBe(3)
    }
  })

  it('词数少于题数时题目数量相应减少', () => {
    const round = buildRound(words.slice(0, 5), {})
    expect(round.length).toBe(5)
  })

  it('空词表返回空局', () => {
    expect(buildRound([], {})).toEqual([])
  })

  it('答错过的词更可能出现在一局里', () => {
    // w0 答错 5 次，其余都已掌握
    const stats: Record<string, WordStat> = {}
    for (const w of words) stats[w.id] = stat({ correct: 5 })
    stats['w0'] = stat({ correct: 5, wrong: 5 })

    let hits = 0
    const runs = 200
    for (let i = 0; i < runs; i++) {
      // 只出 2 题，让权重差异体现出来
      const round = buildRound(words, stats, { count: 2 })
      if (round.some((q) => q.word.id === 'w0')) hits++
    }
    // w0 权重 11，其余 1 → 首抽命中率约 55%，两题合计更高
    expect(hits / runs).toBeGreaterThan(0.5)
  })

  it('相同随机序列产出相同结果（可复现）', () => {
    const rngA = seq([0.13, 0.47, 0.81, 0.29, 0.63, 0.05, 0.91, 0.37])
    const rngB = seq([0.13, 0.47, 0.81, 0.29, 0.63, 0.05, 0.91, 0.37])
    const a = buildRound(words, {}, { rng: rngA })
    const b = buildRound(words, {}, { rng: rngB })
    expect(a.map((q) => q.word.id)).toEqual(b.map((q) => q.word.id))
  })
})
