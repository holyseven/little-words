import type { Word } from '../content/types'
import { shuffle, type Rng } from './pickWords'

export const WORD_TRAIN_ROUND_SIZE = 6

export interface TrainQuestion {
  /** Passenger order is only announced aloud until the train leaves. */
  sequence: Word[]
  options: Word[]
}

export type TrainAnswer = 'empty' | 'incomplete' | 'wrong-order' | 'correct'

export function buildTrainRound(words: readonly Word[], rng: Rng = Math.random): TrainQuestion[] {
  const unique = [...new Map(words.map((word) => [word.id, word])).values()]
  if (!unique.length) return []

  return Array.from({ length: WORD_TRAIN_ROUND_SIZE }, (_, index) => {
    // Leave a distractor whenever the vocabulary allows it, including small custom themes.
    const count = Math.min(index < 2 ? 2 : 3, Math.max(1, unique.length - 1))
    const pool = shuffle(unique, rng)
    const sequence = pool.slice(0, count)
    return { sequence, options: shuffle(pool.slice(0, count + 1), rng) }
  })
}

/** An empty or repeated answer can never pass by matching only a prefix. */
export function checkTrainAnswer(question: TrainQuestion, passengers: readonly string[]): TrainAnswer {
  if (!passengers.length) return 'empty'
  if (passengers.length < question.sequence.length) return 'incomplete'
  if (passengers.length !== question.sequence.length || new Set(passengers).size !== passengers.length) return 'wrong-order'
  return question.sequence.every((word, index) => word.id === passengers[index]) ? 'correct' : 'wrong-order'
}
