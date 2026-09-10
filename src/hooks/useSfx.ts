/**
 * 音效 hook —— 统一入口，方便组件里直接 `const sfx = useSfx()`。
 */

import { useMemo } from 'react'
import { playSfx, type SfxName } from '../audio/sfx'

export function useSfx() {
  return useMemo(
    () => ({
      play: (name: SfxName) => playSfx(name),
      tap: () => playSfx('tap'),
      correct: () => playSfx('correct'),
      wrong: () => playSfx('wrong'),
      celebrate: () => playSfx('celebrate'),
      pop: () => playSfx('pop'),
      flip: () => playSfx('flip'),
      sticker: () => playSfx('sticker'),
    }),
    [],
  )
}
