/**
 * App —— 路由分发 + 全局 Provider。
 * 音频解锁监听装在 main.tsx（需要在 React 之前就绑上 window 事件）。
 */

import { useEffect } from 'react'

import { navigate, useRoute } from './router'
import { AppProvider, useApp } from './store/AppContext'
import { Home } from './pages/Home'
import { ThemePage } from './pages/ThemePage'
import { Learn } from './pages/Learn'
import { Stickers } from './pages/Stickers'
import { ListenPick } from './pages/games/ListenPick'
import { MemoryFlip } from './pages/games/MemoryFlip'
import { BubblePop } from './pages/games/BubblePop'
import { PictureSpeak } from './pages/games/PictureSpeak'
import { MonsterRestaurant } from './pages/games/MonsterRestaurant'
import { NotFound } from './pages/NotFound'
import { RewardOverlay } from './components/RewardOverlay'
import { stopClip } from './audio/clips'
import { clearConfetti } from './components/Confetti'
import { Parent } from './pages/Parent'
import { DailyDone } from './pages/DailyDone'
import { GoodNight } from './pages/GoodNight'
import { dailyLimitReached } from './logic/daily'
import { useDailyTimer } from './hooks/useDailyTimer'
import { CourseUnitPage, CourseExtras } from './pages/Course'
import { CoursePlayer } from './pages/CoursePlayer'
import { CourseRepeat } from './pages/CourseRepeat'

function Routes() {
  const route = useRoute()
  const { ready, progress, settings, reward, dailyCelebration, clearDailyCelebration, parentAuthorized, revokeParent, dataEpoch, updateProgress } = useApp()
  const resting = ready && dailyLimitReached(progress, settings.dailyLimitMin)
  useDailyTimer(ready && route.name !== 'parent' && !resting)
  useEffect(() => {
    if (route.name !== 'parent') revokeParent()
  }, [route.name, revokeParent])
  useEffect(() => {
    const visibility = () => {
      stopClip(); clearConfetti()
      if (document.hidden) revokeParent()
      else updateProgress((p) => p)
    }
    document.addEventListener('visibilitychange', visibility)
    const pageHide = () => { stopClip(); clearConfetti(); revokeParent() }
    window.addEventListener('pagehide', pageHide)
    // 休息页跨天时也自动恢复；不把休息时间计入学习时长。
    const timer = window.setInterval(() => updateProgress((p) => p), 10000)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pagehide', pageHide) }
  }, [revokeParent, updateProgress])
  useEffect(() => {
    if (!dailyCelebration || reward || resting || route.name === 'parent') return
    clearDailyCelebration(); navigate('/daily')
  }, [dailyCelebration, reward, resting, route.name, clearDailyCelebration])

  // 切页时立刻停掉上一页的人声和纸屑，避免叠加到下一页
  useEffect(() => {
    return () => {
      stopClip()
      clearConfetti()
    }
  }, [route.name, 'themeId' in route ? route.themeId : '', 'game' in route ? route.game : ''])

  // IndexedDB 读取很快，但读完前渲染会闪一次 0 星；用一个同色占位挡住
  if (!ready) return <div className="page" aria-busy="true" />
  if (resting && route.name !== 'parent') return <GoodNight />

  switch (route.name) {
    case 'home':
      return <Home />
    case 'theme':
      return <ThemePage themeId={route.themeId} />
    case 'learn':
      return <Learn key={`${dataEpoch}:${route.themeId}:${route.wordId ?? ''}`} themeId={route.themeId} startWordId={route.wordId} />
    case 'word-repeat':
      return <Learn key={`${dataEpoch}:${route.themeId}:${route.wordId}`} themeId={route.themeId} startWordId={route.wordId} />
    case 'game':
      if (route.game === 'listen') return <ListenPick key={`${dataEpoch}:${route.themeId}`} themeId={route.themeId} />
      if (route.game === 'memory') return <MemoryFlip key={`memory:${route.themeId}`} themeId={route.themeId} />
      if (route.game === 'speak') return <PictureSpeak key={`speak:${route.themeId}`} themeId={route.themeId} />
      if (route.game === 'restaurant') return <MonsterRestaurant key={`restaurant:${route.themeId}`} themeId={route.themeId} />
      return <BubblePop key={`bubble:${route.themeId}`} themeId={route.themeId} />
    case 'stickers':
      return <Stickers />
    case 'daily':
      return <DailyDone key={dataEpoch} />
    case 'parent':
      return <Parent key={parentAuthorized ? 'authorized' : 'gate'} />
    case 'course-unit':
      return <CourseUnitPage unitId={route.unitId} />
    case 'course-extras':
      return <CourseExtras />
    case 'course-player':
      return <CoursePlayer key={`${dataEpoch}:${route.assetId}`} assetId={route.assetId} />
    case 'course-repeat':
      return <CourseRepeat key={`${dataEpoch}:${route.assetId}`} assetId={route.assetId} />
    case 'notfound':
    default:
      return <NotFound />
  }
}

export function App() {
  return (
    <AppProvider>
      <Routes />
      {/* 奖励庆祝层：跨页面存在，得星/完成主题时自动弹出 */}
      <RewardOverlay />
    </AppProvider>
  )
}
