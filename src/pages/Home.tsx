/**
 * 首页：关卡地图（SPEC 7.1）
 *
 * 八个主题站点 + 奖励、今日任务与家长门入口。
 */

import { useEffect, useRef, useState } from 'react'

import './Home.css'
import { themes } from '../content'
import { navigate } from '../router'
import { useApp } from '../store/AppContext'
import { getThemeProgress } from '../store/progress'
import { stationState } from '../logic/rewards'
import { StarCounter } from '../components/StarCounter'
import { BigButton } from '../components/BigButton'
import { Badge } from '../components/Badge'
import { Mascot, type MascotHandle } from '../components/Mascot/Mascot'
import { useSfx } from '../hooks/useSfx'
import { useAudioUnlocked } from '../hooks/useAudioUnlocked'
import { pickPhrase } from '../content/phrases'
import { ParentGate } from '../components/ParentGate'
import './Daily.css'
import { CourseHome } from './Course'

/** 站点在地图上的位置：x 为 0–100 的横向百分比，y 为像素 */
const STATION_POS = [
  { x: 28, y: 92 },
  { x: 68, y: 232 },
  { x: 30, y: 372 },
  { x: 70, y: 512 },
  { x: 32, y: 652 },
  { x: 68, y: 792 },
  { x: 30, y: 932 },
  { x: 62, y: 1072 },
] as const

const TOTAL_STATIONS = STATION_POS.length

/**
 * 地图画布高度 = 最后一个站点 + 站点自身下半部分和文字 + 底部留白。
 * 留白保证最后一个站点不会被右下角的角色压住。
 */
const MAP_HEIGHT = STATION_POS[TOTAL_STATIONS - 1]!.y + 260

