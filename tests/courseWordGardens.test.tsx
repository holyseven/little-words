import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { themes } from '../src/content'
import { courseWordGarden, courseWordGardens } from '../src/content/courseWordGardens'
import { WordArt } from '../src/content/svg/WordArt'
import { stationState } from '../src/logic/rewards'
import { emptyProgress } from '../src/store/progress'

describe('课本主题单词乐园', () => {
  it('五个单元进入正确的主题，Hello 保留对话材料', () => {
    expect(courseWordGardens.map(({ unit, theme }) => [unit.id, theme.id])).toEqual([
      ['g1t1-u2', 'numbers'], ['g1t1-u3', 'family'], ['g1t1-u4', 'classroom'],
      ['g1t1-u5', 'school-things'], ['g1t1-u6', 'colors'],
    ])
    expect(courseWordGarden('g1t1-u1')).toBeUndefined()
    expect(courseWordGarden('missing')).toBeUndefined()
  })

  it('老主题顺序和编号不变，新主题可直接学习且有独立进度', () => {
    expect(themes.slice(0, 8).map((theme) => theme.id)).toEqual([
      'animals', 'fruits', 'colors', 'numbers', 'vehicles', 'weather', 'body', 'food',
    ])
    for (const id of ['family', 'classroom', 'school-things']) {
      const index = themes.findIndex((theme) => theme.id === id)
      expect(stationState(themes, index, emptyProgress())).toBe('available')
      expect(stationState(themes, index, { ...emptyProgress(), badges: [id] })).toBe('completed')
    }
    expect(stationState(themes, 1, emptyProgress())).toBe('locked')
  })

  it('视频中已核对的词与六个拓展词明确区分', () => {
    const newWords = themes.slice(8).flatMap((theme) => theme.words)
    expect(newWords).toHaveLength(24)
    expect(newWords.filter((word) => !word.extension)).toHaveLength(18)
    expect(newWords.filter((word) => word.extension).map((word) => word.id)).toEqual([
      'baby', 'school', 'ruler', 'eraser', 'pen', 'crayon',
    ])
  })

  it('新增词图形实际渲染成 SVG，不落到问号占位或泄露答案文字', () => {
    const pictures = new Set<string>()
    for (const theme of themes.slice(8)) {
      for (const word of theme.words) {
        const html = renderToStaticMarkup(<WordArt word={word} />)
        expect(html, word.id).toContain('<svg')
        expect(html, word.id).not.toContain('❓')
        expect(html, word.id).not.toContain('<text')
        pictures.add(html.replace(/aria-label="[^"]*"/g, ''))
      }
    }
    expect(pictures.size).toBe(24)
  })
})
