/**
 * 返回按钮（SPEC 5.4 / 11.3）
 * standalone 模式没有浏览器返回，所有非首页页面左上角必须有它。
 */

import { goBack, navigate } from '../router'
import { useSfx } from '../hooks/useSfx'

interface Props {
  /** 指定目标路径则直接跳转；否则退回上一页 */
  to?: string
  /** 🏠 回首页 / ← 返回上一页 */
  icon?: 'home' | 'back'
  label?: string
}

export function BackButton({ to, icon = 'back', label }: Props) {
  const sfx = useSfx()

  const handleClick = () => {
    sfx.tap()
    if (to) navigate(to)
    else goBack()
  }

  const text = label ?? (icon === 'home' ? '回首页' : '返回')

  return (
    <button className="icon-btn" onClick={handleClick} aria-label={text} title={text}>
      <span className="emoji" aria-hidden="true">
        {icon === 'home' ? '🏠' : '←'}
      </span>
    </button>
  )
}
