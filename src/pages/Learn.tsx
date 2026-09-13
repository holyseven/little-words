/**
 * 单词卡学习（SPEC 7.3）
 *
 * 一次一张大卡：进入自动朗读（需音频已解锁）；左右滑动或点箭头切换；
 * 末尾显示总结页。首次「I know it」+1 星并立即落盘。
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import './Learn.css'
import { getTheme } from '../content'
import { navigate } from '../router'
import { useApp } from '../store/AppContext'
import { getThemeProgress } from '../store/progress'
import { BackButton } from '../components/BackButton'
import { StarCounter } from '../components/StarCounter'
import { WordCard } from '../components/WordCard'
import { BigButton } from '../components/BigButton'
import { Mascot, type MascotHandle } from '../components/Mascot/Mascot'
import { useVoice } from '../hooks/useVoice'
import { useSfx } from '../hooks/useSfx'
import { useAudioUnlocked } from '../hooks/useAudioUnlocked'
import { NotFound } from './NotFound'
import { InlineWordRepeat, type InlineWordRepeatHandle } from '../components/InlineWordRepeat'
import { burstCelebrate, burstSmall } from '../components/Confetti'

/** 横向滑动切卡的阈值：小于它当作误触 */
const SWIPE_PX = 48

interface Props {
  themeId: string
  startWordId?: string
}

