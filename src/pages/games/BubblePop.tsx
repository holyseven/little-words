import { useCallback, useEffect, useRef, useState } from 'react'
import { getTheme } from '../../content'
import type { Word } from '../../content/types'
import { WordArt } from '../../content/svg/WordArt'
import { GameButton } from '../../components/GameButton'
import { GameIntro, GameResult, GameScreen } from '../../components/GameScreen'
import { useApp } from '../../store/AppContext'
import { useAudioUnlocked } from '../../hooks/useAudioUnlocked'
import { useVoice } from '../../hooks/useVoice'
import { useSfx } from '../../hooks/useSfx'
import { useGameLoop, usePageVisible, useReducedMotion } from '../../hooks/useGameLoop'
import { useGameProgress } from '../../hooks/useGameProgress'
import { bubblePosition, createBubbleChoices, createBubbleTargets } from '../../logic/bubbles'
import { NotFound } from '../NotFound'

export function BubblePop({ themeId }: { themeId: string }) {
  const theme = getTheme(themeId)
  const { settings, reward, addStars } = useApp()
  const { unlock } = useAudioUnlocked()
  const { sayWord, stop, speaking } = useVoice()
  const sfx = useSfx()
  const { recordWord, finishRound } = useGameProgress(themeId)
  const visible = usePageVisible()
  const reduced = useReducedMotion()
  const [phase, setPhase] = useState<'start' | 'playing' | 'done'>('start')
  const [targets, setTargets] = useState<Word[]>([])
  const [index, setIndex] = useState(0)
  const [choices, setChoices] = useState<Word[]>([])
  const [popped, setPopped] = useState<string | null>(null)
  const [wrong, setWrong] = useState<string | null>(null)
  const phaseRef = useRef(phase)
  const settled = useRef(false)
  const madeMistake = useRef(false)
  const score = useRef(0)
  const nextIn = useRef(0)
  const wrongIn = useRef(0)
  // 位置写入 DOM transform；rAF 不触发 React 每帧重绘或读取布局。
  const elapsed = useRef(1000)
  const field = useRef<HTMLDivElement>(null)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const bounds = useRef({ width: 0, height: 0, size: 0 })
  const target = targets[index]
  const paused = !visible || !!reward

  const position = useCallback(() => {
    const { width, height, size } = bounds.current
    buttons.current.forEach((button, slot) => {
      if (!button) return
      const { x, y } = bubblePosition(slot, elapsed.current, width, height, size, reduced)
      button.style.transform = `translate3d(${x}px, ${y}px, 0)`
    })
  }, [reduced])

  useEffect(() => {
    if (phase !== 'playing' || !field.current) return
    const measure = () => {
      const box = field.current!
      bounds.current = { width: box.clientWidth, height: box.clientHeight, size: buttons.current[0]?.offsetWidth ?? 80 }
      position()
    }
    const observer = new ResizeObserver(measure)
    observer.observe(field.current)
    measure()
    return () => observer.disconnect()
  }, [phase, position])

  useEffect(() => { if (!visible) stop() }, [visible, stop])
  // 奖励关闭、前台恢复和出新题时重读，台词不会被下一题打断。
  useEffect(() => {
    if (phase !== 'playing' || paused || !target || popped) return
    const timer = window.setTimeout(() => sayWord(target), 220)
    return () => window.clearTimeout(timer)
  }, [phase, target, paused, popped, sayWord])

  const start = () => {
    if (!theme || phaseRef.current === 'playing') return
    unlock()
    stop()
    const next = createBubbleTargets(theme.words)
    setTargets(next)
    setIndex(0)
    setChoices(createBubbleChoices(theme.words, next[0]))
    setPopped(null)
    setWrong(null)
    score.current = 0
    settled.current = false
    madeMistake.current = false
    nextIn.current = 0
    wrongIn.current = 0
    elapsed.current = 1000
    phaseRef.current = 'playing'
    setPhase('playing')
  }

  const pick = (word: Word) => {
    if (!target || phaseRef.current !== 'playing' || paused || document.hidden || settled.current) return
    if (word.id !== target.id) {
      if (wrongIn.current > 0) return
      if (!madeMistake.current) recordWord(target.id, 'wrong')
      madeMistake.current = true
      setWrong(word.id)
      wrongIn.current = 700
      sfx.wrong()
      sayWord(target)
      return
    }
    settled.current = true
    if (!madeMistake.current) score.current++
    recordWord(target.id, 'correct')
    setPopped(word.id)
    setWrong(null)
    sfx.pop()
    addStars(1)
    nextIn.current = 650
  }

  useGameLoop(phase === 'playing' && !paused, (delta) => {
    if (phaseRef.current !== 'playing') return
    elapsed.current += delta
    position()
    if (wrongIn.current > 0) {
      wrongIn.current -= delta
      if (wrongIn.current <= 0) setWrong(null)
    }
    if (!settled.current) return
    nextIn.current -= delta
    if (nextIn.current > 0) return
    if (index + 1 >= targets.length) {
      phaseRef.current = 'done'
      setPhase('done')
      stop()
      finishRound('bubble', score.current)
      return
    }
    const next = index + 1
    setIndex(next)
    setChoices(createBubbleChoices(theme!.words, targets[next]))
    setPopped(null)
    setWrong(null)
    settled.current = false
    madeMistake.current = false
    wrongIn.current = 0
  })

  if (!theme) return <NotFound />
  return <GameScreen themeId={themeId} label={phase === 'playing' ? `${index + 1} / ${targets.length}` : 'Bubbles'} className="bubbles">
    {phase === 'start' && <GameIntro icon="🫧" title="Bubble Pop" description="Listen, then tap the bubble." zh="听一听，戳中那个泡泡；飘走了还会回来" start={start} />}
    {phase === 'done' && <GameResult themeId={themeId} stars={targets.length + 5} summary={`${targets.length} bubbles popped!`} zh={`找到全部 ${targets.length} 个目标，完成一局再得 5 颗星`} restart={start} />}
    {phase === 'playing' && target && <div className="page__body bubbles__body">
      <button className={`bubbles__target ${speaking ? 'is-speaking' : ''}`} disabled={paused || !!popped}
        aria-label={`再听一次 ${target.text}`} onClick={() => { unlock(); sfx.tap(); sayWord(target) }}>
        <span className="emoji" aria-hidden="true">🔊</span>
        <strong lang="en">{target.text}</strong>
      </button>
      <p className="game__hint">{settings.showZh ? '慢慢找，泡泡会再回来' : 'Take your time. Bubbles come back.'}</p>
      <div className="bubbles__field" ref={field} role="group" aria-label="找到目标泡泡">
        {choices.map((word, slot) => <GameButton key={slot} ref={(node) => { buttons.current[slot] = node }}
          className="bubbles__bubble" disabled={paused || !!popped} aria-label={word.text} onClick={() => pick(word)}>
          <span className={`bubbles__skin ${popped === word.id ? 'is-popped' : ''} ${wrong === word.id ? 'is-wrong' : ''}`}>
            <WordArt word={word} />
          </span>
        </GameButton>)}
      </div>
    </div>}
  </GameScreen>
}
