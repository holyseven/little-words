/**
 * svg 字段 → 是否有渲染实现。
 *
 * 单独成一个无 JSX 的模块：content/index.ts 在校验词表时要用它，
 * 而 index.ts 会被 Node 里跑的单测直接 import，不该牵进 React 组件。
 * 新增 SVG 类型时，这里和 WordArt.tsx 的 renderSvg 要一起改。
 */

export function hasSvgImpl(svgId: string): boolean {
  return svgId.startsWith('color-') || svgId.startsWith('num-') || svgId === 'hair'
}
