/**
 * Mascot —— 角色 + 气泡 + 说话（SPEC 7.7）
 *
 * 气泡的出现与 TTS 同步：说话时显示，朗读结束后延时收起。
 * 对外通过 ref 暴露 say()，页面可以在任意时机让角色说话。
 */

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'

import { Momo } from './Momo'
import './Mascot.css'
import { useVoice } from '../../hooks/useVoice'
import { pickPhrase, type Phrase, type PhraseKind } from '../../content/phrases'

export type MascotMood = 'idle' | 'happy' | 'encourage' | 'sleepy'

/** happy / encourage 播完后回 idle 的时长（SPEC 7.7） */
const MOOD_MS: Record<MascotMood, number> = {
  idle: 0,
  happy: 1000,
  encourage: 800,
  sleepy: 0,
}

/** 朗读结束后气泡多留一会儿，孩子才来得及看 */
const BUBBLE_LINGER_MS = 1200

export interface MascotHandle {
  /** 说一句指定台词 */
  say: (phrase: Phrase, mood?: MascotMood) => void
  /** 从台词库随机说一句 */
  sayRandom: (kind: PhraseKind, mood?: MascotMood) => void
  setMood: (mood: MascotMood) => void
}

interface Props {
  /** 是否显示中文小字（家长设置） */
  showZh?: boolean
  /** 固定情绪（如晚安页的 sleepy）；不传则由 say() 控制 */
  mood?: MascotMood
  className?: string
  /** 点角色是否重复上一句话 */
  tappable?: boolean
  /**
   * 角色每次开口时回调（含用户点击触发的）。
   * 页面用它标记「已经说过话了」，避免自动打招呼的 effect 在同一次手势里再说一遍。
   */
  onSay?: () => void
}

export const Mascot = forwardRef<MascotHandle, Props>(function Mascot(
  { showZh = true, mood: fixedMood, className = '', tappable = true, onSay },
  ref,
) {
  const [mood, setMoodState] = useState<MascotMood>(fixedMood ?? 'idle')
  const [phrase, setPhrase] = useState<Phrase | null>(null)
  // useVoice 在卸载时会自动停止播放，无需在此另行处理
  const { sayPhrase } = useVoice()

  const moodTimer = useRef<number>()
  const bubbleTimer = useRef<number>()
  const lastPhrase = useRef<Phrase | null>(null)
  /** 每次 say() 自增：只有最新一次说话的定时器才允许收起气泡 */
  const sayId = useRef(0)

  useEffect(() => {
    return () => {
      window.clearTimeout(moodTimer.current)
      window.clearTimeout(bubbleTimer.current)
    }
  }, [])

  // 外部固定情绪优先
  useEffect(() => {
    if (fixedMood) setMoodState(fixedMood)
  }, [fixedMood])

  const setMood = useCallback(
    (next: MascotMood) => {
      setMoodState(next)
      window.clearTimeout(moodTimer.current)

      const back = MOOD_MS[next]
      if (back > 0) {
        moodTimer.current = window.setTimeout(() => {
          setMoodState(fixedMood ?? 'idle')
        }, back)
      }
    },
    [fixedMood],
  )

  const say = useCallback(
    (p: Phrase, nextMood: MascotMood = 'happy') => {
      lastPhrase.current = p
      setPhrase(p)
      setMood(nextMood)
      onSay?.()

      const id = ++sayId.current
      window.clearTimeout(bubbleTimer.current)

      /** 只有最新一次 say 能收起气泡，否则连续说话时旧定时器会提前清掉新气泡 */
      const hideAfter = (ms: number) => {
        window.clearTimeout(bubbleTimer.current)
        bubbleTimer.current = window.setTimeout(() => {
          if (sayId.current === id) setPhrase(null)
        }, ms)
      }

      // 兜底：播放完全无响应时也不让气泡永久停留
      hideAfter(6000)

      sayPhrase(p.en, () => hideAfter(BUBBLE_LINGER_MS))
    },
    [setMood, sayPhrase, onSay],
  )

  const sayRandom = useCallback(
    (kind: PhraseKind, nextMood: MascotMood = 'happy') => {
      say(pickPhrase(kind), nextMood)
    },
    [say],
  )

  useImperativeHandle(ref, () => ({ say, sayRandom, setMood }), [say, sayRandom, setMood])

  const handleTap = () => {
    if (!tappable) return
    const p = lastPhrase.current ?? pickPhrase('greet')
    say(p, 'happy')
  }

  return (
    <div className={`mascot mascot--right mascot--${mood} ${className}`}>
      {phrase && (
        <div className="bubble" role="status" aria-live="polite">
          <div className="bubble__en">{phrase.en}</div>
          {showZh && <div className="bubble__zh">{phrase.zh}</div>}
        </div>
      )}

      <button
        className="mascot__figure"
        onClick={handleTap}
        aria-label="小熊 Momo，点一下让它说话"
        type="button"
      >
        <Momo />
      </button>
    </div>
  )
})