export function Learn({ themeId, startWordId }: Props) {
  const theme = getTheme(themeId)
  const { progress, settings, markLearned, checkThemeComplete } = useApp()
  const { sayWord, saySentence, speaking, stop, preloadClips } = useVoice()
  const sfx = useSfx()
  const { unlocked, unlock } = useAudioUnlocked()

  /**
   * index 允许等于 words.length，表示「已走到末尾」→ 显示总结页。
   * 把 done 从 index 派生出来（而不是另存一份 state），这样 go() 可以用
   * 函数式更新，同一帧内的连续点击不会因为闭包里的旧 index 而丢失。
   */
  const [index, setIndex] = useState(() => Math.max(0, theme?.words.findIndex((word) => word.id === startWordId) ?? 0))
  const [direction, setDirection] = useState<'next' | 'prev'>('next')
  /** 本次学习新标记的词数，用于总结页 */
  const [gained, setGained] = useState(0)

  /** 记录已自动朗读过的词，避免 re-render 重复朗读 */
  const spokenFor = useRef<string | null>(null)
  /** 自动朗读的延时句柄；手动点击时要取消它，否则同一个词会播两遍 */
  const autoSpeakTimer = useRef<number>()
  const pointerStart = useRef<{ id: number; x: number; y: number } | null>(null)
  const advanceTimer = useRef<number>()
  const advancing = useRef(false)
  const repeatRef = useRef<InlineWordRepeatHandle>(null)
  useEffect(() => () => clearTimeout(advanceTimer.current), [])

  const words = theme?.words ?? []
  const total = words.length
  const done = total > 0 && index >= total
  const word = words[index]

  // 进入新卡片自动朗读（SPEC 7.3）。音频未解锁时跳过，由卡片上的「点我听」引导。
  useEffect(() => {
    if (!word || done) return
    if (!unlocked) return
    if (spokenFor.current === word.id) return

    spokenFor.current = word.id
    // 等切卡动画走完再读，声音和画面同步
    autoSpeakTimer.current = window.setTimeout(() => sayWord(word), 260)
    return () => window.clearTimeout(autoSpeakTimer.current)
  }, [word, unlocked, done, sayWord])

  /**
   * 手动朗读：解锁手势会让上面的 effect 也排一次自动朗读，
   * 两者叠加会把同一个词播两遍（第一遍还会被第二遍打断）。
   * 这里取消排队中的自动朗读，并标记本词已读过。
   */
  const speakNow = useCallback(
    (fn: () => void) => {
      repeatRef.current?.cancel()
      window.clearTimeout(autoSpeakTimer.current)
      if (word) spokenFor.current = word.id
      if (!unlocked) unlock()
      fn()
    },
    [word, unlocked, unlock],
  )

  // 预解码前后几张卡的音频，孩子快速翻页时不会有等待
  useEffect(() => {
    if (!unlocked || total === 0) return
    const nearby = words.slice(Math.max(0, index - 1), index + 3)
    preloadClips(nearby.flatMap((w) => [`w/${w.id}`, `s/${w.id}`]))
  }, [unlocked, index, total, words, preloadClips])

  // 进入总结页时停掉朗读，别让上一张卡的声音压过角色的祝贺
  useEffect(() => {
    if (done) stop()
  }, [done, stop])

  const go = useCallback(
    (delta: number) => {
      if (total === 0) return
      repeatRef.current?.cancel()
      clearTimeout(advanceTimer.current)
      advancing.current = false
      setDirection(delta > 0 ? 'next' : 'prev')
      // 上界取 total（= 总结页），下界 0
      setIndex((prev) => Math.min(total, Math.max(0, prev + delta)))
    },
    [total],
  )

  const handleNext = () => {
    sfx.tap()
    go(1)
  }

  const handlePrev = () => {
    sfx.tap()
    go(-1)
  }

  /* ---- 左右滑动切卡：只跟第一个 pointer，忽略多指（SPEC 11.2） ---- */

  const onPointerDown = (e: React.PointerEvent) => {
    if (pointerStart.current !== null) return
    pointerStart.current = { id: e.pointerId, x: e.clientX, y: e.clientY }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const start = pointerStart.current
    if (!start || start.id !== e.pointerId) return
    pointerStart.current = null

    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    // 纵向位移更大时视为滚动，不切卡
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dy) > Math.abs(dx)) return

    sfx.tap()
    go(dx < 0 ? 1 : -1)
  }

  const onPointerCancel = (e: React.PointerEvent) => {
    if (pointerStart.current?.id === e.pointerId) pointerStart.current = null
  }

  if (!theme) return <NotFound />

  const tp = getThemeProgress(progress, theme.id)
  const known = word ? tp.learned.includes(word.id) : false

  // BigButton 自带 tap 音，这里只处理业务逻辑
  const handleKnow = () => {
    if (!word || advancing.current) return
    repeatRef.current?.cancel()
    advancing.current = true

    const firstTime = markLearned(theme.id, word.id)
    if (firstTime) {
      setGained((n) => n + 1)
      // 学完最后一个词可能刚好达成主题完成条件（SPEC 7.2）
      checkThemeComplete(theme.id)
    }

    // 标记后自动前进，减少孩子的操作步骤
    advanceTimer.current = window.setTimeout(() => go(1), 260)
  }

  const handleListenAgain = () => {
    if (word) speakNow(() => sayWord(word))
  }

  /* ---- 总结页 ---- */

  if (done) {
    return (
      <main className="page page-enter learn">
        <header className="page-header">
          <BackButton to={`/theme/${theme.id}`} icon="back" />
          <div className="page-header__spacer" />
          <StarCounter stars={progress.stars} />
        </header>

        <Summary
          themeId={theme.id}
          themeTitle={theme.title}
          learnedCount={tp.learned.length}
          total={total}
          gained={gained}
          showZh={settings.showZh}
          onAgain={() => {
            // tap 音由 Summary 里的 BigButton 负责
            spokenFor.current = null
            setDirection('next')
            setIndex(0)
          }}
        />
      </main>
    )
  }

  return (
    <main className="page page-enter learn">
      <header className="page-header">
        <BackButton to={`/theme/${theme.id}`} icon="back" />
        <span className="learn__progress">
          {index + 1} / {total}
        </span>
        <div className="page-header__spacer" />
        <StarCounter stars={progress.stars} />
      </header>

      <div
        className="learn__bar"
        role="progressbar"
        aria-valuenow={index + 1}
        aria-valuemin={1}
        aria-valuemax={total}
      >
        <div className="learn__bar-fill" style={{ width: `${((index + 1) / total) * 100}%` }} />
      </div>

      <div className="learn__stage">
        <button
          className="learn__arrow"
          onClick={handlePrev}
          disabled={index === 0}
          aria-label="上一个单词"
        >
          <span aria-hidden="true">‹</span>
        </button>

        <div
          className="learn__swipe"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        >
          {word && (
            <WordCard
              word={word}
              showZh={settings.showZh}
              known={known}
              direction={direction}
              audioReady={unlocked}
              speaking={speaking}
              onSpeakWord={() => speakNow(() => sayWord(word))}
              onSpeakSentence={() => speakNow(() => saySentence(word))}
            />
          )}
        </div>

        <button className="learn__arrow" onClick={handleNext} aria-label="下一个单词">
          <span aria-hidden="true">›</span>
        </button>
      </div>

      <div className="learn__actions">
        <InlineWordRepeat key={word.id} ref={repeatRef} word={word.text} showZh={settings.showZh} onSuccess={() => {
          // 每次答对随机选择一组轻量反馈，避免连续练习总是同一套动画。
          const effect = Math.floor(Math.random() * 4)
          if (effect === 0) { sfx.celebrate(); burstSmall() }
          else if (effect === 1) { sfx.sticker(); burstCelebrate() }
          else if (effect === 2) { sfx.correct(); burstSmall() }
          else { sfx.pop(); burstSmall() }
        }} onBeforeStart={() => {
          // 跟读成功后的庆祝音效也需要在 iOS 的首次用户手势中解锁。
          unlock()
          window.clearTimeout(autoSpeakTimer.current)
          clearTimeout(advanceTimer.current)
          advancing.current = false
          spokenFor.current = word.id
          stop()
        }} />
        <BigButton variant="soft" icon="🔊" onClick={handleListenAgain}>
          再听一次
        </BigButton>

        <BigButton
          variant={known ? 'surface' : 'primary'}
          className={known ? 'btn--known' : ''}
          icon="⭐"
          onClick={handleKnow}
          ariaLabel={known ? '已经认识了' : '我认识它，获得一颗星'}
        >
          {known ? '已认识' : 'I know it'}
        </BigButton>
      </div>
    </main>
  )
}

