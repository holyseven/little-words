/**
 * 首页：课本和主题单词卡片（SPEC 7.1）
 *
 * 课本主题和更多主题分区展示，共用卡片样式与进度。
 */

import { useEffect, useRef, useState } from 'react'

import './Home.css'
import { themes } from '../content'
import type { Theme } from '../content/types'
import { navigate } from '../router'
import { useApp } from '../store/AppContext'
import { getThemeProgress } from '../store/progress'
import { stationState } from '../logic/rewards'
import { StarCounter } from '../components/StarCounter'
import { BigButton } from '../components/BigButton'
import { Mascot, type MascotHandle } from '../components/Mascot/Mascot'
import { useSfx } from '../hooks/useSfx'
import { useAudioUnlocked } from '../hooks/useAudioUnlocked'
import { pickPhrase } from '../content/phrases'
import { ParentGate } from '../components/ParentGate'
import './Daily.css'
import { CourseHome } from './Course'
import { courseWordGardens } from '../content/courseWordGardens'

const textbookThemeIds = new Set(courseWordGardens.map(({ theme }) => theme.id))
const extraThemes = themes.filter((theme) => !textbookThemeIds.has(theme.id))

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

  const dialogueEntry = (
    <button className="home-dialogues" onClick={() => { sfx.tap(); navigate('/dialogues') }}>
      <span className="emoji" aria-hidden="true">💬</span>
      <span>
        <strong>{settings.showZh ? '开口小对话' : 'Little conversations'}</strong>
        <small>{settings.showZh ? '和 Momo 打招呼、聊家人、说文具' : 'Say hello and talk about family and school things with Momo.'}</small>
      </span>
      <span className="home-dialogues__arrow" aria-hidden="true">→</span>
    </button>
  )

  const themeCard = (theme: Theme, unitNumber?: number) => {
    const tp = getThemeProgress(progress, theme.id)
    const learned = theme.words.filter((word) => tp.learned.includes(word.id)).length
    // 课本主题始终可进入；更多主题沿用原始顺序的解锁进度。
    const state = unitNumber !== undefined
      ? (progress.badges.includes(theme.id) ? 'completed' : 'available')
      : stationState(themes, themes.indexOf(theme), progress, settings.unlockAll)
    const progressLabel = settings.showZh
      ? `已学 ${learned}/${theme.words.length}`
      : `${learned}/${theme.words.length} learned`
    const previousTheme = themes[themes.indexOf(theme) - 1]
    const statusLabel = state === 'completed'
      ? (settings.showZh ? '已完成' : 'Complete')
      : state === 'locked' ? (settings.showZh ? `完成${previousTheme?.zh ?? '上一主题'}后解锁` : `Complete ${previousTheme?.title ?? 'the previous theme'}`) : ''

    return (
      <button
        key={theme.id}
        className={`word-gardens__card word-gardens__card--${state}`}
        style={{ ['--garden-tint' as string]: `var(${theme.tint})` }}
        onClick={() => state === 'locked' ? tapLocked() : openTheme(theme.id)}
        aria-disabled={state === 'locked' || undefined}
        aria-label={`${theme.title}${settings.showZh ? ` ${theme.zh}` : ''}, ${progressLabel}${statusLabel ? `, ${statusLabel}` : ''}`}
      >
        <span className="emoji" aria-hidden="true">{theme.emoji}</span>
        <span className="word-gardens__card-text">
          {unitNumber !== undefined && <small>Unit {unitNumber}</small>}
          <strong>{theme.title}</strong>
          {settings.showZh && <span>{theme.zh}</span>}
          <small>{progressLabel}</small>
          {statusLabel && <small className="word-gardens__status">{state === 'completed' ? '✓' : '🔒'} {statusLabel}</small>}
        </span>
      </button>
    )
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

      <div className="course-tabs" role="group" aria-label="选择学习内容">
        {(['course', 'words'] as const).map((tab) => <button className="btn" key={tab} aria-pressed={section === tab} onClick={() => { sfx.tap(); setSection(tab); try { sessionStorage.setItem('little-words-home', tab) } catch { /* 隐私模式仍可切换。 */ } }}>{tab === 'course' ? (settings.showZh ? '📖 课本同步' : '📖 Textbook') : (settings.showZh ? '🌳 单词乐园' : '🌳 Word garden')}</button>)}
        <button className="btn course-tabs__games" onClick={() => { sfx.tap(); navigate('/games') }} aria-label={settings.showZh ? '游戏乐园' : 'Game park'}>{settings.showZh ? '🎡 游戏乐园' : '🎡 Game park'}</button>
      </div>

      {section === 'course' ? (
        <div className="home__course-scroll">
          {dialogueEntry}
          <CourseHome />
        </div>
      ) : (
        <div className="home__words-scroll">
          {dialogueEntry}
          <section className="word-gardens" aria-labelledby="textbook-gardens-title">
            <h2 id="textbook-gardens-title">{settings.showZh ? '跟课本一起学' : 'Learn with your textbook'}</h2>
            <p>{settings.showZh ? '选一个主题，听单词、跟读、玩游戏。' : 'Pick a theme to listen, speak and play.'}</p>
            <div className="word-gardens__grid">
              {courseWordGardens.map(({ unit, theme }) => themeCard(theme, unit.number))}
            </div>
          </section>
          <section className="word-gardens" aria-labelledby="extra-gardens-title">
            <h2 id="extra-gardens-title">{settings.showZh ? '更多主题' : 'More themes'}</h2>
            <p>{settings.showZh ? '认识更多身边的英语单词。' : 'Discover more words from your world.'}</p>
            <div className="word-gardens__grid">
              {extraThemes.map((theme) => themeCard(theme))}
            </div>
          </section>
        </div>
      )}

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