/** 用 Catmull-Rom 转三次贝塞尔，画一条经过所有站点的平滑弯路 */
function smoothPath(points: readonly { x: number; y: number }[]): string {
  if (points.length < 2) return ''

  let d = `M ${points[0]!.x} ${points[0]!.y}`

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]!
    const p1 = points[i]!
    const p2 = points[i + 1]!
    const p3 = points[i + 2] ?? p2

    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6

    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x} ${p2.y}`
  }

  return d
}

const PATH_D = smoothPath(STATION_POS)

export function Home() {
  const [section, setSection] = useState<'course' | 'words'>(() => {
    try { return sessionStorage.getItem('little-words-home') === 'words' ? 'words' : 'course' } catch { return 'course' }
  })
  const { progress, settings, authorizeParent } = useApp()
  const sfx = useSfx()
  const { unlocked, unlock } = useAudioUnlocked()
  const mascot = useRef<MascotHandle>(null)
  const greeted = useRef(false)
  /** 排队中的打招呼；用户先点了角色或「点我开始」时要取消，避免说两遍 */
  const greetTimer = useRef<number>()

  // 进入首页打招呼（SPEC 7.1）。必须等音频解锁，否则 iOS 上会静默失败。
  useEffect(() => {
    if (!unlocked || greeted.current) return
    greeted.current = true

    // 等页面淡入结束再说话，气泡不会和转场动画抢镜
    greetTimer.current = window.setTimeout(() => {
      mascot.current?.say(pickPhrase('greet'), 'happy')
    }, 420)

    return () => window.clearTimeout(greetTimer.current)
  }, [unlocked])

  const openTheme = (themeId: string) => {
    sfx.tap()
    navigate(`/theme/${themeId}`)
  }

  /** 点锁住的关卡：只给一声轻柔提示，不弹窗、不训斥（SPEC 4.2 零挫败） */
  const tapLocked = () => {
    sfx.tap()
    mascot.current?.sayRandom('wrong', 'encourage')
  }

  return (
    <main className="page page-enter home">
      <header className="home__top">
        <ParentGate onPass={() => { authorizeParent(); navigate('/parent') }} />
        <h1 className="home__title">
          Little Words
          {settings.showZh && <span className="home__title-zh">小小单词</span>}
        </h1>
        <div className="page-header__spacer" />
        <button
          className="icon-btn"
          onClick={() => {
            sfx.tap()
            navigate('/stickers')
          }}
          aria-label="贴纸册"
          title="贴纸册"
        >
          <span className="emoji" aria-hidden="true">
            🗂️
          </span>
        </button>
        <StarCounter stars={progress.stars} />
      </header>

      <button className="daily-home" onClick={() => { sfx.tap(); navigate('/daily') }} aria-label={`今日任务，完成 ${progress.daily.done.length} 个，共 3 个`}><span className="emoji" aria-hidden="true">🌱</span><b>{settings.showZh ? '今日小任务' : 'Today’s goals'}</b><span className="daily-home__dots" aria-hidden="true">{progress.daily.tasks.map((task) => <i key={task.id} className={progress.daily.done.includes(task.id) ? 'is-done' : ''} />)}</span></button>

      <div className="course-tabs" role="group" aria-label="选择学习内容">{(['course', 'words'] as const).map((tab) => <button className="btn" key={tab} aria-pressed={section === tab} onClick={() => { sfx.tap(); setSection(tab); try { sessionStorage.setItem('little-words-home', tab) } catch { /* 隐私模式仍可切换。 */ } }}>{tab === 'course' ? (settings.showZh ? '📖 课本同步' : '📖 Textbook') : (settings.showZh ? '🌳 单词乐园' : '🌳 Word garden')}</button>)}</div>

      {section === 'course' ? <div className="home__course-scroll"><CourseHome /></div> : <div className="map">
        <div className="map__inner" style={{ height: MAP_HEIGHT }}>
          <svg
            className="map__path"
            viewBox={`0 0 100 ${MAP_HEIGHT}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d={PATH_D}
              fill="none"
              stroke="var(--border)"
              strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray="1 22"
              /* 关键：路径被非等比拉伸，非缩放描边才不会变形 */
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {themes.map((theme, i) => {
            const pos = STATION_POS[i]
            if (!pos) return null

            const style = { left: `${pos.x}%`, top: `${pos.y}px` }
            const tp = getThemeProgress(progress, theme.id)
            const state = stationState(themes, i, progress, settings.unlockAll)

            const label =
              state === 'locked'
                ? `${theme.title} ${theme.zh}，先完成上一关才能打开`
                : `${theme.title} ${theme.zh}，已学 ${tp.learned.length} / ${theme.words.length} 个单词`

            return (
              <button
                key={theme.id}
                className={`station station--${state}`}
                style={{ ...style, ['--station-tint' as string]: `var(${theme.tint})` }}
                onClick={() => (state === 'locked' ? tapLocked() : openTheme(theme.id))}
                aria-label={label}
              >
                <span className="station__disc">
                  {state === 'locked' ? (
                    <span className="emoji" aria-hidden="true">
                      🔒
                    </span>
                  ) : (
                    <span className="emoji" aria-hidden="true">
                      {theme.emoji}
                    </span>
                  )}
                  {state === 'completed' && (
                    <span className="station__badge">
                      <Badge theme={theme} />
                    </span>
                  )}
                </span>
                <span className="station__label">
                  {theme.title}
                  {settings.showZh && <span className="station__label-zh">{theme.zh}</span>}
                </span>
                {state !== 'locked' && (
                  <span className="station__stars">
                    {tp.learned.length}/{theme.words.length}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>}

      <div className="home__mascot">
        <Mascot
          ref={mascot}
          showZh={settings.showZh}
          // 用户点角色时也算「已打过招呼」，取消排队中的自动问候
          onSay={() => {
            greeted.current = true
            window.clearTimeout(greetTimer.current)
          }}
        />
      </div>

      {/* 音频未解锁：给一个醒目按钮，而不是静默失败（SPEC 10.2） */}
      {!unlocked && (
        <BigButton
          variant="primary"
          className="audio-hint"
          icon="▶"
          onClick={() => {
            unlock()
            // 立刻说，不走 effect 的 420ms 延迟（onSay 会顺手取消它）
            mascot.current?.say(pickPhrase('greet'), 'happy')
          }}
        >
          点我开始
        </BigButton>
      )}

      <p className="visually-hidden">
        共 {themes.length} 个关卡，已完成 {progress.badges.length} 个。
      </p>
    </main>
  )
}
