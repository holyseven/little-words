import { useEffect, useRef, useState } from 'react'
import { getTheme, type Word } from '../../content'
import { WordArt } from '../../content/svg/WordArt'
import { GameResult, GameScreen } from '../../components/GameScreen'
import { BigButton } from '../../components/BigButton'
import { burstSmall, clearConfetti } from '../../components/Confetti'
import { useApp } from '../../store/AppContext'
import { flushProgress } from '../../store/progress'
import { useVoice } from '../../hooks/useVoice'
import { useSfx } from '../../hooks/useSfx'
import { useAudioUnlocked } from '../../hooks/useAudioUnlocked'
import { useGameProgress } from '../../hooks/useGameProgress'
import { useGameLoop, usePageVisible } from '../../hooks/useGameLoop'
import { buildTrainRound, checkTrainAnswer, type TrainAnswer, type TrainQuestion } from '../../logic/wordTrain'
import { NotFound } from '../NotFound'
import './WordTrain.css'

type Phase = 'start' | 'playing' | 'departing' | 'arrived' | 'done'
type Feedback = 'idle' | Exclude<TrainAnswer, 'correct'>

function Engine() {
  return <svg className="word-train__engine" viewBox="0 0 150 155" aria-hidden="true">
    <g fill="var(--surface)" opacity=".85"><circle cx="26" cy="15" r="12" /><circle cx="48" cy="6" r="8" /></g>
    <path d="M18 64V32H43V64" fill="var(--coral)" stroke="var(--text)" strokeWidth="3" strokeLinejoin="round" />
    <rect x="16" y="60" width="78" height="64" rx="15" fill="var(--sky)" stroke="var(--text)" strokeWidth="3" />
    <rect x="77" y="34" width="61" height="89" rx="8" fill="var(--butter)" stroke="var(--text)" strokeWidth="3" />
    <path d="M70 36H146V25H70Z" fill="var(--coral)" stroke="var(--text)" strokeWidth="3" strokeLinejoin="round" />
    <rect x="91" y="46" width="33" height="35" rx="7" fill="var(--surface)" stroke="var(--text)" strokeWidth="3" />
    <circle cx="42" cy="81" r="5" fill="var(--text)" />
    <path d="M35 94Q43 103 51 94" fill="none" stroke="var(--text)" strokeWidth="3" strokeLinecap="round" />
    <path d="M17 107 2 128H142V115H17" fill="var(--coral)" stroke="var(--text)" strokeWidth="3" strokeLinejoin="round" />
    {[37, 111].map((x) => <g className="word-train__engine-wheel" key={x} style={{ transformOrigin: `${x}px 132px` }}>
      <circle cx={x} cy="132" r="17" fill="var(--text)" />
      <circle cx={x} cy="132" r="10" fill="var(--surface)" />
      <path d={`M${x - 10} 132H${x + 10}M${x} 122V142`} stroke="var(--text)" strokeWidth="3" />
    </g>)}
  </svg>
}

