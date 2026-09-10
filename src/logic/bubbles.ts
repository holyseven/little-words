import type { Word } from '../content/types'
import { shuffle, type Rng } from './pickWords'

export const BUBBLE_TARGETS = 10
export const BUBBLE_DURATION_MS = 10000
export const MAX_BUBBLES = 5

export function createBubbleTargets(words: Word[], rng: Rng = Math.random): Word[] {
  return shuffle(words, rng).slice(0, BUBBLE_TARGETS)
}

/** 每题恰有一个目标泡泡，其余均为同主题的不同单词。 */
export function createBubbleChoices(words: Word[], target: Word, rng: Rng = Math.random): Word[] {
  const others = shuffle(words.filter((word) => word.id !== target.id), rng).slice(0, MAX_BUBBLES - 1)
  return shuffle([target, ...others], rng)
}

/** 同一条轨道错开出场；循环只改变位置，不扣分、不丢目标。 */
export function bubblePosition(
  slot: number, elapsedMs: number, width: number, height: number, size: number, reducedMotion = false,
): { x: number; y: number } {
  const columns = width >= 700 ? 5 : 3
  const laneWidth = width / columns
  const x = laneWidth * (slot % columns + 0.5) - size / 2
  if (reducedMotion) {
    const rows = Math.ceil(MAX_BUBBLES / columns)
    return { x, y: (height / rows) * (Math.floor(slot / columns) + 0.5) - size / 2 }
  }
  const progress = (slot / MAX_BUBBLES + elapsedMs / BUBBLE_DURATION_MS) % 1
  return { x, y: height - progress * (height + size) }
}