/* -------------------------------------------------------------------------- */
/* 总结页                                                                      */
/* -------------------------------------------------------------------------- */

interface SummaryProps {
  themeId: string
  themeTitle: string
  learnedCount: number
  total: number
  gained: number
  showZh: boolean
  onAgain: () => void
}

function Summary({
  themeId,
  themeTitle,
  learnedCount,
  total,
  gained,
  showZh,
  onAgain,
}: SummaryProps) {
  const mascot = useRef<MascotHandle>(null)
  const greeted = useRef(false)

  useEffect(() => {
    if (greeted.current) return
    greeted.current = true
    const t = window.setTimeout(() => mascot.current?.sayRandom('finish', 'happy'), 300)
    return () => window.clearTimeout(t)
  }, [])

  return (
    <div className="summary">
      <div className="summary__mascot">
        <Mascot ref={mascot} showZh={showZh} />
      </div>

      <h1 className="summary__title">Great job!</h1>

      <p className="summary__line">
        {themeTitle} 已认识 <b>{learnedCount}</b> / {total} 个单词
      </p>

      {gained > 0 && (
        <>
          <p className="summary__line">这次新学 {gained} 个</p>
          <p className="summary__stars" aria-label={`获得 ${gained} 颗星`}>
            {'⭐'.repeat(Math.min(gained, 10))}
          </p>
        </>
      )}

      <div className="summary__actions">
        <BigButton variant="soft" icon="🔁" onClick={onAgain}>
          再看一遍
        </BigButton>

        <BigButton variant="primary" icon="🏠" onClick={() => navigate(`/theme/${themeId}`)}>
          回主题
        </BigButton>
      </div>
    </div>
  )
}
