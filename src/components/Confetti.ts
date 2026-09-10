/**
 * 纸屑（SPEC 5.2 硬性限制）：
 *  - 持续 ≤ 1.5 秒
 *  - 粒子 ≤ 80 个
 *  - 不覆盖全屏中心内容 —— 从两侧下方斜射，中心留空
 *  - prefers-reduced-motion 时完全不放
 *
 * 用 canvas-confetti，canvas 由它自己创建并在结束后销毁。
 */

import confetti from 'canvas-confetti'

/** 低饱和粉彩，取自 tokens.css 的强调色（SPEC 5.1） */
const COLORS = ['#EE9B86', '#9BC49B', '#8FB8DC', '#F2D27E', '#BFAEDC', '#F3C4A6']
let stopTimer: number | undefined
function capDuration(): void {
  clearTimeout(stopTimer)
  stopTimer = window.setTimeout(() => clearConfetti(), 1450)
}

function reducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/**
 * 小范围纸屑：答对时用（SPEC 7.4）。
 * 从左右下角斜向内射，中心内容不被遮挡。
 */
export function burstSmall(): void {
  if (reducedMotion()) return
  clearConfetti()
  capDuration()

  const base = {
    particleCount: 18,
    spread: 55,
    startVelocity: 32,
    gravity: 1.1,
    ticks: 90, // 约 1.4s @60fps
    scalar: 0.9,
    colors: COLORS,
    disableForReducedMotion: true,
    zIndex: 60,
  }

  // 两侧各 18 个，合计 36 —— 远低于 80 的上限
  void confetti({ ...base, angle: 60, origin: { x: 0.08, y: 0.9 } })
  void confetti({ ...base, angle: 120, origin: { x: 0.92, y: 0.9 } })
}

/**
 * 庆祝纸屑：局末 / 完成主题时用。
 * 粒子更多但仍 ≤ 80，且仍从两侧射入。
 */
export function burstCelebrate(): void {
  if (reducedMotion()) return
  clearConfetti()
  capDuration()

  const base = {
    particleCount: 34,
    spread: 70,
    startVelocity: 40,
    gravity: 1,
    ticks: 100, // 约 1.5s
    scalar: 1,
    colors: COLORS,
    disableForReducedMotion: true,
    zIndex: 60,
  }

  void confetti({ ...base, angle: 62, origin: { x: 0.05, y: 0.92 } })
  void confetti({ ...base, angle: 118, origin: { x: 0.95, y: 0.92 } })
}

/** 立刻清掉屏幕上的纸屑（切页时用，避免残留到下一页） */
export function clearConfetti(): void {
  clearTimeout(stopTimer)
  void confetti.reset()
}
