import { describe, expect, it } from 'vitest'
import { themes } from '../src/content'
import { bubblePosition, BUBBLE_DURATION_MS, createBubbleChoices, createBubbleTargets } from '../src/logic/bubbles'

describe('Bubble Pop', () => {
  it('每局 10 个不重复目标，每组最多 5 个泡泡，始终包含目标和同主题干扰词', () => {
    for (const theme of themes) {
      const targets = createBubbleTargets(theme.words)
      expect(targets).toHaveLength(10)
      expect(new Set(targets.map((word) => word.id)).size).toBe(10)
      for (const target of targets) {
        const choices = createBubbleChoices(theme.words, target)
        expect(choices).toHaveLength(5)
        expect(choices.filter((word) => word.id === target.id)).toHaveLength(1)
        expect(new Set(choices.map((word) => word.id)).size).toBe(5)
        expect(choices.every((word) => theme.words.includes(word))).toBe(true)
      }
    }
  })

  it('泡泡向上漂浮，10 秒后循环，暂停时传入相同游戏时间保持原位', () => {
    const initial = bubblePosition(0, 1000, 343, 360, 80)
    const later = bubblePosition(0, 2000, 343, 360, 80)
    expect(later.y).toBeLessThan(initial.y)
    expect(bubblePosition(0, 1000, 343, 360, 80)).toEqual(initial)
    const returned = bubblePosition(0, 1000 + BUBBLE_DURATION_MS, 343, 360, 80)
    expect(returned.x).toBe(initial.x)
    expect(returned.y).toBeCloseTo(initial.y)
    expect(BUBBLE_DURATION_MS).toBeGreaterThanOrEqual(8000)
    expect(BUBBLE_DURATION_MS).toBeLessThanOrEqual(12000)
  })

  it('手机、iPad 和减少动态效果下的布局不重叠，触控目标间至少 12px', () => {
    for (const [width, height, size] of [[288, 270, 76], [343, 360, 80], [736, 650, 112], [992, 440, 112]]) {
      for (const reduced of [false, true]) {
        for (let time = 0; time < 10000; time += 250) {
          const positions = Array.from({ length: 5 }, (_, slot) => bubblePosition(slot, time, width, height, size, reduced))
          for (let i = 0; i < positions.length; i++) {
            expect(positions[i].x).toBeGreaterThanOrEqual(0)
            expect(positions[i].x + size).toBeLessThanOrEqual(width)
            for (let j = i + 1; j < positions.length; j++) {
              const dx = Math.abs(positions[i].x - positions[j].x)
              const dy = Math.abs(positions[i].y - positions[j].y)
              expect(Math.max(dx, dy)).toBeGreaterThanOrEqual(size + 12)
            }
          }
        }
      }
    }
  })

  it('减少动态效果时泡泡静止在可见区域', () => {
    for (let slot = 0; slot < 5; slot++) {
      const initial = bubblePosition(slot, 0, 343, 360, 80, true)
      expect(bubblePosition(slot, 9000, 343, 360, 80, true)).toEqual(initial)
      expect(initial.y).toBeGreaterThanOrEqual(0)
      expect(initial.y + 80).toBeLessThanOrEqual(360)
    }
  })
})
