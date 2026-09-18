import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { BigButton } from '../../components/BigButton'
import { burstSmall, clearConfetti } from '../../components/Confetti'
import { GameResult, GameScreen } from '../../components/GameScreen'
import { getTheme } from '../../content'
import { WordArt } from '../../content/svg/WordArt'
import treasurePrompts from '../../content/treasurePrompts.json'
import { useAudioUnlocked } from '../../hooks/useAudioUnlocked'
import { useGameProgress } from '../../hooks/useGameProgress'
import { usePageVisible } from '../../hooks/useGameLoop'
import { useSfx } from '../../hooks/useSfx'
import { useVoice } from '../../hooks/useVoice'
import { buildTreasureRound, checkTreasureChoice, type TreasureQuestion } from '../../logic/treasure'
import { useApp } from '../../store/AppContext'
import { flushProgress } from '../../store/progress'
import { NotFound } from '../NotFound'
import './EnglishTreasure.css'

type Phase = 'start' | 'searching' | 'found' | 'done'
const SPOTS = [
  { x: 18, y: 32 }, { x: 50, y: 30 }, { x: 82, y: 34 },
  { x: 18, y: 66 }, { x: 49, y: 65 }, { x: 80, y: 65 },
] as const

function Forest() {
  return <svg className="treasure__landscape" viewBox="0 0 1000 560" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <path fill="#e9f4eb" d="M0 0h1000v560H0z" />
    <circle fill="#fff0b9" cx="705" cy="60" r="35" />
    <path fill="#fffdf4" d="M386 60c0-19 28-25 38-11 19-31 57-19 58 5 34-6 45 29 15 30H391c-20-1-23-21-5-24Z" />
    <path fill="#c5ddbd" d="M0 202Q170 85 361 197T735 182T1000 190V560H0Z" />
    <path fill="#d6e5b8" d="M0 289Q162 195 350 285T661 248T1000 303V560H0Z" />
    <path fill="#e5d5a6" d="M345 192Q435 252 380 287T283 373Q225 426 443 451T697 560H527Q548 508 329 486T211 355Q246 319 302 298T279 222Z" />
    <path fill="#abd7d3" d="M1010 256Q817 252 790 357T655 436Q525 455 556 560H689Q631 491 750 481T873 374Q883 310 1010 342Z" />
    <path d="M657 415Q743 382 829 400L837 442Q754 423 667 456Z" fill="#cba783" stroke="#a57e62" strokeWidth="6" strokeLinejoin="round" />
    <path d="m684 410 6 39m20-44 7 38m20-39 7 36m21-36 7 35m19-34 8 36" stroke="#a57e62" strokeWidth="4" />
    <g fill="#adbd90"><ellipse cx="177" cy="225" rx="70" ry="13" /><ellipse cx="511" cy="213" rx="72" ry="13" /><ellipse cx="819" cy="236" rx="71" ry="13" /><ellipse cx="178" cy="415" rx="69" ry="13" /><ellipse cx="488" cy="410" rx="70" ry="13" /></g>
    <g fill="#a28b68"><path d="M76 97h26v185H76zM912 107h23v193h-23zM523 12h17v142h-17z" /></g>
    <g fill="#9bc39b"><circle cx="80" cy="101" r="62" /><circle cx="127" cy="106" r="44" /><circle cx="57" cy="153" r="53" /><circle cx="116" cy="158" r="45" /><circle cx="909" cy="105" r="60" /><circle cx="966" cy="129" r="51" /><circle cx="912" cy="171" r="54" /><circle cx="528" cy="30" r="48" /></g>
    <g fill="#b6d2a2"><circle cx="57" cy="112" r="30" /><circle cx="114" cy="85" r="29" /><circle cx="907" cy="86" r="34" /><circle cx="951" cy="147" r="29" /></g>
    <g fill="#a1bd85"><path d="M2 347q7-64 49-26 26-48 62-7 28-28 40 33Z" /><path d="M883 472q15-46 45-20 14-60 51-26 19-27 32 9v53Z" /><path d="M304 115q9-45 40-20 28-29 44 20Z" /></g>
    <g stroke="#a2bd80" strokeWidth="5" fill="none" strokeLinecap="round"><path d="m52 442 5-20 8 17 12-15M337 496l5-21 8 17 12-15M933 355l5-18 8 17 12-15M579 333l5-18 8 17 12-15" /></g>
    <g fill="#e7bdac"><circle cx="56" cy="418" r="6" /><circle cx="940" cy="333" r="6" /><circle cx="356" cy="470" r="6" /></g>
    <path d="m17 508 35-27 34 27-32 11Z" fill="#b6c5b8" /><path d="m401 138 25-18 29 19-25 10Z" fill="#b6c5b8" />
  </svg>
}

