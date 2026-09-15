import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'

import './MonsterRestaurant.css'
import { WordArt } from '../../content/svg/WordArt'
import { GameResult, GameScreen } from '../../components/GameScreen'
import { BigButton } from '../../components/BigButton'
import { burstSmall, clearConfetti } from '../../components/Confetti'
import { useApp } from '../../store/AppContext'
import { flushProgress } from '../../store/progress'
import { useAudioUnlocked } from '../../hooks/useAudioUnlocked'
import { useSfx } from '../../hooks/useSfx'
import { useVoice } from '../../hooks/useVoice'
import { useGameProgress } from '../../hooks/useGameProgress'
import { useGameLoop, usePageVisible } from '../../hooks/useGameLoop'
import { buildRestaurantRound, checkRestaurantPlate, type RestaurantFood, type RestaurantOrder } from '../../logic/restaurant'
import { NotFound } from '../NotFound'

type Phase = 'start' | 'playing' | 'eating' | 'served' | 'done'
type Feedback = 'idle' | 'empty' | 'wrong-food' | 'too-few' | 'too-many' | 'full'
interface Drag {
  pointerId: number
  food: RestaurantFood
  source: HTMLButtonElement
}
const PLATE_LIMIT = 5

function Monster({ mood = 'hungry' }: { mood?: 'hungry' | 'eating' | 'happy' }) {
  return <svg className={'restaurant__monster-art is-' + mood} viewBox="0 0 240 210" role="img" aria-label={mood === 'happy' ? '吃饱了的小怪兽' : '等着吃饭的小怪兽'}>
    <ellipse cx="120" cy="197" rx="77" ry="9" fill="rgba(73,91,75,.12)" />
    <path d="M66 57 54 21Q55 9 68 23L91 45M153 46 176 19Q187 7 183 26L177 60" fill="#f0c49f" stroke="#789b85" strokeWidth="5" strokeLinejoin="round" />
    <path d="M40 133Q7 119 17 151Q23 165 43 163M201 131Q232 118 225 149Q218 164 199 161" fill="#b4d5b4" stroke="#789b85" strokeWidth="5" />
    <path d="M41 116Q39 42 114 34Q197 29 201 118L202 160Q202 188 171 190L157 188Q141 202 127 189L113 190Q92 203 79 189L66 189Q34 185 41 156Z" fill="#b4d5b4" stroke="#789b85" strokeWidth="5" />
    <ellipse cx="90" cy="95" rx="26" ry="30" fill="#fffef5" />
    <ellipse cx="151" cy="95" rx="26" ry="30" fill="#fffef5" />
    {mood === 'happy' ? <g fill="none" stroke="#3f5144" strokeWidth="6" strokeLinecap="round">
      <path d="M78 99Q90 83 102 99M139 99Q151 83 163 99" />
    </g> : <g fill="#3f5144"><ellipse cx="94" cy="98" rx="9" ry="13" /><ellipse cx="147" cy="98" rx="9" ry="13" /></g>}
    <g fill="#e9aea0" opacity=".9"><ellipse cx="64" cy="130" rx="15" ry="9" /><ellipse cx="180" cy="130" rx="15" ry="9" /></g>
    <g className="restaurant__mouth">
      <path d="M91 138Q120 150 150 137Q145 174 121 174Q96 172 91 138Z" fill="#4d5a4a" />
      <path d="M103 165Q121 151 139 165Q121 181 103 165" fill="#e6a69b" />
      <path d="M107 143 108 153 118 148M131 146 137 154 142 140" fill="#fffef5" />
    </g>
  </svg>
}

