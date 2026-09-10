/**
 * 奖励庆祝层（SPEC 7.8）
 *
 * 获得贴纸/徽章时全屏浅色遮罩 + 放大旋转登场 + celebrate 音 + TTS 台词。
 * 孩子点任意位置或「好」按钮关闭；也会在 4 秒后自动关闭（不困住孩子）。
 */

import { useEffect, useRef } from 'react'

import './RewardOverlay.css'
import { Badge } from './Badge'
import { BigButton } from './BigButton'
import { getTheme } from '../content'
import { pickPhrase, themeCompletePhrase } from '../content/phrases'
import { useApp } from '../store/AppContext'
import { useSfx } from '../hooks/useSfx'
import { useVoice } from '../hooks/useVoice'
import { burstCelebrate, clearConfetti } from './Confetti'

/** 自动关闭时间：足够看清，又不会让孩子等太久 */
const AUTO_CLOSE_MS = 4200

export function RewardOverlay() {
  const { reward, clearReward, settings } = useApp()
  const sfx = useSfx()
  const { sayPhrase } = useVoice()
  const announced = useRef<string | null>(null)

  // 用内容做 key，避免同一批奖励重复播音效
  const key = reward ? `${reward.stickers.join()}|${reward.badges.join()}` : null

  useEffect(() => {
    if (!reward || !key) return
    if (announced.current === key) return
    announced.current = key

    sfx.sticker()
    burstCelebrate()

    // 徽章优先播「完成主题」的专属台词
    if (reward.badges.length > 0) {
      sayPhrase(themeCompletePhrase(reward.badges[0]!).en)
    } else {
      sayPhrase(pickPhrase('sticker').en)
    }

    const t = window.setTimeout(() => {
      clearConfetti()
      clearReward()
    }, AUTO_CLOSE_MS)

    return () => window.clearTimeout(t)
  }, [reward, key, sfx, sayPhrase, clearReward])

  if (!reward) return null

  const badgeThemes = reward.badges.map(getTheme).filter(Boolean)
  const hasBadge = badgeThemes.length > 0

  /*
    先算好这一次要显示的文案再渲染：pickPhrase 是随机的，
    直接在 JSX 里调用会让英文和中文两行取到不同的台词。
  */
  const line = hasBadge ? themeCompletePhrase(badgeThemes[0]!.id) : pickPhrase('sticker')

  const close = () => {
    clearConfetti()
    clearReward()
  }

  return (
    <div
      className="reward"
      role="dialog"
      aria-modal="true"
      aria-label={hasBadge ? '完成主题' : '获得贴纸'}
      onClick={close}
    >
      <h2 className="reward__title">{line.en}</h2>
      {settings.showZh && <p className="reward__zh">{line.zh}</p>}

      <div className="reward__items">
        {badgeThemes.map((theme) => (
          <div
            key={theme!.id}
            className="reward__badge"
            style={{ ['--badge-tint' as string]: `var(${theme!.tint})` }}
          >
            <Badge theme={theme!} />
          </div>
        ))}

        {reward.stickers.map((emoji, i) => (
          <span
            key={emoji}
            className="emoji reward__sticker"
            role="img"
            aria-label="贴纸"
            // 多张时依次登场，不要一起弹出来
            style={{ animationDelay: `${i * 180}ms` }}
          >
            {emoji}
          </span>
        ))}
      </div>

      <div className="reward__actions">
        <BigButton variant="primary" icon="👍" onClick={close}>
          好
        </BigButton>
      </div>
    </div>
  )
}
