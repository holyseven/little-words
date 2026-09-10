import { useEffect, useRef } from 'react'
import { useApp } from '../store/AppContext'
import { Mascot, type MascotHandle } from '../components/Mascot/Mascot'
import { ParentGate } from '../components/ParentGate'
import { BigButton } from '../components/BigButton'
import { useAudioUnlocked } from '../hooks/useAudioUnlocked'
import { flushProgress } from '../store/progress'
import { navigate } from '../router'
import { phrases } from '../content/phrases'
import { usePageVisible } from '../hooks/useGameLoop'

export function GoodNight() {
  const { settings, updateProgress, authorizeParent, reward, clearReward } = useApp()
  const mascot = useRef<MascotHandle>(null)
  const { unlocked, unlock } = useAudioUnlocked()
  const visible = usePageVisible()
  useEffect(() => { if (reward) clearReward() }, [reward, clearReward])
  useEffect(() => {
    if (!unlocked || !visible) return
    const timer = setTimeout(() => mascot.current?.say(phrases.rest[0], 'sleepy'), 320)
    return () => clearTimeout(timer)
  }, [unlocked, visible])
  return <main className="page page-enter goodnight" data-theme="night">
    <header className="page-header"><ParentGate label="家长设置" onPass={() => { authorizeParent(); navigate('/parent') }} /><span>{settings.showZh ? '家长设置' : 'For parents'}</span></header>
    <div className="page__body goodnight-content"><Mascot ref={mascot} mood="sleepy" showZh={settings.showZh} /><h1>Time to rest.</h1><p>See you tomorrow!</p>{settings.showZh && <p>小眼睛休息一下，明天再来玩。</p>}
      {!unlocked && <BigButton icon="🔊" onClick={unlock}>{settings.showZh ? '听听 Momo 说什么' : 'Listen to Momo'}</BigButton>}
      <div className="goodnight-extra"><ParentGate label="再加 10 分钟" onPass={() => { updateProgress((p) => ({ ...p, daily: { ...p.daily, bonusMs: p.daily.bonusMs + 600000 } })); void flushProgress(); navigate('/') }} /><p>{settings.showZh ? '请家长长按，今天再加 10 分钟' : 'Ask a parent for 10 more minutes'}</p></div>
    </div>
  </main>
}
