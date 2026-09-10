/**
 * 听音选图（SPEC 7.4）
 *
 * 每局 8 题；开局前显示「▶ Start」用于解锁音频。
 * 答对：放大 + sage 描边 + correct 音 + 小范围纸屑 + 星星 +1 + 角色 happy
 * 答错：抖动 + 桃色描边 + wrong 音（轻柔）+ 角色 encourage + 自动重读；
 *       第 2 次答错后正确项发光，点中即过且不计分（SPEC 4.2 零挫败）
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import './ListenPick.css'
import { getTheme } from '../../content'
import { WordArt } from '../../content/svg/WordArt'
import { navigate } from '../../router'
import { useApp } from '../../store/AppContext'
import { flushProgress } from '../../store/progress'
import { buildRound, QUESTIONS_PER_ROUND, type Question } from '../../logic/pickWords'
import { BackButton } from '../../components/BackButton'
import { StarCounter } from '../../components/StarCounter'
import { BigButton } from '../../components/BigButton'
import { Mascot, type MascotHandle } from '../../components/Mascot/Mascot'
import { burstSmall, burstCelebrate, clearConfetti } from '../../components/Confetti'
import { useVoice } from '../../hooks/useVoice'
import { useSfx } from '../../hooks/useSfx'
import { useAudioUnlocked } from '../../hooks/useAudioUnlocked'
import { NotFound } from '../NotFound'
import { GameButton } from '../../components/GameButton'
import { useGameLoop, usePageVisible } from '../../hooks/useGameLoop'

/** 答对后停留多久再出下一题（SPEC 7.4：800ms） */
const NEXT_DELAY_MS = 800
/** 答错后多久自动重读单词 */
const REREAD_DELAY_MS = 500
/** 达到几分算「表现很好」，播 celebrate + 纸屑（SPEC 7.4：≥ 6） */
const CELEBRATE_SCORE = 6

type Phase = 'start' | 'playing' | 'done'

/** 每题的作答状态 */
interface Answer {
  /** 已点过的错误选项 id */
  wrongIds: string[]
  /** 是否已答对（含提示后点中） */
  settled: boolean
  /** 是否计分（第 2 次答错后点中正确项不计分） */
  scored: boolean
}

interface Props {
  themeId: string
}

