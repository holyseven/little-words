/**
 * Momo —— 陪伴角色的内联 SVG（SPEC 7.7 / 9）
 *
 * 一只圆润的小熊。扁平、2–4 色，配色全部取自 tokens.css 的强调色，
 * 所以夜间模式下会自动跟着变暗，不需要第二份图形。
 *
 * 分组说明（供 Mascot.css 里的状态动画使用）：
 *   .momo__body  身体（呼吸、跳跃）
 *   .momo__arm-* 手臂（happy 时举起）
 *   .momo__head  头（encourage 时点头）
 *   .momo__eyes  睁眼（眨眼时纵向压扁）
 *   .momo__eyes-closed  闭眼横线（sleepy 时显示）
 */

export function Momo({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`momo ${className}`}
      viewBox="0 0 120 130"
      role="img"
      aria-label="小熊 Momo"
      focusable="false"
    >
      <g className="momo__body">
        {/* 脚 */}
        <ellipse cx="45" cy="119" rx="13" ry="9" fill="var(--momo-accent)" />
        <ellipse cx="75" cy="119" rx="13" ry="9" fill="var(--momo-accent)" />

        {/* 身体 */}
        <path
          d="M60 62c-19 0-30 14-30 32 0 15 13 22 30 22s30-7 30-22c0-18-11-32-30-32z"
          fill="var(--momo-body)"
        />
        {/* 肚兜（浅色，让身体有层次） */}
        <ellipse cx="60" cy="99" rx="17" ry="15" fill="var(--momo-face)" opacity="0.75" />

        {/* 手臂：单独分组，happy 时举起 */}
        <g className="momo__arm momo__arm--left">
          <ellipse cx="30" cy="84" rx="10" ry="13" fill="var(--momo-body)" />
        </g>
        <g className="momo__arm momo__arm--right">
          <ellipse cx="90" cy="84" rx="10" ry="13" fill="var(--momo-body)" />
        </g>

        <g className="momo__head">
          {/* 耳朵 */}
          <circle cx="27" cy="30" r="14" fill="var(--momo-body)" />
          <circle cx="93" cy="30" r="14" fill="var(--momo-body)" />
          <circle cx="27" cy="30" r="7" fill="var(--momo-accent)" />
          <circle cx="93" cy="30" r="7" fill="var(--momo-accent)" />

          {/* 头 */}
          <circle cx="60" cy="42" r="33" fill="var(--momo-body)" />

          {/* 口鼻区 */}
          <ellipse cx="60" cy="53" rx="19" ry="15" fill="var(--momo-face)" />

          {/* 眼睛（睁） */}
          <g className="momo__eyes">
            <ellipse cx="48" cy="38" rx="4.2" ry="5.2" fill="var(--momo-ink)" />
            <ellipse cx="72" cy="38" rx="4.2" ry="5.2" fill="var(--momo-ink)" />
            {/* 高光让眼神更柔和 */}
            <circle cx="49.4" cy="36.2" r="1.5" fill="var(--momo-face)" />
            <circle cx="73.4" cy="36.2" r="1.5" fill="var(--momo-face)" />
          </g>

          {/* 眼睛（闭）—— sleepy 时显示 */}
          <g className="momo__eyes-closed">
            <path
              d="M43.5 39q4.5 4 9 0"
              stroke="var(--momo-ink)"
              strokeWidth="2.6"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M67.5 39q4.5 4 9 0"
              stroke="var(--momo-ink)"
              strokeWidth="2.6"
              strokeLinecap="round"
              fill="none"
            />
          </g>

          {/* 鼻子 */}
          <ellipse cx="60" cy="49" rx="5" ry="3.8" fill="var(--momo-ink)" />

          {/* 嘴：微笑 */}
          <path
            d="M60 53v3.5M60 56.5q-6 5-10 0M60 56.5q6 5 10 0"
            stroke="var(--momo-ink)"
            strokeWidth="2.4"
            strokeLinecap="round"
            fill="none"
          />

          {/* 腮红 */}
          <ellipse cx="34" cy="50" rx="6" ry="4" fill="var(--momo-accent)" opacity="0.55" />
          <ellipse cx="86" cy="50" rx="6" ry="4" fill="var(--momo-accent)" opacity="0.55" />
        </g>
      </g>

      {/* z z z —— sleepy 时显示（M4 的晚安页会用到） */}
      <g className="momo__zzz" aria-hidden="true">
        <text x="92" y="24" fill="var(--text-muted)" fontSize="14" fontWeight="700">
          z
        </text>
        <text x="102" y="14" fill="var(--text-muted)" fontSize="11" fontWeight="700">
          z
        </text>
      </g>
    </svg>
  )
}
