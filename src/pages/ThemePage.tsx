/**
 * 主题页（SPEC 7.2）
 *
 * 顶部氛围色区块 + 进度 + Learn / Listen / Memory / Bubbles / Picture Speak 五个入口。
 */

import './ThemePage.css'
import { getTheme } from '../content'
import { navigate } from '../router'
import { useApp } from '../store/AppContext'
import { getThemeProgress } from '../store/progress'
import { BackButton } from '../components/BackButton'
import { StarCounter } from '../components/StarCounter'
import { Mascot } from '../components/Mascot/Mascot'
import { useSfx } from '../hooks/useSfx'
import { NotFound } from './NotFound'

interface Props {
  themeId: string
}

interface Activity {
  key: string
  emoji: string
  title: string
  zh: string
  path?: string
  meta?: string
}

export function ThemePage({ themeId }: Props) {
  const theme = getTheme(themeId)
  const { progress, settings } = useApp()
  const sfx = useSfx()

  if (!theme) return <NotFound />

  const tp = getThemeProgress(progress, theme.id)

  const activities: Activity[] = [
    {
      key: 'learn',
      emoji: '📖',
      title: 'Learn',
      zh: '学单词',
      path: `/theme/${theme.id}/learn`,
      meta: `${tp.learned.length}/${theme.words.length}`,
    },
    {
      key: 'listen',
      emoji: '👂',
      title: 'Listen & Pick',
      zh: '听音选图',
      path: `/theme/${theme.id}/game/listen`,
      // 最佳成绩用星星表示（SPEC 7.2）
      meta: tp.best.listen ? `最好 ${tp.best.listen}/8` : undefined,
    },
    {
      key: 'memory', emoji: '🃏', title: 'Memory', zh: '记忆翻牌',
      path: `/theme/${theme.id}/game/memory`,
      meta: tp.best.memory !== undefined ? `已完成 · 最多 ${tp.best.memory} 对` : undefined,
    },
    {
      key: 'bubble', emoji: '🫧', title: 'Bubbles', zh: '泡泡射击',
      path: `/theme/${theme.id}/game/bubble`,
      meta: tp.best.bubble !== undefined ? `最好 ${tp.best.bubble}/10` : undefined,
    },
    {
      key: 'speak', emoji: '🗣️', title: 'Picture Speak', zh: '看图开口',
      path: `/theme/${theme.id}/game/speak`,
    },
    ...(theme.id === 'food' ? [{
      key: 'restaurant', emoji: '👾', title: 'Monster Restaurant', zh: '怪兽餐厅',
      path: `/theme/${theme.id}/game/restaurant`,
    }] : []),
  ]

  const open = (path: string) => {
    sfx.tap()
    navigate(path)
  }

  return (
    <main className="page page-enter theme-page">
      <header className="page-header">
        <BackButton to="/" icon="home" />
        <div className="page-header__spacer" />
        <StarCounter stars={progress.stars} />
      </header>

      <div className="page__body">
        <section
          className="theme-hero"
          style={{ ['--theme-tint' as string]: `var(${theme.tint})` }}
        >
          <span className="emoji theme-hero__emoji" aria-hidden="true">
            {theme.emoji}
          </span>
          <h1 className="theme-hero__name">
            {theme.title}
            {settings.showZh && <span className="theme-hero__zh">{theme.zh}</span>}
          </h1>
          <p
            className="theme-hero__progress"
            aria-label={`已学 ${tp.learned.length} 个，共 ${theme.words.length} 个`}
          >
            <b>
              {tp.learned.length}/{theme.words.length}
            </b>
            已学单词
          </p>
        </section>

        <nav className="activities" aria-label="活动">
          {activities.map((a) =>
            a.path ? (
              <button
                key={a.key}
                className="activity"
                onClick={() => open(a.path!)}
                aria-label={`${a.title} ${a.zh}`}
              >
                <span className="emoji activity__emoji" aria-hidden="true">
                  {a.emoji}
                </span>
                <span className="activity__title">{a.title}</span>
                {settings.showZh && <span className="activity__zh">{a.zh}</span>}
                {a.meta && <span className="activity__meta">{a.meta}</span>}
              </button>
            ) : (
              <div key={a.key} className="activity activity--soon">
                <span className="emoji activity__emoji" aria-hidden="true">
                  {a.emoji}
                </span>
                <span className="activity__title">{a.title}</span>
                {settings.showZh && <span className="activity__zh">{a.zh}</span>}
                <span className="activity__meta">敬请期待</span>
              </div>
            ),
          )}
        </nav>

        <div className="theme-page__mascot">
          <Mascot showZh={settings.showZh} />
        </div>
      </div>
    </main>
  )
}
