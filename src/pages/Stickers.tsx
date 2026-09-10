/**
 * 贴纸册 + 徽章墙（SPEC 7.8 / 6）
 *
 * 已获得的贴纸显示 emoji，未获得的是虚线空位；点贴纸有弹跳 + tap 音。
 * 徽章墙在下方，未获得的显示灰色轮廓，让孩子知道还有几个可以拿。
 */

import { useState } from 'react'

import './Stickers.css'
import { STARS_PER_STICKER, STICKER_POOL } from '../content/stickers'
import { themes } from '../content'
import { useApp } from '../store/AppContext'
import { stickersEarnedFor } from '../logic/rewards'
import { BackButton } from '../components/BackButton'
import { StarCounter } from '../components/StarCounter'
import { Badge } from '../components/Badge'
import { useSfx } from '../hooks/useSfx'

export function Stickers() {
  const { progress, settings } = useApp()
  const sfx = useSfx()
  const [bounced, setBounced] = useState<string | null>(null)

  const owned = progress.stickers
  // 还差多少颗星拿下一张
  const nextAt = (stickersEarnedFor(progress.stars) + 1) * STARS_PER_STICKER
  const toNext = Math.max(0, nextAt - progress.stars)
  const poolFull = owned.length >= STICKER_POOL.length

  const tapSticker = (emoji: string) => {
    sfx.tap()
    setBounced(emoji)
    window.setTimeout(() => setBounced((b) => (b === emoji ? null : b)), 480)
  }

  return (
    <main className="page page-enter">
      <header className="page-header">
        <BackButton to="/" icon="home" />
        <div className="page-header__spacer" />
        <StarCounter stars={progress.stars} />
      </header>

      <div className="page__body">
        <p className="stickers__intro">
          {poolFull
            ? `全部 ${STICKER_POOL.length} 张贴纸都收集齐了！`
            : `已收集 ${owned.length} / ${STICKER_POOL.length} 张，再得 ${toNext} 颗星可以拿下一张`}
        </p>

        <section className="stickers__section">
          <h2 className="stickers__heading">
            Stickers
            {settings.showZh && <span className="stickers__heading-zh">贴纸册</span>}
          </h2>

          <div className="sticker-grid">
            {STICKER_POOL.map((emoji) => {
              const has = owned.includes(emoji)

              if (!has) {
                return (
                  <div key={emoji} className="sticker sticker--empty" aria-hidden="true">
                    <span />
                  </div>
                )
              }

              return (
                <button
                  key={emoji}
                  className={`sticker emoji ${bounced === emoji ? 'is-bounce' : ''}`}
                  onClick={() => tapSticker(emoji)}
                  aria-label="贴纸"
                >
                  {emoji}
                </button>
              )
            })}
          </div>
        </section>

        <section className="stickers__section">
          <h2 className="stickers__heading">
            Badges
            {settings.showZh && <span className="stickers__heading-zh">徽章墙</span>}
          </h2>

          <div className="badge-wall">
            {themes.map((theme) => {
              const has = progress.badges.includes(theme.id)
              return (
                <div
                  key={theme.id}
                  className={`badge-slot ${has ? '' : 'badge-slot--empty'}`}
                  style={{ ['--badge-tint' as string]: `var(${theme.tint})` }}
                >
                  <Badge theme={theme} />
                  <span className="badge-slot__label">{theme.title}</span>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </main>
  )
}
