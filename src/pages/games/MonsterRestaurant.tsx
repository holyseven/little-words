/**
 * 怪兽餐厅：顾客点餐，孩子说出食物名称后把它送上餐盘。
 * 麦克风输入只在内存中送给本机识别器，不保存录音。
 */

import { useEffect, useRef, useState } from 'react'

import './MonsterRestaurant.css'
import { getTheme } from '../../content'
import type { Word } from '../../content/types'
import { WordArt } from '../../content/svg/WordArt'
import { GameIntro, GameResult, GameScreen } from '../../components/GameScreen'
import { BigButton } from '../../components/BigButton'
import { InlineWordRepeat, type InlineWordRepeatHandle } from '../../components/InlineWordRepeat'
import { burstCelebrate, burstSmall, clearConfetti } from '../../components/Confetti'
import { useApp } from '../../store/AppContext'
import { useAudioUnlocked } from '../../hooks/useAudioUnlocked'
import { useSfx } from '../../hooks/useSfx'
import { useVoice } from '../../hooks/useVoice'
import { useGameProgress } from '../../hooks/useGameProgress'
import { shuffle } from '../../logic/pickWords'
import { NotFound } from '../NotFound'

const ORDER_COUNT = 6

export function MonsterRestaurant({ themeId }: { themeId: string }) {
  const theme = getTheme(themeId)
  const { settings, reward, addStars } = useApp()
  const { unlock } = useAudioUnlocked()
  const { sayPhrase, sayWord, stop } = useVoice()
  const sfx = useSfx()
  const { recordWord } = useGameProgress(themeId)
  const repeat = useRef<InlineWordRepeatHandle>(null)
  const askedFor = useRef(-1)
  const score = useRef(0)
  const settled = useRef(false)
  const [phase, setPhase] = useState<'start' | 'playing' | 'done'>('start')
  const [orders, setOrders] = useState<Word[]>([])
  const [index, setIndex] = useState(0)
  const [feedback, setFeedback] = useState<'idle' | 'wrong' | 'served'>('idle')

  const order = orders[index]

  useEffect(() => () => { repeat.current?.cancel(); stop(); clearConfetti() }, [stop])

  useEffect(() => {
    if (phase !== 'playing' || !order || feedback === 'served' || reward || askedFor.current === index) return
    askedFor.current = index
    const timer = window.setTimeout(() => sayPhrase(`I want ${order.text}, please.`), 280)
    return () => window.clearTimeout(timer)
  }, [phase, order, index, feedback, reward, sayPhrase])

  if (!theme || theme.id !== 'food') return <NotFound />

  const start = () => {
    unlock()
    stop()
    const next = shuffle(theme.words).slice(0, Math.min(ORDER_COUNT, theme.words.length))
    setOrders(next)
    setIndex(0)
    setFeedback('idle')
    askedFor.current = -1
    score.current = 0
    settled.current = false
    setPhase('playing')
  }

  const serve = () => {
    if (!order || settled.current || phase !== 'playing') return
    settled.current = true
    setFeedback('served')
    score.current += 1
    recordWord(order.id, 'correct')
    addStars(1)
    const effect = Math.floor(Math.random() * 3)
    if (effect === 0) { sfx.correct(); burstSmall() }
    else if (effect === 1) { sfx.pop(); burstSmall() }
    else { sfx.celebrate(); burstCelebrate() }
  }

  const next = () => {
    repeat.current?.cancel()
    clearConfetti()
    if (index + 1 >= orders.length) {
      stop()
      addStars(5)
      setPhase('done')
      return
    }
    setIndex((value) => value + 1)
    setFeedback('idle')
    settled.current = false
  }

  if (phase === 'start') {
    return <GameScreen themeId={theme.id} label={settings.showZh ? '怪兽餐厅' : 'Monster Restaurant'} className="restaurant">
      <GameIntro icon="👾" title="Monster Restaurant" description="Listen to the order, then say the food." zh="听听小怪兽要吃什么，再说出食物名称" start={start} />
    </GameScreen>
  }

  if (phase === 'done') {
    return <GameScreen themeId={theme.id} label={settings.showZh ? '怪兽餐厅 · 完成' : 'Monster Restaurant · Done'} className="restaurant">
      <GameResult themeId={theme.id} stars={score.current + 5} summary={`${score.current} orders served!`} zh={`送上 ${score.current} 份食物，完成一局再得 5 颗星`} restart={start} />
    </GameScreen>
  }

  if (!order) return <NotFound />

  return <GameScreen themeId={theme.id} label={`${settings.showZh ? '怪兽餐厅' : 'Monster Restaurant'} · ${index + 1}/${orders.length}`} className="restaurant">
    <div className="page__body restaurant__body">
      <p className="restaurant__instruction">{settings.showZh ? '小怪兽饿啦，听听它想吃什么' : 'The monster is hungry. Listen to its order!'}</p>
      <section className={`restaurant__counter ${feedback === 'wrong' ? 'is-wrong' : ''} ${feedback === 'served' ? 'is-served' : ''}`} aria-live="polite">
        <div className={`restaurant__monster ${feedback === 'served' ? 'is-happy' : ''}`} aria-label="小怪兽">{feedback === 'served' ? '😋' : '👾'}</div>
        <div className="restaurant__bubble">{feedback === 'served' ? (settings.showZh ? '好吃！谢谢你！' : 'Yummy! Thank you!') : (settings.showZh ? '我想吃这个！' : 'I want this!')}</div>
        <div className="restaurant__plate" aria-label={feedback === 'served' ? order.text : '订单食物'}>
          <WordArt word={order} />
        </div>
        <span className="restaurant__table" aria-hidden="true">🍽️</span>
      </section>

      <div className="restaurant__controls">
        {feedback !== 'served' && (
          <BigButton variant="soft" icon="🔊" onClick={() => { unlock(); sayWord(order) }}>
            {settings.showZh ? '听提示' : 'Hear hint'}
          </BigButton>
        )}
        <InlineWordRepeat
          key={order.id}
          ref={repeat}
          word={order.text}
          showZh={settings.showZh}
          onBeforeStart={() => { unlock(); stop(); setFeedback('idle'); settled.current = false }}
          onSuccess={serve}
          onFailure={() => { settled.current = false; setFeedback('wrong') }}
          buttonText={settings.showZh ? '喂给它' : 'Feed it'}
        />
        {feedback === 'served' && (
          <BigButton variant="primary" icon={index + 1 >= orders.length ? '🏆' : '➡️'} onClick={next}>
            {settings.showZh ? (index + 1 >= orders.length ? '完成订单' : '下一单') : (index + 1 >= orders.length ? 'Finish' : 'Next order')}
          </BigButton>
        )}
      </div>
    </div>
  </GameScreen>
}
