import { describe, expect, it } from 'vitest'
import { themes, getTheme, getWord } from '../src/content'

describe('内容数据校验（SPEC 8）', () => {
  it('M0 至少包含 Animals 主题', () => {
    const animals = getTheme('animals')
    expect(animals).toBeDefined()
    expect(animals!.title).toBe('Animals')
  })

  it('主题 id 唯一', () => {
    const ids = themes.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('单词 id 全局唯一', () => {
    const ids = themes.flatMap((t) => t.words.map((w) => w.id))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('每个主题 8–10 个词', () => {
    for (const t of themes) {
      expect(t.words.length).toBeGreaterThanOrEqual(8)
      expect(t.words.length).toBeLessThanOrEqual(10)
    }
  })

  it('每个词都有图形、中文和例句', () => {
    for (const t of themes) {
      for (const w of t.words) {
        expect(Boolean(w.emoji || w.svg), `${w.id} 缺少图形`).toBe(true)
        expect(w.zh.length).toBeGreaterThan(0)
        expect(w.sentence.length).toBeGreaterThan(0)
      }
    }
  })

  it('例句为 4–6 个词（SPEC 8.2）', () => {
    for (const t of themes) {
      for (const w of t.words) {
        const count = w.sentence.trim().split(/\s+/).length
        expect(count, `${w.id}: "${w.sentence}"`).toBeGreaterThanOrEqual(4)
        expect(count, `${w.id}: "${w.sentence}"`).toBeLessThanOrEqual(6)
      }
    }
  })

  it('氛围色引用 CSS 变量名', () => {
    for (const t of themes) {
      expect(t.tint).toMatch(/^--tint-/)
    }
  })

  it('getWord 能按主题取词', () => {
    expect(getWord('animals', 'cat')?.text).toBe('cat')
    expect(getWord('animals', 'nope')).toBeUndefined()
  })
})
