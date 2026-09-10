/**
 * 单词图形的统一入口：有 emoji 用 emoji，有 svg 用对应组件。
 *
 * 所有调用方（WordCard / ListenPick 选项 / 未来的 Memory 卡面）都走这里，
 * 这样新增 SVG 类型只改这一处。
 */

import type { Word } from '../types'
import './WordArt.css'
import { ColorSwatch } from './ColorSwatch'
import { NumberCard } from './NumberCard'
import { HairIcon } from './HairIcon'

interface Props {
  word: Word
  /** 额外的 class，用于控制尺寸 */
  className?: string
}

export function WordArt({ word, className = '' }: Props) {
  if (word.emoji) {
    return (
      <span className={`emoji word-art word-art--emoji ${className}`} role="img" aria-label={word.text}>
        {word.emoji}
      </span>
    )
  }

  if (word.svg) {
    const inner = renderSvg(word.svg, word.text)
    if (inner) {
      return <span className={`word-art word-art--svg ${className}`}>{inner}</span>
    }
  }

  // 词表校验会拦住这种情况，这里只是不让 UI 崩
  return (
    <span className={`emoji word-art ${className}`} role="img" aria-label={word.text}>
      ❓
    </span>
  )
}

function renderSvg(svgId: string, label: string) {
  if (svgId.startsWith('color-')) return <ColorSwatch svgId={svgId} label={label} />
  if (svgId.startsWith('num-')) return <NumberCard svgId={svgId} label={label} />
  if (svgId === 'hair') return <HairIcon label={label} />
  return null
}

export { hasSvgImpl } from './hasSvgImpl'
