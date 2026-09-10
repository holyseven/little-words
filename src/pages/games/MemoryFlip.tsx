import { useEffect, useRef, useState } from 'react'
import { getTheme } from '../../content'
import { WordArt } from '../../content/svg/WordArt'
import { GameButton } from '../../components/GameButton'
import { GameIntro, GameResult, GameScreen } from '../../components/GameScreen'
import { useApp } from '../../store/AppContext'
import { useAudioUnlocked } from '../../hooks/useAudioUnlocked'
import { useVoice } from '../../hooks/useVoice'
import { useSfx } from '../../hooks/useSfx'
import { useGameLoop, usePageVisible } from '../../hooks/useGameLoop'
import { useGameProgress } from '../../hooks/useGameProgress'
import { createMemoryRound, flipMemoryCard, memoryPairCount, settleMemoryTurn, type MemoryRound } from '../../logic/memory'
import { NotFound } from '../NotFound'

export function MemoryFlip({ themeId }: { themeId: string }) {
  const theme = getTheme(themeId)
  const { settings, reward, addStars } = useApp()
  const { unlock } = useAudioUnlocked()
  const { sayWord, stop } = useVoice()
  const sfx = useSfx()
  const { recordWord, finishRound } = useGameProgress(themeId)
  const visible = usePageVisible()
  const [phase, setPhase] = useState<'start' | 'playing' | 'done'>('start')
  const [round, setRound] = useState<MemoryRound>({ cards: [], open: [], matched: [] })
  const current = useRef(round)
  const phaseRef = useRef(phase)
  const remaining = useRef(0)
  const commit = (next: MemoryRound) => { current.current = next; setRound(next) }
  const pairs = round.cards.length / 2
  const paused = !visible || !!reward

  useEffect(() => { if (!visible) stop() }, [visible, stop])

  const start = () => {
    if (!theme || phaseRef.current === 'playing') return
    unlock()
    stop()
    remaining.current = 0
    commit(createMemoryRound(theme.words, memoryPairCount(window.innerWidth, window.innerHeight)))
    phaseRef.current = 'playing'
    setPhase('playing')
  }

  const flip = (id: string) => {
    if (phaseRef.current !== 'playing' || paused || document.hidden) return
    const previous = current.current
    const next = flipMemoryCard(previous, id)
    if (next === previous) return
    commit(next)
    const card = next.cards.find((c) => c.id === id)!
    sayWord(card.word)
    sfx.flip()
    recordWord(card.word.id)
    if (next.open.length !== 2) return

    const matched = next.matched.length > previous.matched.length
    if (matched) {
      sfx.correct()
      recordWord(card.word.id, 'correct')
      addStars(1)
    } else {
      for (const openId of next.open) recordWord(next.cards.find((c) => c.id === openId)!.word.id, 'wrong')
    }
    remaining.current = matched ? 700 : 1000
  }

  useGameLoop(phase === 'playing' && !paused, (delta) => {
    if (phaseRef.current !== 'playing') return
    if (current.current.open.length !== 2) return
    remaining.current -= delta
    if (remaining.current > 0) return
    const previous = current.current
    const first = previous.cards.find((card) => card.id === previous.open[0])!
    const unmatched = !previous.matched.includes(first.word.id)
    const next = settleMemoryTurn(previous)
    commit(next)
    if (next.matched.length === next.cards.length / 2) {
      // 先同步锁定，最后一对连点和排队的帧都不能重复结算。
      phaseRef.current = 'done'
      setPhase('done')
      stop()
      finishRound('memory', next.matched.length)
    } else if (unmatched) {
      sfx.flip()
    }
  })

  if (!theme) return <NotFound />
  return <GameScreen themeId={themeId} label={phase === 'playing' ? `${round.matched.length} / ${pairs}` : 'Memory'} className="memory">
    {phase === 'start' && <GameIntro icon="🃏" title="Memory Flip" description="Match a picture with its word." zh="翻一翻，把图片和单词配成一对" start={start} />}
    {phase === 'done' && <GameResult themeId={themeId} stars={pairs + 5} summary={`${pairs} pairs found!`} zh={`找到全部 ${pairs} 对，完成一局再得 5 颗星`} restart={start} />}
    {phase === 'playing' && <>
      <p className="game__hint memory__instruction">{settings.showZh ? '图片 + 单词，找找好朋友' : 'Find the picture and its word.'}</p>
      <div className="page__body memory__scroll">
        <div className={`memory__board ${pairs > 6 ? 'memory__board--large' : ''}`} style={{ ['--memory-tint' as string]: `var(${theme.tint})` }} role="group" aria-label="记忆翻牌">
          {round.cards.map((card, index) => {
            const matched = round.matched.includes(card.word.id)
            const open = matched || round.open.includes(card.id)
            return <GameButton key={card.id}
              className={`memory__card ${open ? 'is-open' : ''} ${matched ? 'is-matched' : ''}`}
              disabled={matched || round.open.includes(card.id) || round.open.length === 2 || paused}
              aria-label={open ? `${card.word.text}${matched ? '，已配对' : ''}` : `翻开第 ${index + 1} 张卡`}
              aria-pressed={open} onClick={() => flip(card.id)}>
              {open ? <span className="memory__face" key="face">
                {card.face === 'picture' ? <WordArt word={card.word} /> : <span className="memory__word" lang="en">{card.word.text}</span>}
                {matched && <span className="memory__matched" aria-hidden="true">✦</span>}
              </span> : <svg className="memory__back" viewBox="0 0 100 100" aria-hidden="true">
                <path d="m50 24 8 17 19 3-14 13 3 19-16-9-17 9 4-19-14-13 19-3Z" />
                <path d="m20 12 3 6 7 1-5 5 1 7-6-4-6 4 1-7-5-5 7-1Zm61 58 3 6 7 1-5 5 1 7-6-4-6 4 1-7-5-5 7-1Z" opacity=".5" />
              </svg>}
            </GameButton>
          })}
        </div>
      </div>
    </>}
  </GameScreen>
}
