import type { Word } from '../content/types'
import { shuffle, type Rng } from './pickWords'

export interface MemoryCard {
  id: string
  word: Word
  face: 'picture' | 'word'
}

export interface MemoryRound {
  cards: MemoryCard[]
  open: string[]
  matched: string[]
}

/** 按短边选择规模，转屏不改变一局中的牌。分屏小窗口使用 6 对。 */
export function memoryPairCount(width: number, height: number): 6 | 8 {
  return Math.min(width, height) >= 768 ? 8 : 6
}

export function createMemoryRound(words: Word[], pairs: number, rng: Rng = Math.random): MemoryRound {
  const selected = shuffle(words, rng).slice(0, pairs)
  return {
    cards: shuffle(selected.flatMap((word): MemoryCard[] => [
      { id: `${word.id}:picture`, word, face: 'picture' },
      { id: `${word.id}:word`, word, face: 'word' },
    ]), rng),
    open: [],
    matched: [],
  }
}

/** 同步状态转换：同张牌、多指和第三张牌都不能重复结算。 */
export function flipMemoryCard(round: MemoryRound, id: string): MemoryRound {
  const card = round.cards.find((c) => c.id === id)
  if (!card || round.open.length === 2 || round.open.includes(id) || round.matched.includes(card.word.id)) {
    return round
  }
  const open = [...round.open, id]
  const first = round.cards.find((c) => c.id === open[0])!
  const matched = open.length === 2 && first.word.id === card.word.id
    ? [...round.matched, card.word.id]
    : round.matched
  return { ...round, open, matched }
}

export function settleMemoryTurn(round: MemoryRound): MemoryRound {
  return round.open.length === 2 ? { ...round, open: [] } : round
}