function Chest({ open = false }: { open?: boolean }) {
  return <svg className={'treasure__chest-art' + (open ? ' is-open' : '')} viewBox="0 0 160 135" aria-hidden="true" focusable="false">
    <ellipse cx="80" cy="126" rx="61" ry="7" fill="#4b5b3526" />
    <g className="treasure__chest-treasure" fill="#e7b959" stroke="#fff2a6" strokeWidth="3"><path d="m53 61 15-18 14 18-14 24Z" /><path d="m85 56 16-21 17 21-17 27Z" /><path d="m107 73 11-14 13 14-13 18Z" /></g>
    <path d="M24 65h112v47q0 10-12 10H36q-12 0-12-10Z" fill="#c99766" stroke="#896947" strokeWidth="5" />
    <path d="M39 69v50m82-50v50" stroke="#edcc7b" strokeWidth="10" />
    <g className="treasure__chest-lid"><path d="M22 72V58q0-26 26-26h64q26 0 26 26v14Z" fill="#d8b079" stroke="#896947" strokeWidth="5" /><path d="M40 69V51q0-10 7-16m73 34V51q0-10-7-16" stroke="#f0d68f" strokeWidth="10" fill="none" /><path d="M23 72h114" stroke="#896947" strokeWidth="5" /></g>
    <rect x="67" y="65" width="26" height="30" rx="6" fill="#f4d982" stroke="#a88548" strokeWidth="4" /><circle cx="80" cy="77" r="4" fill="#896947" />
  </svg>
}