export function WordTrain({ themeId, backTo }: { themeId: string; backTo?: string }) {
  const theme = getTheme(themeId)
  const { settings, reward, addStars } = useApp()
  const { unlock } = useAudioUnlocked()
  const { sayWords, sayPhrase, stop, speaking } = useVoice()
  const { recordWord } = useGameProgress(themeId)
  const sfx = useSfx()
  const visible = usePageVisible()
  const paused = !visible || !!reward
  const [phase, setPhase] = useState<Phase>('start')
  const [round, setRound] = useState<TrainQuestion[]>([])
  const [index, setIndex] = useState(0)
  const [passengers, setPassengers] = useState<Word[]>([])
  const [feedback, setFeedback] = useState<Feedback>('idle')
  const phaseRef = useRef<Phase>('start')
  const passengersRef = useRef<Word[]>([])
  const announced = useRef<TrainQuestion | null>(null)
  const praised = useRef<TrainQuestion | null>(null)
  const remainingMs = useRef(0)
  const score = useRef(0)
  const question = round[index]
  const interactive = phase === 'playing' && !paused
  const text = (zh: string, en: string) => settings.showZh ? zh : en
  const changePhase = (next: Phase) => { phaseRef.current = next; setPhase(next) }
  const changePassengers = (items: Word[]) => { passengersRef.current = items; setPassengers(items) }

  useEffect(() => {
    if (!paused) return
    // A background interruption must not leave a half-announced sequence.
    announced.current = null
    stop()
  }, [paused, stop])

  useEffect(() => {
    const hide = () => { announced.current = null; stop() }
    window.addEventListener('pagehide', hide)
    return () => { window.removeEventListener('pagehide', hide); clearConfetti() }
  }, [stop])

  useEffect(() => {
    if (phase !== 'playing' || !question || paused || announced.current === question) return
    const timer = window.setTimeout(() => {
      announced.current = question
      sayWords(question.sequence)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [phase, question, paused, sayWords])

  useEffect(() => {
    if (phase !== 'arrived' || !question || paused || praised.current === question) return
    const timer = window.setTimeout(() => {
      praised.current = question
      sayPhrase('Great job!')
      burstSmall()
    }, 180)
    return () => window.clearTimeout(timer)
  }, [phase, question, paused, sayPhrase])

  useGameLoop(phase === 'departing' && !paused, (delta) => {
    if (phaseRef.current !== 'departing' || !question) return
    remainingMs.current -= delta
    if (remainingMs.current > 0) return
    // Lock before progress writes, which can immediately open a reward overlay.
    changePhase('arrived')
    score.current += 1
    question.sequence.forEach((word) => recordWord(word.id, 'correct'))
    addStars(1)
    sfx.correct()
  })

  if (!theme || !theme.words.length) return <NotFound />

  const start = () => {
    if (paused || document.hidden || !['start', 'done'].includes(phaseRef.current)) return
    unlock()
    stop()
    clearConfetti()
    setRound(buildTrainRound(theme.words))
    setIndex(0)
    score.current = 0
    announced.current = null
    praised.current = null
    changePassengers([])
    setFeedback('idle')
    changePhase('playing')
  }

  const board = (word: Word) => {
    if (!question || phaseRef.current !== 'playing' || paused || document.hidden) return
    if (passengersRef.current.length >= question.sequence.length || passengersRef.current.some((item) => item.id === word.id)) return
    changePassengers([...passengersRef.current, word])
    setFeedback('idle')
    sfx.pop()
  }

  const remove = (position: number) => {
    if (phaseRef.current !== 'playing' || paused || document.hidden) return
    changePassengers(passengersRef.current.filter((_, slot) => slot !== position))
    setFeedback('idle')
    sfx.tap()
  }

  const depart = () => {
    if (!question || phaseRef.current !== 'playing' || paused || document.hidden) return
    const result = checkTrainAnswer(question, passengersRef.current.map((word) => word.id))
    if (result !== 'correct') {
      setFeedback(result)
      if (result === 'wrong-order') sfx.wrong()
      return
    }
    stop()
    setFeedback('idle')
    remainingMs.current = 1350
    changePhase('departing')
    sfx.pop()
  }

  const next = () => {
    if (phaseRef.current !== 'arrived' || paused || document.hidden) return
    stop()
    clearConfetti()
    if (index + 1 >= round.length) {
      changePhase('done')
      addStars(5)
      void flushProgress()
      return
    }
    setIndex((value) => value + 1)
    changePassengers([])
    setFeedback('idle')
    changePhase('playing')
  }

  const label = text('单词小火车', 'Word Train')
  if (phase === 'start') return <GameScreen themeId={themeId} backTo={backTo} label={label} className="word-train">
    <div className="page__body game__center word-train__intro">
      <Engine />
      <h1>{label}</h1>
      <p className="game__hint">{text('小乘客要出发啦！按听到的顺序请它们上车。', 'All aboard! Let the passengers board in the order you hear.')}</p>
      <div className="word-train__steps"><span>① {text('听一听', 'Listen')}</span><span>② {text('按顺序点图片', 'Tap in order')}</span><span>③ {text('点击出发', 'Go!')}</span></div>
      <p className="word-train__small">{text('点车厢里的图片可以放回去，再选一次。', 'Tap a passenger in a carriage to put it back and choose again.')}</p>
      <BigButton variant="primary" icon="▶" onClick={start} disabled={paused}>{text('开始旅程', 'Start the journey')}</BigButton>
    </div>
  </GameScreen>

  if (phase === 'done') return <GameScreen themeId={themeId} backTo={backTo} label={label} className="word-train">
    <GameResult themeId={themeId} backTo={backTo} stars={score.current + 5} summary={`${score.current} happy train journeys!`} zh={`完成 ${score.current} 趟旅程，额外奖励 5 颗星`} restart={start} />
  </GameScreen>

  if (!question) return <NotFound />
  const messages: Record<Feedback, string> = {
    idle: text('点图片上车 · 点车厢里的图片放回', 'Tap a picture to board · Tap a passenger to put it back'),
    empty: text('先听一听，再请小乘客上车吧！', 'Listen, then invite the passengers aboard!'),
    incomplete: text('还有空车厢，继续请小乘客上车吧。', 'There is an empty carriage. Invite another passenger!'),
    'wrong-order': text('再听一遍，看看乘客和顺序。点车厢里的图片可以调整哦。', 'Listen again and check the passengers and their order. Tap a passenger to change it.'),
  }

  return <GameScreen themeId={themeId} backTo={backTo} label={`${label} · ${index + 1}/${round.length}`} className="word-train">
    <div className={`page__body word-train__body${paused ? ' is-paused' : ''}`}>
      <p className="word-train__instruction">{text('听顺序 → 点图片上车 → 出发', 'Listen → Tap pictures in order → Go!')}</p>
      <section className={`word-train__landscape is-${phase}${feedback === 'wrong-order' ? ' is-retry' : ''}`} aria-label={text('小火车，按听到的顺序上车', 'Train: board in the order you hear')}>
        <span className="word-train__sun" aria-hidden="true">☀</span>
        <div className="word-train__station" role="status">{phase === 'arrived' ? text('到站啦！Great job!', 'Great job! We have arrived!') : phase === 'departing' ? text('呜呜——出发啦！', 'Choo-choo! Off we go!') : text('小乘客，请上车', 'All aboard!')}</div>
        <div className="word-train__track">
          <div className="word-train__train">
            <Engine />
            {question.sequence.map((_, slot) => <button className={`word-train__car${passengers[slot] ? ' is-full' : ''}`} key={slot} type="button"
              disabled={!interactive || !passengers[slot]} onClick={() => remove(slot)}
              aria-label={passengers[slot] ? text(`第 ${slot + 1} 节车厢：${passengers[slot].zh}，点击放回`, `Carriage ${slot + 1}: ${passengers[slot].text}, tap to remove`) : text(`第 ${slot + 1} 节空车厢`, `Empty carriage ${slot + 1}`)}>
              <span className="word-train__number" aria-hidden="true">{slot + 1}</span>
              <span className="word-train__passenger">{passengers[slot] ? <WordArt word={passengers[slot]} /> : <span className="word-train__empty" aria-hidden="true">?</span>}</span>
              <span className="word-train__wheel word-train__wheel--left" aria-hidden="true" /><span className="word-train__wheel word-train__wheel--right" aria-hidden="true" />
            </button>)}
          </div>
        </div>
      </section>
      <div className="word-train__waiting" role="group" aria-label={text('候车小乘客', 'Waiting passengers')}>
        {question.options.map((word) => {
          const boarded = passengers.some((passenger) => passenger.id === word.id)
          return <button className={`word-train__option${boarded ? ' is-boarded' : ''}`} type="button" key={word.id}
            disabled={!interactive || boarded || passengers.length >= question.sequence.length} onClick={() => board(word)}
            aria-label={text(`${word.zh}${boarded ? '已上车' : '，点击上车'}`, `${word.text}${boarded ? ' is aboard' : ', tap to board'}`)}>
            <WordArt word={word} /><span className="word-train__option-hint">{boarded ? text('已上车 ✓', 'Aboard ✓') : text('点我上车', 'All aboard')}</span>
          </button>
        })}
      </div>
      <div className="word-train__controls">
        <BigButton icon="🔊" variant="soft" disabled={paused || phase === 'departing'} onClick={() => { unlock(); announced.current = question; sayWords(question.sequence) }}>{text(speaking && phase === 'playing' ? '正在念顺序…' : '再听一遍', speaking && phase === 'playing' ? 'Listen…' : 'Hear again')}</BigButton>
        {phase === 'arrived'
          ? <BigButton variant="primary" icon={index + 1 >= round.length ? '🏆' : '➡️'} disabled={paused} onClick={next}>{text(index + 1 >= round.length ? '完成旅程' : '下一站', index + 1 >= round.length ? 'Finish' : 'Next stop')}</BigButton>
          : <BigButton icon="🚂" variant="primary" onClick={depart} disabled={!interactive}>{text(phase === 'departing' ? '出发啦…' : '出发', phase === 'departing' ? 'Off we go…' : 'Go!')}</BigButton>}
      </div>
      <p className="word-train__feedback" role="status">{phase === 'playing' ? messages[feedback] : phase === 'arrived' ? text('乘客和顺序都对啦！', 'The passengers are all in the right order!') : ''}</p>
    </div>
  </GameScreen>
}
