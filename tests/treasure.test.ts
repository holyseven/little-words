import { describe, expect, it } from 'vitest'
import animals from '../src/content/themes/animals.json'
import colors from '../src/content/themes/colors.json'
import numbers from '../src/content/themes/numbers.json'
import { buildTreasureRound, checkTreasureChoice, TREASURE_ROUND_SIZE, TREASURE_SCENE_SIZE } from '../src/logic/treasure'

function seeded(seed: number) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 2 ** 32
  }
}

describe('treasure round', () => {
  it('makes six different requests with one target and five same-theme distractors each', () => {
    const round = buildTreasureRound(animals.words, seeded(9))
    expect(round).toHaveLength(TREASURE_ROUND_SIZE)
    expect(new Set(round.map((question) => question.target.id)).size).toBe(TREASURE_ROUND_SIZE)
    for (const question of round) {
      expect(question.spots).toHaveLength(TREASURE_SCENE_SIZE)
      expect(new Set(question.spots.map((spot) => spot.word.id)).size).toBe(TREASURE_SCENE_SIZE)
      expect(question.spots.filter((spot) => spot.word.id === question.target.id)).toHaveLength(1)
      expect(question.spots.every((spot) => animals.words.some((word) => word.id === spot.word.id))).toBe(true)
      expect(question.spots.map((spot) => spot.position).sort()).toEqual([0, 1, 2, 3, 4, 5])
    }
  })

  it('varies the target location across every map position', () => {
    const positions = new Set<number>()
    for (let seed = 1; seed <= 20; seed++) {
      for (const question of buildTreasureRound(animals.words, seeded(seed))) {
        positions.add(question.spots.find((spot) => spot.word.id === question.target.id)!.position)
      }
    }
    expect([...positions].sort()).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('keeps SVG color and number pictures intact', () => {
    for (const words of [colors.words, numbers.words]) {
      for (const question of buildTreasureRound(words, seeded(4))) {
        expect(question.target.svg).toBeTruthy()
        expect(question.spots.every((spot) => spot.word.svg)).toBe(true)
      }
    }
  })

  it('shortens small themes safely and never fills scenes with duplicate words', () => {
    const words = animals.words.slice(0, 3)
    const round = buildTreasureRound([...words, words[0]], seeded(7))
    expect(round).toHaveLength(3)
    for (const question of round) {
      expect(question.spots).toHaveLength(3)
      expect(new Set(question.spots.map((spot) => spot.word.id)).size).toBe(3)
      expect(new Set(question.spots.map((spot) => spot.position)).size).toBe(3)
    }
    expect(buildTreasureRound([])).toEqual([])
    expect(buildTreasureRound(animals.words.slice(0, 1))).toEqual([])
    expect(buildTreasureRound(animals.words.slice(0, 2))).toEqual([])
  })

  it('can reproduce a round without mutating source words', () => {
    const before = JSON.stringify(animals.words)
    expect(buildTreasureRound(animals.words, seeded(88))).toEqual(buildTreasureRound(animals.words, seeded(88)))
    expect(JSON.stringify(animals.words)).toBe(before)
  })

  it('only accepts the requested object, and permits a correct retry after a wrong choice', () => {
    const question = buildTreasureRound(animals.words, seeded(3))[0]
    const wrong = question.spots.find((spot) => spot.word.id !== question.target.id)!.word
    expect(checkTreasureChoice(question, wrong.id)).toBe(false)
    expect(checkTreasureChoice(question, 'missing')).toBe(false)
    expect(checkTreasureChoice(question, question.target.id)).toBe(true)
    expect(checkTreasureChoice({ ...question, spots: [] }, question.target.id)).toBe(false)
  })
})
