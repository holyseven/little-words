/**
 * Numbers 主题的图形（SPEC 8.2）：大数字 + 对应数量的小圆点。
 * 圆点让不识字的孩子也能靠数数对上单词。
 *
 * 布局要点：圆点按紧凑网格排列，并根据实际占用的行列数计算包围盒，
 * 再与数字一起水平居中 —— 否则 "1"（一个点）和 "10"（十个点）
 * 的视觉重心会差很远，看起来像两套不同的设计。
 */

/** 每个数字用几列排（超过则换行），选让图形接近方形的排法 */
const COLUMNS: Record<number, number> = {
  1: 1,
  2: 2,
  3: 3,
  4: 2,
  5: 3,
  6: 3,
  7: 4,
  8: 4,
  9: 3,
  10: 5,
}

const DOT_R = 9
const DOT_GAP = 8

/** svg 字段 'num-3' → 3 */
function numOf(svgId: string): number | null {
  const m = /^num-(\d+)$/.exec(svgId)
  if (!m) return null
  const n = Number(m[1])
  return n >= 1 && n <= 10 ? n : null
}

interface Dot {
  cx: number
  cy: number
}

/** 生成圆点坐标（相对自身包围盒左上角）与包围盒尺寸 */
function layoutDots(n: number): { dots: Dot[]; width: number; height: number } {
  const cols = COLUMNS[n] ?? Math.ceil(Math.sqrt(n))
  const rows = Math.ceil(n / cols)
  const step = DOT_R * 2 + DOT_GAP

  const dots: Dot[] = []
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols)
    const col = i % cols
    // 最后一行不满时居中，避免左对齐的空缺看起来像少了一个
    const inRow = row === rows - 1 ? n - row * cols : cols
    const rowOffset = ((cols - inRow) * step) / 2

    dots.push({
      cx: DOT_R + rowOffset + col * step,
      cy: DOT_R + row * step,
    })
  }

  return {
    dots,
    width: cols * step - DOT_GAP,
    height: rows * step - DOT_GAP,
  }
}

export function NumberCard({ svgId, label }: { svgId: string; label: string }) {
  const n = numOf(svgId)
  if (n === null) return null

  const { dots, width: dotsW, height: dotsH } = layoutDots(n)

  // 数字块的固定尺寸（按 74px 字号目测的视觉宽度）
  const numW = n === 10 ? 78 : 46
  const gap = 20

  const totalW = numW + gap + dotsW
  const totalH = Math.max(84, dotsH)
  const cy = totalH / 2

  return (
    <svg
      viewBox={`0 0 ${totalW} ${totalH}`}
      role="img"
      aria-label={label}
      focusable="false"
      // 内容宽高比差异大，等比缩放并居中
      preserveAspectRatio="xMidYMid meet"
    >
      <text
        x={numW / 2}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="74"
        fontWeight="700"
        fill="var(--sky)"
        fontFamily="ui-rounded, 'SF Pro Rounded', -apple-system, system-ui, sans-serif"
      >
        {n}
      </text>

      <g transform={`translate(${numW + gap} ${cy - dotsH / 2})`}>
        {dots.map((d, i) => (
          <circle key={i} cx={d.cx} cy={d.cy} r={DOT_R} fill="var(--coral)" />
        ))}
      </g>
    </svg>
  )
}
