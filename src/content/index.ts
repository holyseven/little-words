import type { Theme, Word } from './types'
import { hasSvgImpl } from './svg/hasSvgImpl'

import animals from './themes/animals.json'
import fruits from './themes/fruits.json'
import colors from './themes/colors.json'
import numbers from './themes/numbers.json'
import vehicles from './themes/vehicles.json'
import weather from './themes/weather.json'
import body from './themes/body.json'
import food from './themes/food.json'

/** 全部 8 个主题（SPEC 8.2），按 order 排序 */
const rawThemes = [
  animals,
  fruits,
  colors,
  numbers,
  vehicles,
  weather,
  body,
  food,
] as Theme[]

/** 构建/启动时校验（SPEC 8.2：id 唯一） */
function validate(themes: Theme[]): Theme[] {
  const themeIds = new Set<string>()
  const wordIds = new Set<string>()
  const orders = new Set<number>()

  for (const theme of themes) {
    if (themeIds.has(theme.id)) {
      throw new Error(`[content] 主题 id 重复: ${theme.id}`)
    }
    themeIds.add(theme.id)

    if (orders.has(theme.order)) {
      throw new Error(`[content] 主题 order 重复: ${theme.order}（${theme.id}）`)
    }
    orders.add(theme.order)

    for (const word of theme.words) {
      if (wordIds.has(word.id)) {
        throw new Error(`[content] 单词 id 重复: ${word.id}（主题 ${theme.id}）`)
      }
      wordIds.add(word.id)

      if (!word.emoji && !word.svg) {
        throw new Error(`[content] 单词 ${word.id} 缺少 emoji 或 svg`)
      }

      // svg 字段必须有对应的渲染实现，否则运行时会显示 ❓
      if (word.svg && !hasSvgImpl(word.svg)) {
        throw new Error(`[content] 单词 ${word.id} 的 svg "${word.svg}" 没有渲染实现`)
      }
    }
  }

  return [...themes].sort((a, b) => a.order - b.order)
}

export const themes: Theme[] = validate(rawThemes)

export function getTheme(id: string | undefined): Theme | undefined {
  if (!id) return undefined
  return themes.find((t) => t.id === id)
}

export function getWord(themeId: string, wordId: string): Word | undefined {
  return getTheme(themeId)?.words.find((w) => w.id === wordId)
}

/** 主题在解锁顺序里的位置（0 起） */
export function themeIndex(id: string): number {
  return themes.findIndex((t) => t.id === id)
}

export type { Theme, Word }
