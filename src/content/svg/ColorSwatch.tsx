/**
 * Colors 主题的图形（SPEC 8.2）：用 SVG 圆形色块渲染，不用 emoji。
 * black / white 加描边，否则在深色/浅色背景上会看不见边界。
 *
 * 颜色比 tokens.css 的强调色更饱和一些 —— 这里颜色本身就是学习内容，
 * 必须能被准确辨认；但仍避开刺眼的纯色（如 #FF0000），并且只出现在
 * 卡片中央的小面积区域，不违反 SPEC 5.2 的大面积低饱和要求。
 */

export interface ColorDef {
  id: string
  fill: string
  /** 需要描边的浅色/深色 */
  stroke?: string
}

export const COLOR_SWATCHES: Record<string, ColorDef> = {
  'color-red': { id: 'color-red', fill: '#E15241' },
  'color-blue': { id: 'color-blue', fill: '#4A82C4' },
  'color-yellow': { id: 'color-yellow', fill: '#F0C33C' },
  'color-green': { id: 'color-green', fill: '#5BA45B' },
  'color-orange': { id: 'color-orange', fill: '#E8873C' },
  'color-purple': { id: 'color-purple', fill: '#8E63B5' },
  'color-pink': { id: 'color-pink', fill: '#E88BAE' },
  'color-brown': { id: 'color-brown', fill: '#966543' },
  // 纯黑纯白在护眼配色里是禁忌，这里用接近的深灰/米白并加描边
  'color-black': { id: 'color-black', fill: '#332F2A', stroke: '#8A8378' },
  'color-white': { id: 'color-white', fill: '#FBF8F2', stroke: '#9A9287' },
}

/** 圆形色块。尺寸由外层 CSS 控制（width: 100%） */
export function ColorSwatch({ svgId, label }: { svgId: string; label: string }) {
  const def = COLOR_SWATCHES[svgId]
  if (!def) return null

  return (
    <svg viewBox="0 0 100 100" role="img" aria-label={label} focusable="false">
      {/* 底部柔和阴影，让色块有厚度感而不是贴在纸上 */}
      <ellipse cx="50" cy="88" rx="30" ry="5" fill="rgba(80,60,30,0.10)" />
      <circle
        cx="50"
        cy="48"
        r="38"
        fill={def.fill}
        stroke={def.stroke ?? 'rgba(0,0,0,0.08)'}
        strokeWidth={def.stroke ? 3 : 1.5}
      />
      {/* 高光：让色块看起来圆润有光泽 */}
      <ellipse cx="38" cy="33" rx="12" ry="8" fill="rgba(255,255,255,0.32)" transform="rotate(-25 38 33)" />
    </svg>
  )
}
