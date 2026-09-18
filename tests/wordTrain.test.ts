import { describe, expect, it } from 'vitest'
import type { Word } from '../src/content/types'
import { buildTrainRound, checkTrainAnswer, WORD_TRAIN_ROUND_SIZE } from '../src/logic/wordTrain'

const words: Word[] = ['cat', 'dog', 'rabbit', 'bird', 'fish', 'bear'].map((id) => ({ id, text: id, zh: id, emoji: '🐾', sentence: `A ${id}.` }))
function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 2 ** 32
  }
}

describe('word train rounds', () => {
  it('builds six journeys, progressing from two to three passengers', () => {
    const round = buildTrainRound(words, seeded(10))
    expect(round).toHaveLength(WORD_TRAIN_ROUND_SIZE)
    expect(round.map((question) => question.sequence.length)).toEqual([2, 2, 3, 3, 3, 3])
  })

  it('includes each requested passenger once plus a distractor', () => {
    for (const question of buildTrainRound(words, seeded(7))) {
      const ids = question.options.map((word) => word.id)
      expect(new Set(ids).size).toBe(question.sequence.length + 1)
      expect(ids).toHaveLength(question.sequence.length + 1)
      expect(new Set(question.sequence.map((word) => word.id)).size).toBe(question.sequence.length)
      for (const target of question.sequence) expect(ids).toContain(target.id)
      expect(ids.filter((id) => !question.sequence.some((word) => word.id === id))).toHaveLength(1)
    }
  })

  it('shuffles candidates independently of the announced sequence', () => {
    const positions = new Set<number>()
    for (let seed = 1; seed < 50; seed++) {
      const first = buildTrainRound(words, seeded(seed))[0]
      positions.add(first.options.findIndex((word) => word.id === first.sequence[0].id))
    }
    expect([...positions].sort()).toEqual([0, 1, 2])
  })

  it('is reproducible without changing its vocabulary', () => {
    const before = JSON.stringify(words)
    expect(buildTrainRound(words, seeded(12))).toEqual(buildTrainRound(words, seeded(12)))
    expect(JSON.stringify(words)).toBe(before)
  })

  it('handles empty, short and duplicate vocabularies safely', () => {
    expect(buildTrainRound([])).toEqual([])
    for (const count of [1, 2, 3]) {
      const subset = words.slice(0, count)
      for (const question of buildTrainRound([...subset, ...subset], seeded(20))) {
        expect(question.sequence.length).toBe(Math.min(2, Math.max(1, count - 1)))
        expect(question.options).toHaveLength(count)
        expect(checkTrainAnswer(question, question.sequence.map((word) => word.id))).toBe('correct')
      }
    }
  })
})

describe('word train answers', () => {
  const question = { sequence: words.slice(0, 3), options: words.slice(0, 4) }

  it('accepts only the complete announced order', () => {
    expect(checkTrainAnswer(question, ['cat', 'dog', 'rabbit'])).toBe('correct')
    expect(checkTrainAnswer(question, ['dog', 'cat', 'rabbit'])).toBe('wrong-order')
    expect(checkTrainAnswer(question, ['rabbit', 'dog', 'cat'])).toBe('wrong-order')
  })

  it('rejects empty and incomplete journeys', () => {
    expect(checkTrainAnswer(question, [])).toBe('empty')
    expect(checkTrainAnswer(question, ['cat'])).toBe('incomplete')
    expect(checkTrainAnswer(question, ['cat', 'dog'])).toBe('incomplete')
  })

  it('rejects duplicate, unknown, wrong and extra passengers', () => {
    expect(checkTrainAnswer(question, ['cat', 'cat', 'rabbit'])).toBe('wrong-order')
    expect(checkTrainAnswer(question, ['cat', 'dog', 'unknown'])).toBe('wrong-order')
    expect(checkTrainAnswer(question, ['cat', 'dog', 'bird'])).toBe('wrong-order')
    expect(checkTrainAnswer(question, ['cat', 'dog', 'rabbit', 'bird'])).toBe('wrong-order')
  })

  it('does not change the submitted answer', () => {
    const answer = Object.freeze(['cat', 'dog', 'rabbit'])
    checkTrainAnswer(question, answer)
    expect(answer).toEqual(['cat', 'dog', 'rabbit'])
  })
})