export function EnglishTreasure({ themeId, backTo }: { themeId: string; backTo?: string }) {
  const theme = getTheme(themeId)
  const { settings, reward, addStars } = useApp()
  const { unlock } = useAudioUnlocked()
  const { sayPhrase, stop, speaking } = useVoice()
  const { recordWord } = useGameProgress(themeId)
  const sfx = useSfx()
  const visible = usePageVisible()
  const paused = !visible || !!reward
  const phaseRef = useRef<Phase>('start')
  const announced = useRef<TreasureQuestion | null>(null)
  const score = useRef(0)
  const attempt = useRef(0)
  const [phase, setPhase] = useState<Phase>('start')
  const [round, setRound] = useState<TreasureQuestion[]>([])
  const [index, setIndex] = useState(0)
  const [wrong, setWrong] = useState<{ id: string; attempt: number } | null>(null)
  const question = round[index]
  const text = (zh: string, en: string) => settings.showZh ? zh : en
  const promptFor = (wordId: string, fallback: string) => (treasurePrompts as Record<string, string>)[wordId] ?? 'Find ' + fallback + '!'

  const changePhase = (next: Phase) => { phaseRef.current = next; setPhase(next) }

  useEffect(() => {
    if (!paused) return
    announced.current = null
    stop()
    clearConfetti()
  }, [paused, stop])

  useEffect(() => {
    if (phase !== 'searching' || paused || !question || announced.current === question) return
    const timer = window.setTimeout(() => {
      announced.current = question
      sayPhrase((treasurePrompts as Record<string, string>)[question.target.id] ?? 'Find ' + question.target.text + '!')
    }, 250)
    return () => window.clearTimeout(timer)
  }, [phase, paused, question, sayPhrase])

  useEffect(() => () => clearConfetti(), [])

  if (!theme) return <NotFound />

  const start = () => {
    if (phaseRef.current !== 'start' && phaseRef.current !== 'done') return
    if (paused || document.hidden) return
    const questions = buildTreasureRound(theme.words)
    if (questions.length === 0) return
    unlock()
    stop()
    clearConfetti()
    announced.current = null
    score.current = 0
    setWrong(null)
    setIndex(0)
    setRound(questions)
    changePhase('searching')
  }

  const choose = (wordId: string) => {
    if (phaseRef.current !== 'searching' || paused || document.hidden || !question) return
    if (!checkTreasureChoice(question, wordId)) {
      attempt.current += 1
      setWrong({ id: wordId, attempt: attempt.current })
      sfx.wrong()
      return
    }
    // Lock synchronously before awarding; rapid taps and reward overlays cannot score twice.
    changePhase('found')
    stop()
    setWrong(null)
    score.current += 1
    recordWord(question.target.id, 'correct')
    addStars(1)
    sfx.correct()
    burstSmall()
  }

  const next = () => {
    if (phaseRef.current !== 'found' || paused || document.hidden) return
    stop()
    clearConfetti()
    if (index + 1 === round.length) {
      changePhase('done')
      addStars(5)
      void flushProgress()
      return
    }
    setIndex((current) => current + 1)
    setWrong(null)
    changePhase('searching')
  }

  const hearAgain = () => {
    if (phaseRef.current !== 'searching' || paused || document.hidden || !question) return
    unlock()
    setWrong(null)
    sayPhrase(promptFor(question.target.id, question.target.text))
  }

  if (phase === 'start') return <GameScreen themeId={themeId} backTo={backTo} label={text('英语寻宝', 'English Treasure')} className="treasure">
    <div className="page__body game__center treasure__intro">
      <div className="treasure__intro-scene" aria-hidden="true"><Forest /><span className="treasure__compass">🧭</span><Chest /></div>
      <h1>{text('英语寻宝', 'English Treasure')}</h1>
      <p className="game__hint">{text('森林里藏着小宝贝，听清线索，把它们找出来！', 'Listen to the clues and find the hidden treasures!')}</p>
      <p>{text('听英语 → 点图片 → 收集宝石', 'Listen → Find the picture → Collect a gem')}</p>
      {new Set(theme.words.map((word) => word.id)).size < 3
        ? <p role="status">{text('这个主题还需要更多图片，请试试其他主题。', 'This theme needs more pictures. Try another theme.')}</p>
        : <BigButton variant="primary" icon="🧭" disabled={paused} onClick={start}>{text('出发寻宝', 'Let’s explore')}</BigButton>}
    </div>
  </GameScreen>

  if (phase === 'done') return <GameScreen themeId={themeId} backTo={backTo} label={text('英语寻宝 · 完成', 'English Treasure · Done')} className="treasure">
    <div className="treasure__finished-chest"><Chest open /></div>
    <GameResult themeId={themeId} backTo={backTo} stars={score.current + 5} summary={score.current + ' treasures found!'} zh={'找到 ' + score.current + ' 件宝贝，宝箱打开啦！'} restart={start} />
  </GameScreen>

  if (!question) return <NotFound />
  const found = phase === 'found'
  const foundSpot = question.spots.find((spot) => spot.word.id === question.target.id)!
  const gems = index + (found ? 1 : 0)

  return <GameScreen themeId={themeId} backTo={backTo} label={text('英语寻宝', 'English Treasure') + ' · ' + (index + 1) + '/' + round.length} className="treasure">
    <div className={'page__body treasure__body' + (paused ? ' is-paused' : '')}>
      <div className="treasure__briefing">
        <span className="treasure__guide" aria-hidden="true">🧭</span>
        <div><strong>{found ? text('找到啦！宝贝进宝箱咯', 'Found it! Into the treasure chest!') : text('听线索，找一找', 'Listen to the clue and find it')}</strong><span>{found ? text('又收集到一颗宝石', 'One more gem collected') : text('点一下森林里的图片', 'Tap a picture in the forest')}</span></div>
        <div className="treasure__gems" aria-label={text('已找到 ' + gems + ' 件，共 ' + round.length + ' 件', gems + ' of ' + round.length + ' treasures found')}>
          {round.map((_, gem) => <span key={gem} className={gem < gems ? 'is-collected' : ''} aria-hidden="true">◆</span>)}
        </div>
      </div>
      <section className={'treasure__map' + (found ? ' is-found' : '')} aria-label={text('寻宝森林', 'Treasure forest')}>
        <Forest />
        <div className="treasure__map-label" aria-hidden="true">✧ {text('小小探险家', 'Little explorer')} ✧</div>
        {question.spots.map((spot) => <button type="button" key={spot.word.id} className={'treasure__object' + (found && spot.word.id === question.target.id ? ' is-collected' : '')}
          style={{ left: SPOTS[spot.position].x + '%', top: SPOTS[spot.position].y + '%' }}
          disabled={paused || found} onClick={() => choose(spot.word.id)} aria-label={spot.word.text}>
          <span key={wrong?.id === spot.word.id ? wrong.attempt : 0} className={'treasure__object-art' + (wrong?.id === spot.word.id ? ' is-wrong' : '')}><WordArt word={spot.word} /></span>
        </button>)}
        <div className="treasure__map-chest"><Chest open={found} /></div>
        {found && <div key={index} className="treasure__flying" aria-hidden="true" style={{ left: SPOTS[foundSpot.position].x + '%', top: SPOTS[foundSpot.position].y + '%' } as CSSProperties}><WordArt word={question.target} /></div>}
      </section>
      <div className="treasure__controls">
        {found ? <BigButton variant="primary" icon={index + 1 === round.length ? '🎁' : '➡️'} disabled={paused} onClick={next}>{text(index + 1 === round.length ? '打开宝箱' : '找下一件', index + 1 === round.length ? 'Open the chest' : 'Next treasure')}</BigButton>
          : <BigButton variant="soft" icon="🔊" disabled={paused} onClick={hearAgain}>{text(speaking ? '正在听线索…' : '再听一遍', speaking ? 'Listening to the clue…' : 'Hear again')}</BigButton>}
      </div>
      <p className="treasure__feedback" role="status">{wrong ? text('再听听，继续找！', 'Listen again and keep looking!') : found ? text('太棒啦！⭐ +1', 'Great job! ⭐ +1') : text('慢慢找，不用着急', 'Take your time. There is no rush.')}</p>
    </div>
  </GameScreen>
}
