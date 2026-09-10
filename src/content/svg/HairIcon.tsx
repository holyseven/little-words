/**
 * hair（头发）—— emoji 里没有单独表示头发的符号，用内联 SVG 画一个
 * 露出长发的小脸，把视觉重点放在头发上（SPEC 8.2 备注）。
 *
 * 配色取自 tokens.css 的强调色，夜间模式下自动跟随变暗。
 */

export function HairIcon({ label }: { label: string }) {
  return (
    <svg viewBox="0 0 100 110" role="img" aria-label={label} focusable="false">
      {/* 后层长发：视觉主体 */}
      <path
        d="M50 8c-20 0-31 14-31 33 0 14 2 26 4 40 1 8 6 12 10 10 3-2 2-8 1-14-2-11-3-22-3-31h38c0 9-1 20-3 31-1 6-2 12 1 14 4 2 9-2 10-10 2-14 4-26 4-40C81 22 70 8 50 8z"
        fill="var(--momo-accent)"
      />

      {/* 脸 */}
      <ellipse cx="50" cy="52" rx="23" ry="26" fill="var(--momo-body)" />

      {/* 刘海：盖住额头，强调"头发"这个概念 */}
      <path
        d="M27 44c0-16 10-27 23-27s23 11 23 27c-6-9-13-13-23-13s-17 4-23 13z"
        fill="var(--momo-accent)"
      />

      {/* 五官：简单两点一弧，不抢头发的视觉重点 */}
      <ellipse cx="41" cy="52" rx="3.2" ry="4" fill="var(--momo-ink)" />
      <ellipse cx="59" cy="52" rx="3.2" ry="4" fill="var(--momo-ink)" />
      <path
        d="M43 64q7 6 14 0"
        stroke="var(--momo-ink)"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />

      {/* 腮红 */}
      <ellipse cx="32" cy="60" rx="4.5" ry="3" fill="var(--momo-accent)" opacity="0.5" />
      <ellipse cx="68" cy="60" rx="4.5" ry="3" fill="var(--momo-accent)" opacity="0.5" />
    </svg>
  )
}
