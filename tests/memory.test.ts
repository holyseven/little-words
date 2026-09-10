import { describe, expect, it } from 'vitest'
import { themes } from '../src/content'
import { createMemoryRound, flipMemoryCard, memoryPairCount, settleMemoryTurn } from '../src/logic/memory'

describe('Memory Flip', () => {
  it('手机横竖屏均为 6 对，iPad 横竖屏均为 8 对', () => {
    for (const [w, h, count] of [[375, 667, 6], [667, 375, 6], [430, 932, 6], [768, 1024, 8], [1024, 768, 8]]) {
      expect(memoryPairCount(w, h)).toBe(count)
    }
  })

  it('所有主题每个选中词恰有一张图和一张文字，原词表不被洗牌修改', () => {
    for (const theme of themes) {
      const before = theme.words.map((word) => word.id)
      for (const pairs of [6, 8]) {
        const round = createMemoryRound(theme.words, pairs)
        expect(round.cards).toHaveLength(pairs * 2)
        expect(new Set(round.cards.map((card) => card.id)).size).toBe(pairs * 2)
        for (const id of new Set(round.cards.map((card) => card.word.id))) {
          expect(round.cards.filter((card) => card.word.id === id).map((card) => card.face).sort()).toEqual(['picture', 'word'])
        }
      }
      expect(theme.words.map((word) => word.id)).toEqual(before)
    }
  })

  it('同张卡连点、第二张后的第三次输入不会多开牌或多结算', () => {
    const round = createMemoryRound(themes[0].words, 6)
    const card = round.cards[0]
    const other = round.cards.find((c) => c.word.id !== card.word.id)!
    const first = flipMemoryCard(round, card.id)
    expect(flipMemoryCard(first, card.id)).toBe(first)
    expect(flipMemoryCard(first, 'unknown')).toBe(first)
    const second = flipMemoryCard(first, other.id)
    expect(second.matched).toEqual([])
    expect(flipMemoryCard(second, round.cards[2].id)).toBe(second)
    const settled = settleMemoryTurn(second)
    expect(settled.open).toEqual([])
    expect(flipMemoryCard(settled, card.id).open).toEqual([card.id])
  })

  it('成功配对保持翻开，已匹配的卡不再计分，可以完整配完 6 / 8 对', () => {
    for (const count of [6, 8]) {
      let round = createMemoryRound(themes[0].words, count)
      const ids = [...new Set(round.cards.map((c) => c.word.id))]
      for (const wordId of ids) {
        const pair = round.cards.filter((c) => c.word.id === wordId)
        round = flipMemoryCard(flipMemoryCard(round, pair[0].id), pair[1].id)
        expect(round.matched).toContain(wordId)
        round = settleMemoryTurn(round)
        expect(flipMemoryCard(round, pair[0].id)).toBe(round)
      }
      expect(round.matched).toHaveLength(count)
    }
  })
})