/** Listening and counting game. Pointer capture supports iPad touch dragging. */
export function MonsterRestaurant({ themeId }: { themeId: string }) {
  const { settings, reward, addStars } = useApp()
  const { unlock } = useAudioUnlocked()
  const { sayPhrase, stop } = useVoice()
  const sfx = useSfx()
  const { recordWord } = useGameProgress(themeId)
  const visible = usePageVisible()
  const paused = !visible || !!reward
  const dropZone = useRef<HTMLElement>(null)
  const ghostElement = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | null>(null)
  const plateRef = useRef<RestaurantFood[]>([])
  const phaseRef = useRef<Phase>('start')
  const eatingMs = useRef(0)
  const announced = useRef<RestaurantOrder | null>(null)
  const thanked = useRef<RestaurantOrder | null>(null)
  const score = useRef(0)

  const [phase, setPhase] = useState<Phase>('start')
  const [orders, setOrders] = useState<RestaurantOrder[]>([])
  const [index, setIndex] = useState(0)
  const [plate, setPlate] = useState<RestaurantFood[]>([])
  const [feedback, setFeedback] = useState<Feedback>('idle')
  const [ghost, setGhost] = useState<{ food: RestaurantFood; x: number; y: number } | null>(null)
  const [overTray, setOverTray] = useState(false)
  const order = orders[index]
  const interactive = phase === 'playing' && !paused

  const changePhase = (next: Phase) => { phaseRef.current = next; setPhase(next) }
  const changePlate = (items: RestaurantFood[]) => { plateRef.current = items; setPlate(items) }
  const clearDrag = useCallback(() => {
    const current = drag.current
    drag.current = null
    if (current?.source.hasPointerCapture(current.pointerId)) current.source.releasePointerCapture(current.pointerId)
    setGhost(null)
    setOverTray(false)
  }, [])

  useEffect(() => {
    if (paused) { clearDrag(); stop() }
  }, [paused, clearDrag, stop])

  useEffect(() => {
    const cancel = () => { clearDrag(); stop() }
    window.addEventListener('pagehide', cancel)
    return () => { window.removeEventListener('pagehide', cancel); clearDrag(); clearConfetti() }
  }, [clearDrag, stop])

  useEffect(() => {
    if (phase !== 'playing' || !order || paused || announced.current === order) return
    const timer = window.setTimeout(() => {
      announced.current = order
      sayPhrase(order.sentence)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [phase, order, paused, sayPhrase])

  useEffect(() => {
    if (phase !== 'served' || !order || paused || thanked.current === order) return
    const timer = window.setTimeout(() => {
      thanked.current = order
      sayPhrase('Yummy! Thank you!')
      burstSmall()
    }, 180)
    return () => window.clearTimeout(timer)
  }, [phase, order, paused, sayPhrase])

  useGameLoop(phase === 'eating' && !paused, (delta) => {
    if (phaseRef.current !== 'eating' || !order) return
    eatingMs.current -= delta
    if (eatingMs.current > 0) return
    changePhase('served')
    score.current += 1
    recordWord(order.food.id, 'correct')
    addStars(1)
    sfx.correct()
  })

  if (themeId !== 'food') return <NotFound />

  const start = () => {
    if (phaseRef.current !== 'start' && phaseRef.current !== 'done') return
    unlock()
    stop()
    clearDrag()
    clearConfetti()
    setOrders(buildRestaurantRound())
    setIndex(0)
    changePlate([])
    setFeedback('idle')
    announced.current = null
    thanked.current = null
    score.current = 0
    changePhase('playing')
  }

  const addFood = (food: RestaurantFood) => {
    if (phaseRef.current !== 'playing' || paused || document.hidden) return
    if (plateRef.current.length >= PLATE_LIMIT) { setFeedback('full'); return }
    changePlate([...plateRef.current, food])
    setFeedback('idle')
    sfx.pop()
  }

  const pointInside = (x: number, y: number) => {
    const rect = dropZone.current?.getBoundingClientRect()
    return !!rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
  }

  const beginDrag = (event: PointerEvent<HTMLButtonElement>, food: RestaurantFood) => {
    if (!interactive || drag.current || !event.isPrimary || event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { pointerId: event.pointerId, food, source: event.currentTarget }
    setGhost({ food, x: event.clientX, y: event.clientY })
  }

  const moveDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return
    event.preventDefault()
    if (ghostElement.current) ghostElement.current.style.transform = 'translate(' + (event.clientX - 38) + 'px, ' + (event.clientY - 38) + 'px)'
    setOverTray(pointInside(event.clientX, event.clientY))
  }

  const endDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const current = drag.current
    if (!current || current.pointerId !== event.pointerId) return
    const accepted = pointInside(event.clientX, event.clientY)
    clearDrag()
    if (accepted) addFood(current.food)
  }

  const serve = () => {
    if (!order || phaseRef.current !== 'playing' || paused || document.hidden) return
    clearDrag()
    const result = checkRestaurantPlate(order, plateRef.current.map((food) => food.id))
    if (result !== 'correct') {
      setFeedback(result)
      if (result !== 'empty') sfx.wrong()
      return
    }
    stop()
    setFeedback('idle')
    eatingMs.current = 1000
    changePhase('eating')
    sfx.pop()
  }

  const next = () => {
    if (phaseRef.current !== 'served' || paused || document.hidden) return
    stop()
    clearConfetti()
    if (index + 1 >= orders.length) {
      changePhase('done')
      addStars(5)
      void flushProgress()
      return
    }
    setIndex((value) => value + 1)
    changePlate([])
    setFeedback('idle')
    changePhase('playing')
  }

  const text = (zh: string, en: string) => settings.showZh ? zh : en
  const instruction = text('听点餐 → 拖好食物 → 上菜', 'Listen → Drag the food → Serve')
  const messages: Record<Feedback, string> = {
    idle: text('点餐盘里的食物可以放回去', 'Tap food on the plate to put it back'),
    empty: text('先把食物拖到餐盘里吧', 'Drag some food to the plate first'),
    'wrong-food': text('有食物拿错啦，再听一遍，换一换吧', 'Check the food. Listen again and swap it'),
    'too-few': text('还少一点，再听听要几份吧', 'A little more, please. Listen to the number again'),
    'too-many': text('有点多啦，点餐盘里的食物放回一些吧', 'A little too much. Tap some food to put it back'),
    full: text('餐盘放满啦，先放回一些吧', 'The plate is full. Put something back first'),
  }

  if (phase === 'start') return <GameScreen themeId={themeId} label={text('怪兽餐厅', 'Monster Restaurant')} className="restaurant">
    <div className="page__body game__center restaurant__intro">
      <Monster />
      <h1>{text('怪兽餐厅', 'Monster Restaurant')}</h1>
      <p className="game__hint">{text('小怪兽饿了！听清它点了什么、要几份。', 'The monster is hungry! Listen for the food and the number.')}</p>
      <p>{instruction}</p>
      <BigButton icon="▶" variant="primary" onClick={start}>{text('开门营业', 'Open the restaurant')}</BigButton>
    </div>
  </GameScreen>

  if (phase === 'done') return <GameScreen themeId={themeId} label={text('怪兽餐厅 · 完成', 'Monster Restaurant · Done')} className="restaurant">
    <GameResult themeId={themeId} stars={score.current + 5} summary={score.current + ' happy customers!'} zh={'完成 ' + score.current + ' 单，额外奖励 5 颗星'} restart={start} />
  </GameScreen>

  if (!order) return <NotFound />
  return <GameScreen themeId={themeId} label={text('怪兽餐厅', 'Monster Restaurant') + ' · ' + (index + 1) + '/' + orders.length} className="restaurant">
    <div className={'page__body restaurant__body' + (paused ? ' is-paused' : '')}>
      <p className="restaurant__instruction">{instruction}</p>
      <section ref={dropZone} className={'restaurant__counter is-' + phase + (overTray ? ' is-over' : '') + (feedback !== 'idle' ? ' is-feedback-' + feedback : '')} aria-label={text('把食物拖给小怪兽', 'Drop food here for the monster')}>
        <div className="restaurant__monster"><Monster mood={phase === 'eating' ? 'eating' : phase === 'served' ? 'happy' : 'hungry'} /></div>
        <div className="restaurant__bubble" aria-live="polite">
          <strong lang="en">{phase === 'served' ? 'Yummy! Thank you!' : phase === 'eating' ? 'Nom, nom, nom…' : 'Hello, chef!'}</strong>
          {settings.showZh && <span>{phase === 'served' ? '吃饱啦，谢谢小厨师！' : phase === 'eating' ? '啊呜，啊呜……' : '我点好餐啦，听清了吗？'}</span>}
          {phase === 'served' && <span className="restaurant__completed-order" lang="en">{order.sentence}</span>}
        </div>
        <div className="restaurant__tray" aria-label={text('餐盘', 'Plate')}>
          {plate.length === 0 && <span className="restaurant__tray-hint">{text('把食物拖到这里', 'Drag food here')}</span>}
          {plate.map((food, slot) => <button type="button" className="restaurant__serving" key={slot} disabled={!interactive}
            aria-label={text('放回第 ' + (slot + 1) + ' 份：' + food.zh, 'Remove item ' + (slot + 1) + ': ' + food.text)}
            onClick={() => { if (!interactive) return; changePlate(plateRef.current.filter((_, i) => i !== slot)); setFeedback('idle'); sfx.tap() }}>
            <WordArt word={food} />
          </button>)}
        </div>
      </section>
      <div className="restaurant__menu" role="group" aria-label={text('食物架，每次拖一份', 'Food shelf. Drag one at a time')}>
        {order.options.map((food) => <button type="button" className={'restaurant__food' + (ghost?.food.id === food.id ? ' is-dragging' : '')}
          key={food.id} disabled={!interactive} aria-label={text('添加' + food.zh, 'Add ' + food.text)}
          onPointerDown={(event) => beginDrag(event, food)} onPointerMove={moveDrag} onPointerUp={endDrag}
          onPointerCancel={(event) => { if (drag.current?.pointerId === event.pointerId) clearDrag() }}
          onLostPointerCapture={(event) => { if (drag.current?.pointerId === event.pointerId) clearDrag() }}
          onClick={(event) => { if (event.detail === 0) addFood(food) }}>
          <WordArt word={food} />
          <span className="restaurant__food-hint">{text('拖一份', 'Drag one')}</span>
        </button>)}
      </div>
      <div className="restaurant__controls">
        <BigButton variant="soft" icon="🔊" disabled={paused || phase === 'eating'} onClick={() => { unlock(); sayPhrase(order.sentence) }}>{text('再听一遍', 'Hear again')}</BigButton>
        {phase === 'served'
          ? <BigButton variant="primary" icon={index + 1 >= orders.length ? '🏆' : '➡️'} disabled={paused} onClick={next}>{text(index + 1 >= orders.length ? '完成营业' : '下一位顾客', index + 1 >= orders.length ? 'Finish' : 'Next customer')}</BigButton>
          : <BigButton variant="primary" icon="🍽️" disabled={!interactive} onClick={serve}>{text(phase === 'eating' ? '正在吃……' : '上菜', phase === 'eating' ? 'Eating…' : 'Serve')}</BigButton>}
      </div>
      <p className="restaurant__feedback" role="status">{phase === 'playing' ? messages[feedback] : phase === 'served' ? text('这份订单完成啦！', 'Order complete!') : ''}</p>
    </div>
    {ghost && createPortal(<div className="restaurant__drag-preview" ref={ghostElement} aria-hidden="true"
      style={{ transform: 'translate(' + (ghost.x - 38) + 'px, ' + (ghost.y - 38) + 'px)' }}>
      <WordArt word={ghost.food} />
    </div>, document.body)}
  </GameScreen>
}
