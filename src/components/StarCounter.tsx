/**
 * 星星计数（SPEC 7.1）：数字变动有滚动动画。
 */

import { useEffect, useRef, useState } from 'react'
import './StarCounter.css'

export function StarCounter({ stars }: { stars: number }) {
  const [bump, setBump] = useState(false)
  const prev = useRef(stars)

  useEffect(() => {
    if (stars === prev.current) return
    prev.current = stars
    setBump(true)
    const t = window.setTimeout(() => setBump(false), 420)
    return () => window.clearTimeout(t)
  }, [stars])

  return (
    <div className="star-counter" aria-label={`星星 ${stars} 颗`}>
      <span className="emoji star-counter__icon" aria-hidden="true">
        ⭐
      </span>
      <span className={`star-counter__num ${bump ? 'is-bump' : ''}`}>{stars}</span>
    </div>
  )
}
