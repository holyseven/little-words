/**
 * 内容数据结构（SPEC 8.1）
 * 词表以 JSON 存放在 src/content/themes/，构建时由 index.ts 校验 id 唯一。
 */

export interface Word {
  /** 稳定的唯一 id，进度与统计都以它为键，'cat' */
  id: string
  /** 展示与朗读的英文，'cat' */
  text: string
  /** emoji 图形，与 svg 二选一 */
  emoji?: string
  /** 内联 SVG 组件名，emoji 无法表达时使用（Colors / Numbers / hair） */
  svg?: string
  /** 中文提示，'猫' */
  zh: string
  /** 4–6 词的简单例句，'The cat is sleeping.' */
  sentence: string
}

export interface Theme {
  id: string
  title: string
  zh: string
  emoji: string
  /** 氛围色 CSS 变量名（SPEC 5.1），如 '--tint-animals' */
  tint: string
  order: number
  /** 8–10 个单词 */
  words: Word[]
}
