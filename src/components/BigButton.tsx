/**
 * 大按钮（SPEC 4.3 / 4.4）
 *
 * 统一「≥ 64×64 触控目标 + 点击有 tap 音 + 按下缩放」这三件事，
 * 避免每个页面各写一遍 <button className="btn ...">。
 *
 * 用原生 <button>：键盘可达、一次点击只触发一个 click 事件，
 * 多指同时按同一个按钮不会产生额外的激活。
 */

import type { ReactNode } from 'react'
import { useSfx } from '../hooks/useSfx'

interface Props {
  onClick?: () => void
  children: ReactNode
  /** primary = 主行动（珊瑚色）；soft / surface = 次要 */
  variant?: 'primary' | 'surface' | 'soft'
  /** 图标 emoji，自动加 aria-hidden（含义由文字和 ariaLabel 承载） */
  icon?: string
  disabled?: boolean
  /** 覆盖默认的可读文本；文字本身不足以说明用途时填 */
  ariaLabel?: string
  className?: string
}

export function BigButton({
  onClick,
  children,
  variant = 'surface',
  icon,
  disabled,
  ariaLabel,
  className = '',
}: Props) {
  const sfx = useSfx()

  const handleClick = () => {
    if (disabled) return
    sfx.tap()
    onClick?.()
  }

  return (
    <button
      className={`btn btn--${variant} ${className}`}
      onClick={handleClick}
      disabled={disabled}
      aria-label={ariaLabel}
      type="button"
    >
      {icon && (
        <span className="emoji" aria-hidden="true">
          {icon}
        </span>
      )}
      <span>{children}</span>
    </button>
  )
}
