/**
 * 单词大卡（SPEC 7.3）
 *
 * 点 emoji → 再读一次单词；点单词文字 → 朗读例句并显示例句。
 * 切换卡片时由 key 变化触发进入动画，方向由 direction 决定。
 */

import { useEffect, useState } from 'react'

import './WordCard.css'
import type { Word } from '../content/types'
import { WordArt } from '../content/svg/WordArt'
import { useSfx } from '../hooks/useSfx'

interface Props {
  word: Word
  showZh: boolean
  known: boolean
  /** 卡片切换方向，决定滑入动画 */
  direction: 'next' | 'prev'
  onSpeakWord: () => void
  onSpeakSentence: () => void
  /** 音频尚未解锁时显示「点我听」提示（SPEC 7.3） */
  audioReady: boolean
  speaking: boolean
}

export function WordCard({
  word,
  showZh,
  known,
  direction,
  onSpeakWord,
  onSpeakSentence,
  audioReady,
  speaking,
}: Props) {
  const sfx = useSfx()
  const [showSentence, setShowSentence] = useState(false)

  // 换词时收起上一个词的例句
  useEffect(() => {
    setShowSentence(false)
  }, [word.id])

  const handleArt = () => {
    sfx.tap()
    onSpeakWord()
  }

  const handleText = () => {
    sfx.tap()
    setShowSentence(true)
    onSpeakSentence()
  }

  return (
    <article
      key={word.id}
      className={`word-card is-enter-${direction}`}
      aria-label={`单词 ${word.text}，${word.zh}`}
    >
      {known && (
        <span className="emoji word-card__known" aria-label="已认识">
          ⭐
        </span>
      )}

      <button
        className={`word-card__art ${speaking ? 'is-speaking' : ''}`}
        onClick={handleArt}
        aria-label={`${word.text}，点一下再听一次`}
      >
        <WordArt word={word} className="word-card__emoji" />
      </button>

      <button
        className="word-card__text"
        onClick={handleText}
        aria-label={`朗读例句：${word.sentence}`}
      >
        <span className="word-card__word">{word.text}</span>
        {showZh && <span className="word-card__zh">{word.zh}</span>}
      </button>

      {/* 未解锁音频时提示先点一下（避免孩子以为坏了） */}
      {!audioReady && <p className="word-card__hint">👆 点我听</p>}

      <p className="word-card__sentence">{showSentence ? word.sentence : ''}</p>
    </article>
  )
}
