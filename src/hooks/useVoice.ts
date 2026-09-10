/**
 * 人声播放 hook —— 优先播预生成的 Ava (Premium) 片段，缺失时回落 TTS。
 *
 * 组件卸载时自动停止，避免离开页面后还在念上一页的词。
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import { clipId, hasClip, phraseId, playClip, preloadClips, stopClip } from '../audio/clips'
import type { Word } from '../content/types'

export function useVoice() {
  const [speaking, setSpeaking] = useState(false)
  const mounted = useRef(true)
  /** 每次播放自增，只有最新一次的 onEnd 能改 speaking */
  const playId = useRef(0)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      stopClip()
    }
  }, [])

  const play = useCallback((key: string, fallbackText: string, onEnd?: () => void) => {
    const id = ++playId.current
    setSpeaking(true)

    void playClip(key, {
      fallbackText,
      onEnd: () => {
        if (mounted.current && playId.current === id) setSpeaking(false)
        onEnd?.()
      },
    })
  }, [])

  /** 朗读单词本身 */
  const sayWord = useCallback(
    (word: Pick<Word, 'id' | 'text'>, onEnd?: () => void) => {
      play(clipId('w', word.id), word.text, onEnd)
    },
    [play],
  )

  /** 朗读例句 */
  const saySentence = useCallback(
    (word: Pick<Word, 'id' | 'sentence'>, onEnd?: () => void) => {
      play(clipId('s', word.id), word.sentence, onEnd)
    },
    [play],
  )

  /** 朗读角色台词 */
  const sayPhrase = useCallback(
    (text: string, onEnd?: () => void) => {
      play(clipId('p', phraseId(text)), text, onEnd)
    },
    [play],
  )

  const stop = useCallback(() => {
    playId.current++
    stopClip()
    setSpeaking(false)
  }, [])

  return { sayWord, saySentence, sayPhrase, stop, speaking, preloadClips, hasClip }
}
