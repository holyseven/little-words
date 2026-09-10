import { useEffect, useRef, useState } from 'react'
import { useApp } from '../store/AppContext'
import type { DailyTask } from '../store/progress'
import { themes, getTheme } from '../content'
import { WordArt } from '../content/svg/WordArt'
import { navigate } from '../router'
import { BackButton } from '../components/BackButton'
import { StarCounter } from '../components/StarCounter'
import { BigButton } from '../components/BigButton'
import { Mascot, type MascotHandle } from '../components/Mascot/Mascot'
import { burstCelebrate, clearConfetti } from '../components/Confetti'
import { useSfx } from '../hooks/useSfx'
import { useVoice } from '../hooks/useVoice'
import { useAudioUnlocked } from '../hooks/useAudioUnlocked'
import { usePageVisible } from '../hooks/useGameLoop'
import './Daily.css'
import { getCourseAsset, getCourseUnit } from '../content/curriculum'

export function DailyDone() {
  const { progress, settings, reward } = useApp()
  const [review, setReview] = useState<string | null>(null)
  const mascot = useRef<MascotHandle>(null)
  const celebrated = useRef<string | null>(null)
  const { unlock, unlocked } = useAudioUnlocked()
  const visible = usePageVisible()
  const sfx = useSfx()
  const done = progress.daily.rewarded
  useEffect(() => {
    if (!done || reward || !visible || !unlocked || celebrated.current === progress.daily.date) return
    const timer = setTimeout(() => {
      celebrated.current = progress.daily.date
      sfx.celebrate(); burstCelebrate()
      mascot.current?.say({ en: 'See you tomorrow!', zh: '明天见！' }, 'happy')
    }, 350)
    return () => clearTimeout(timer)
  }, [done, reward, visible, unlocked, progress.daily.date, sfx])
  useEffect(() => () => clearConfetti(), [])
  const task = progress.daily.tasks.find((t) => t.id === review)
  if (task && !progress.daily.done.includes(task.id)) return <DailyReview key={`${progress.daily.date}:${task.id}`} task={task} back={() => setReview(null)} />
  const open = (task: DailyTask) => {
    unlock(); sfx.tap()
    if (task.kind === 'course') navigate(`/course/play/${task.assetId}`)
    else if (task.kind === 'review') setReview(task.id)
    else if (task.kind === 'learn') {
      const first = task.wordIds?.find((id) => !task.completedWordIds?.includes(id))
      navigate(`/theme/${task.themeId}/learn${first ? `?word=${encodeURIComponent(first)}` : ''}`)
    } else navigate(`/theme/${task.themeId}/game/${task.kind}`)
  }
  return <main className="page page-enter daily-page">
    <header className="page-header"><BackButton to="/" /><h1>{settings.showZh ? '今日小任务' : 'Today’s little goals'}</h1><div className="page-header__spacer" /><StarCounter stars={progress.stars} /></header>
    <div className="page__body daily-content">
      <div className="daily-mascot"><Mascot ref={mascot} showZh={settings.showZh} /></div>
      <h2>{done ? 'Amazing work!' : 'A little every day.'}</h2>
      {settings.showZh && <p className="game__hint">{done ? '三个任务都完成啦！今天的 10 颗奖励星星已收好。' : '听一听、学一学，一起攒星星。'}</p>}
      {done && <p className="daily-bonus">⭐ +10</p>}
      <div className="daily-tasks">{progress.daily.tasks.map((task) => {
        const complete = progress.daily.done.includes(task.id)
        const theme = task.themeId ? getTheme(task.themeId) : undefined
        const asset = getCourseAsset(task.assetId)
        const unit = getCourseUnit(asset?.unitId ?? undefined)
        const names = { learn: ['📖', `Learn ${task.target} new words`, `学 ${task.target} 个新单词`], review: ['🔊', `Review ${task.target} words`, `复习 ${task.target} 个单词`], listen: ['👂', 'Listen & Pick', '玩一局听音选图'], memory: ['🃏', 'Memory Flip', '玩一局记忆翻牌'], course: [asset?.kind === 'animation' ? '🎬' : '🔊', asset?.kind === 'animation' ? 'Watch & say' : asset?.kind === 'vocabulary-audio' ? 'Listen to the words' : 'Listen to a lesson', `${unit ? `Unit ${unit.number} · ` : ''}${asset?.pageLabel ?? ''} ${asset?.title ?? '课程学习'}`] }
        const [icon, en, zh] = names[task.kind]
        return <button className={`daily-task ${complete ? 'is-complete' : ''}`} key={task.id} onClick={() => open(task)} disabled={complete} aria-label={`${zh}${complete ? '，已完成' : ''}`}>
          <span className="emoji" aria-hidden="true">{complete ? '🌟' : icon}</span><span><b>{en}</b>{settings.showZh && <small>{theme ? `${theme.zh} · ` : ''}{zh}</small>}</span><strong>{task.count ?? 0}/{task.target}</strong>
        </button>
      })}</div>
      <BigButton variant="primary" icon="🏠" onClick={() => navigate('/')}>{settings.showZh ? '回首页，继续学' : 'Back home'}</BigButton>
    </div>
  </main>
}

function DailyReview({ task, back }: { task: DailyTask; back: () => void }) {
  const { settings, recordDaily, updateProgress, reward } = useApp()
  const words = (task.wordIds ?? []).map((id) => themes.flatMap((t) => t.words).find((w) => w.id === id)).filter((w) => w && !task.completedWordIds?.includes(w.id))
  const word = words[0]
  const { unlock } = useAudioUnlocked()
  const { sayWord } = useVoice()
  const [heard, setHeard] = useState<string | null>(null)
  if (!word) return null
  const listen = () => { unlock(); sayWord(word); setHeard(word.id) }
  return <main className="page page-enter daily-page"><header className="page-header"><button className="icon-btn" onClick={back} aria-label="返回今日任务">←</button><h1>{settings.showZh ? '再听一遍' : 'Listen once more'}</h1></header>
    <div className="page__body daily-review"><button className="daily-review-art" onClick={listen} aria-label={`听单词 ${word.text}`}><WordArt word={word} /></button><h2>{word.text}</h2>{settings.showZh && <p>{word.zh}</p>}
      <BigButton icon="🔊" onClick={listen}>{settings.showZh ? '听一听' : 'Listen'}</BigButton>
      <BigButton variant="primary" disabled={heard !== word.id || !!reward} onClick={() => {
        setHeard(null)
        updateProgress((p) => { const stat = p.wordStats[word.id] ?? { seen: 0, correct: 0, wrong: 0, lastSeen: 0 }; return { ...p, wordStats: { ...p.wordStats, [word.id]: { ...stat, seen: stat.seen + 1, lastSeen: Date.now() } } } })
        recordDaily({ kind: 'review', wordId: word.id })
      }}>{settings.showZh ? '我记住了，下一个' : 'I remember!'}</BigButton>
      <p className="game__hint">{task.count ?? 0} / {task.target}</p>
    </div>
  </main>
}
