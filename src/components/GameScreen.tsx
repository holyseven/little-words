import { useEffect, useRef, type ReactNode } from 'react'
import { BackButton } from './BackButton'
import { StarCounter } from './StarCounter'
import { BigButton } from './BigButton'
import { Mascot, type MascotHandle } from './Mascot/Mascot'
import { burstCelebrate, clearConfetti } from './Confetti'
import { useApp } from '../store/AppContext'
import { useSfx } from '../hooks/useSfx'
import { usePageVisible } from '../hooks/useGameLoop'
import { navigate } from '../router'
import '../pages/games/Games.css'

export function GameScreen({ themeId, label, className = '', children }: {
  themeId: string; label: string; className?: string; children: ReactNode
}) {
  const { progress } = useApp()
  return <main className={`page page-enter game ${className}`}>
    <header className="page-header">
      <BackButton to={`/theme/${themeId}`} icon="back" />
      <span className="game__progress" role="status">{label}</span>
      <div className="page-header__spacer" />
      <StarCounter stars={progress.stars} />
    </header>
    {children}
  </main>
}

export function GameIntro({ icon, title, description, zh, start }: {
  icon: string; title: string; description: string; zh: string; start: () => void
}) {
  const { settings } = useApp()
  return <div className="page__body game__center">
    <span className="emoji game__intro-icon" aria-hidden="true">{icon}</span>
    <h1>{title}</h1>
    <p>{description}</p>
    {settings.showZh && <p className="game__hint">{zh}</p>}
    <BigButton variant="primary" icon="▶" onClick={start}>Start</BigButton>
  </div>
}

export function GameResult({ themeId, stars, summary, zh, restart }: {
  themeId: string; stars: number; summary: string; zh: string; restart: () => void
}) {
  const { settings, reward } = useApp()
  const mascot = useRef<MascotHandle>(null)
  const announced = useRef(false)
  const visible = usePageVisible()
  const sfx = useSfx()
  useEffect(() => {
    if (reward || !visible || announced.current) return
    const timer = window.setTimeout(() => {
      announced.current = true
      sfx.celebrate()
      burstCelebrate()
      mascot.current?.sayRandom('finish', 'happy')
    }, 350)
    return () => window.clearTimeout(timer)
  }, [reward, visible, sfx])
  useEffect(() => () => clearConfetti(), [])
  return <div className="page__body game__center">
    <Mascot ref={mascot} showZh={settings.showZh} />
    <h1>You did it!</h1>
    <p>{summary}</p>
    {settings.showZh && <p className="game__hint">{zh}</p>}
    <p className="game__earned" aria-label={`获得 ${stars} 颗星`}>⭐ +{stars}</p>
    <div className="game__actions">
      <BigButton icon="🔁" onClick={restart}>{settings.showZh ? '再玩一次' : 'Play again'}</BigButton>
      <BigButton variant="primary" icon="🏠" onClick={() => navigate(`/theme/${themeId}`)}>
        {settings.showZh ? '回主题' : 'Back to theme'}
      </BigButton>
    </div>
  </div>
}