export function ListenPick({ themeId }: Props) {
  const theme = getTheme(themeId)
  const { progress, settings, updateProgress, addStars, checkThemeComplete, recordDaily, reward } = useApp()
  const { sayWord, speaking, stop } = useVoice()
  const sfx = useSfx()
  // 音频解锁只在开局的 Start 按钮里做（SPEC 7.4），不需要读 unlocked 状态
  const { unlock } = useAudioUnlocked()

  const [phase, setPhase] = useState<Phase>('start')
  const [round, setRound] = useState<Question[]>([])
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState<Answer>({ wrongIds: [], settled: false, scored: true })
  const [score, setScore] = useState(0)

  const mascot = useRef<MascotHandle>(null)
  const timers = useRef<{ remaining: number; fn: () => void }[]>([])
  const answerRef = useRef(answer)
  const finished = useRef(false)
  const visible = usePageVisible()
  const paused = !visible || !!reward
  /** 已自动朗读过的题号，避免 re-render 重复读 */
  const askedFor = useRef(-1)

  const question = round[index]
  const total = round.length

  /** 统一登记定时器，卸载时一次清掉 */
  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push({ remaining: ms, fn })
  }, [])

  const clearTimers = useCallback(() => {
    timers.current = []
  }, [])

  useGameLoop(phase !== 'start' && !paused, (delta) => {
    const due: (() => void)[] = []
    timers.current = timers.current.filter((timer) => { timer.remaining -= delta; if (timer.remaining <= 0) { due.push(timer.fn); return false } return true })
    due.forEach((fn) => fn())
  })
  useEffect(() => {
    if (paused) { askedFor.current = -1; if (!visible) stop() }
  }, [paused, visible, stop])

  useEffect(() => {
    return () => {
      clearTimers()
      clearConfetti()
    }
  }, [clearTimers])

  /* ---- 出题时朗读目标词 ---- */

  useEffect(() => {
    if (phase !== 'playing' || !question || paused || answer.settled) return
    if (askedFor.current === index) return

    askedFor.current = index
    later(() => sayWord(question.word), 300)
  }, [phase, question, index, sayWord, later, paused, answer.settled])

  /* ---- 开局 ---- */

  const start = () => {
    if (!theme) return
    // 必须在用户手势里解锁音频（SPEC 10.3）
    unlock()
    clearTimers()
    finished.current = false

    setRound(buildRound(theme.words, progress.wordStats, { count: QUESTIONS_PER_ROUND }))
    setIndex(0)
    setAnswer({ wrongIds: [], settled: false, scored: true })
    answerRef.current = { wrongIds: [], settled: false, scored: true }
    setScore(0)
    askedFor.current = -1
    setPhase('playing')
  }

  /* ---- 作答 ---- */

  const recordStat = useCallback(
    (wordId: string, correct: boolean) => {
      updateProgress((p) => {
        const prev = p.wordStats[wordId] ?? { seen: 0, correct: 0, wrong: 0, lastSeen: 0 }
        return {
          ...p,
          wordStats: {
            ...p.wordStats,
            [wordId]: {
              seen: prev.seen + 1,
              correct: prev.correct + (correct ? 1 : 0),
              wrong: prev.wrong + (correct ? 0 : 1),
              lastSeen: Date.now(),
            },
          },
        }
      })
      if (correct) recordDaily({ kind: 'review', wordId })
    },
    [updateProgress, recordDaily],
  )

  const goNext = useCallback(() => {
    clearConfetti()
    setAnswer({ wrongIds: [], settled: false, scored: true })
    answerRef.current = { wrongIds: [], settled: false, scored: true }
    setIndex((i) => i + 1)
  }, [])

  const pick = (optionId: string) => {
    if (!question || answerRef.current.settled || paused || document.hidden) return

    const isCorrect = optionId === question.word.id

    if (isCorrect) {
      // 答对后要取消排队中的「自动重读」，否则下一题出来时会念上一题的词
      clearTimers()

      // 提示后点中不计分（SPEC 7.4）
      const scored = answerRef.current.wrongIds.length < 2
      answerRef.current = { ...answerRef.current, settled: true, scored }
      setAnswer(answerRef.current)

      sfx.correct()
      recordStat(question.word.id, scored)

      if (scored) {
        setScore((s) => s + 1)
        addStars(1)
        burstSmall()
      }

      mascot.current?.sayRandom('correct', 'happy')

      later(() => {
        if (index + 1 >= total) {
          void finish(scored ? score + 1 : score)
        } else {
          goNext()
        }
      }, NEXT_DELAY_MS)
      return
    }

    /* ---- 答错 ---- */

    if (answerRef.current.wrongIds.includes(optionId)) return

    const wrongIds = [...answerRef.current.wrongIds, optionId]
    answerRef.current = { ...answerRef.current, wrongIds }
    setAnswer(answerRef.current)

    sfx.wrong()
    // 只在第一次答错时记 wrong，避免同一题被记多次
    if (wrongIds.length === 1) recordStat(question.word.id, false)

    // 连续答错时只保留最后一次重读，避免多条人声排队
    clearTimers()
    mascot.current?.sayRandom('wrong', 'encourage')
    // 角色说完再重读单词，两条人声不会撞在一起
    later(() => sayWord(question.word), REREAD_DELAY_MS + 900)
  }

  /* ---- 局末 ---- */

  const finish = async (finalScore: number) => {
    if (finished.current) return
    finished.current = true
    stop()
    setPhase('done')

    // 完成一局 +5 星（SPEC 7.8）
    addStars(5)

    // 记录最佳成绩
    if (theme) {
      updateProgress((p) => {
        const tp = p.themes[theme.id] ?? { learned: [], best: {}, completed: false }
        const best = Math.max(tp.best.listen ?? 0, finalScore)
        return { ...p, themes: { ...p.themes, [theme.id]: { ...tp, best: { ...tp.best, listen: best } } } }
      })
    }

    // 局末是关键节点，立即落盘（SPEC 12.2）
    // 最佳成绩刚写进去，此时判定主题是否达成完成条件（SPEC 7.2）
    const completed = theme ? checkThemeComplete(theme.id) : false
    recordDaily({ kind: 'listen', themeId })
    void flushProgress()

    // 完成主题时由 RewardOverlay 接管庆祝，这里不再叠加自己的音效
    if (!completed) {
      if (finalScore >= CELEBRATE_SCORE) {
        sfx.celebrate()
        burstCelebrate()
      }
      later(() => mascot.current?.sayRandom('finish', 'happy'), 400)
    }
  }

  if (!theme) return <NotFound />

  /* ---- 开局页 ---- */

  if (phase === 'start') {
    return (
      <main className="page page-enter listen">
        <header className="page-header">
          <BackButton to={`/theme/${theme.id}`} icon="back" />
          <div className="page-header__spacer" />
          <StarCounter stars={progress.stars} />
        </header>

        <div className="listen__start">
          <span className="emoji" style={{ fontSize: 72 }} aria-hidden="true">
            👂
          </span>
          <h1 className="listen__start-title">Listen &amp; Pick</h1>
          {settings.showZh && <p className="listen__start-zh">听一听，选出对应的图</p>}
          <BigButton variant="primary" icon="▶" onClick={start}>
            Start
          </BigButton>
        </div>
      </main>
    )
  }

  /* ---- 局末页 ---- */

  if (phase === 'done') {
    return (
      <main className="page page-enter listen">
        <header className="page-header">
          <BackButton to={`/theme/${theme.id}`} icon="back" />
          <div className="page-header__spacer" />
          <StarCounter stars={progress.stars} />
        </header>

        <div className="listen__result">
          <div className="listen__result-mascot">
            <Mascot ref={mascot} showZh={settings.showZh} />
          </div>

          <p className="listen__score">
            {score} / {total}
          </p>
          <p className="listen__score-label">答对 {score} 题，获得 {score + 5} 颗星</p>
          <p className="listen__stars" aria-hidden="true">
            {'⭐'.repeat(Math.min(score + 5, 13))}
          </p>

          <div className="listen__result-actions">
            <BigButton variant="soft" icon="🔁" onClick={start}>
              再玩一次
            </BigButton>
            <BigButton
              variant="primary"
              icon="🏠"
              onClick={() => navigate(`/theme/${theme.id}`)}
            >
              回主题
            </BigButton>
          </div>
        </div>
      </main>
    )
  }

  /* ---- 答题页 ---- */

  const showHint = answer.wrongIds.length >= 2

  return (
    <main className="page page-enter listen">
      <header className="page-header">
        <BackButton to={`/theme/${theme.id}`} icon="back" />
        <span className="listen__progress">
          {index + 1} / {total}
        </span>
        <div className="page-header__spacer" />
        <StarCounter stars={progress.stars} />
      </header>

      <div
        className="listen__bar"
        role="progressbar"
        aria-valuenow={index + 1}
        aria-valuemin={1}
        aria-valuemax={total}
      >
        <div className="listen__bar-fill" style={{ width: `${((index + 1) / total) * 100}%` }} />
      </div>

      <div className="listen__stage">
        <button
          className={`listen__replay ${speaking ? 'is-speaking' : ''}`}
          onClick={() => {
            sfx.tap()
            if (question) sayWord(question.word)
          }}
          aria-label="再听一次"
        >
          <span className="emoji listen__replay-icon" aria-hidden="true">
            🔊
          </span>
          <span className="listen__replay-label">再听一次</span>
        </button>

        <div className="options" role="group" aria-label="选出听到的单词">
          {question?.options.map((opt) => {
            const isWrong = answer.wrongIds.includes(opt.id)
            const isCorrectPick = answer.settled && opt.id === question.word.id
            const isHint = showHint && !answer.settled && opt.id === question.word.id

            const cls = [
              'option',
              isCorrectPick && 'option--correct',
              isWrong && 'option--wrong',
              isHint && 'option--hint',
            ]
              .filter(Boolean)
              .join(' ')

            return (
              <GameButton
                key={opt.id}
                className={cls}
                onClick={() => pick(opt.id)}
                disabled={answer.settled || isWrong || paused}
                aria-label={opt.text}
              >
                <WordArt word={opt} className="option__emoji" />
              </GameButton>
            )
          })}
        </div>
      </div>

      <div className="listen__mascot">
        <Mascot ref={mascot} showZh={settings.showZh} tappable={false} />
      </div>
    </main>
  )
}
