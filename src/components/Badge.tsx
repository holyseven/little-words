/**
 * 徽章（SPEC 7.8）：主题 emoji + 圆形底 + 缎带 SVG。
 * 圆形底用主题氛围色，缎带用 butter 色。
 */

import type { Theme } from '../content/types'

interface Props {
  theme: Theme
  className?: string
}

export function Badge({ theme, className = '' }: Props) {
  return (
    <div className={`badge ${className}`}>
      <svg viewBox="0 0 120 150" role="img" aria-label={`${theme.title} 徽章`} focusable="false">
        {/* 缎带（在圆盘后面，先画） */}
        <path d="M38 96 L26 146 L47 133 L60 146 L60 100 Z" fill="var(--coral)" />
        <path d="M82 96 L94 146 L73 133 L60 146 L60 100 Z" fill="var(--butter)" />

        {/* 齿轮状外框：低饱和金色 */}
        <circle cx="60" cy="58" r="52" fill="var(--butter)" opacity="0.55" />
        <circle cx="60" cy="58" r="46" fill="var(--butter)" />

        {/* 内圈用主题氛围色 */}
        <circle cx="60" cy="58" r="38" fill="var(--badge-tint, var(--surface-2))" />
        <circle
          cx="60"
          cy="58"
          r="38"
          fill="none"
          stroke="rgba(255,255,255,0.55)"
          strokeWidth="2"
        />

        {/* 主题 emoji */}
        <text x="60" y="58" textAnchor="middle" dominantBaseline="central" fontSize="42">
          {theme.emoji}
        </text>

        {/* 高光 */}
        <ellipse
          cx="44"
          cy="32"
          rx="14"
          ry="8"
          fill="rgba(255,255,255,0.35)"
          transform="rotate(-25 44 32)"
        />
      </svg>
    </div>
  )
}
