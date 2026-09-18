import type { Word } from '../content/types'
import { shuffle, type Rng } from './pickWords'

export const TREASURE_ROUND_SIZE = 6
export const TREASURE_SCENE_SIZE = 6

export interface TreasureSpot {
  word: Word
  /** A position on the illustrated map, rather than an answer-card index. */
  position: number
}

export interface TreasureQuestion {
  target: Word
  spots: TreasureSpot[]
}

/** Each request has at least two distinct distractors, all from this theme. */
export function buildTreasureRound(words: readonly Word[], rng: Rng = Math.random): TreasureQuestion[] {
  const unique = [...new Map(words.map((word) => [word.id, word])).values()]
  if (unique.length < 3) return []

  return shuffle(unique, rng).slice(0, TREASURE_ROUND_SIZE).map((target) => {
    const distractors = shuffle(unique.filter((word) => word.id !== target.id), rng)
      .slice(0, TREASURE_SCENE_SIZE - 1)
    const positions = shuffle(Array.from({ length: TREASURE_SCENE_SIZE }, (_, index) => index), rng)
    return {
      target,
      spots: shuffle([target, ...distractors], rng).map((word, index) => ({ word, position: positions[index] })),
    }
  })
}

export function checkTreasureChoice(question: TreasureQuestion, wordId: string): boolean {
  return question.target.id === wordId && question.spots.some((spot) => spot.word.id === wordId)
}
