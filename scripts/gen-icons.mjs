/**
 * 从角色 SVG 生成 PNG 图标（SPEC 9 / 11.1）
 *
 * 输出：
 *   public/favicon.svg
 *   public/icons/icon-192.png
 *   public/icons/icon-512.png
 *   public/icons/maskable-512.png        （角色缩到 60%，留足安全区）
 *   public/icons/apple-touch-icon-180.png（不透明背景，iOS 主屏用）
 *
 * 用 @resvg/resvg-js 渲染（纯 Rust，无 libvips 依赖）。它不认 CSS 变量，
 * 所以这里的颜色写死，与 tokens.css 的 Day 模式取值保持一致。
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = join(root, 'public')
const iconsDir = join(publicDir, 'icons')

// 与 tokens.css Day 模式一致
const BG = '#F6F1E7'
const BODY = '#F3C4A6' // --peach
const ACCENT = '#EE9B86' // --coral
const FACE = '#FDFAF3' // --surface
const INK = '#3B3934' // --text

/** 角色本体，坐标系 120×130，与 Momo.tsx 一致 */
const MOMO_SHAPES = `
  <ellipse cx="45" cy="119" rx="13" ry="9" fill="${ACCENT}"/>
  <ellipse cx="75" cy="119" rx="13" ry="9" fill="${ACCENT}"/>
  <path d="M60 62c-19 0-30 14-30 32 0 15 13 22 30 22s30-7 30-22c0-18-11-32-30-32z" fill="${BODY}"/>
  <ellipse cx="60" cy="99" rx="17" ry="15" fill="${FACE}" opacity="0.75"/>
  <ellipse cx="30" cy="84" rx="10" ry="13" fill="${BODY}"/>
  <ellipse cx="90" cy="84" rx="10" ry="13" fill="${BODY}"/>
  <circle cx="27" cy="30" r="14" fill="${BODY}"/>
  <circle cx="93" cy="30" r="14" fill="${BODY}"/>
  <circle cx="27" cy="30" r="7" fill="${ACCENT}"/>
  <circle cx="93" cy="30" r="7" fill="${ACCENT}"/>
  <circle cx="60" cy="42" r="33" fill="${BODY}"/>
  <ellipse cx="60" cy="53" rx="19" ry="15" fill="${FACE}"/>
  <ellipse cx="48" cy="38" rx="4.2" ry="5.2" fill="${INK}"/>
  <ellipse cx="72" cy="38" rx="4.2" ry="5.2" fill="${INK}"/>
  <circle cx="49.4" cy="36.2" r="1.5" fill="${FACE}"/>
  <circle cx="73.4" cy="36.2" r="1.5" fill="${FACE}"/>
  <ellipse cx="60" cy="49" rx="5" ry="3.8" fill="${INK}"/>
  <path d="M60 53v3.5M60 56.5q-6 5-10 0M60 56.5q6 5 10 0" stroke="${INK}" stroke-width="2.4" stroke-linecap="round" fill="none"/>
  <ellipse cx="34" cy="50" rx="6" ry="4" fill="${ACCENT}" opacity="0.55"/>
  <ellipse cx="86" cy="50" rx="6" ry="4" fill="${ACCENT}" opacity="0.55"/>
`

/**
 * 正方形画布上的角色。
 * 画布 130×130，角色内容 120 宽 → 左右各留 5，避免非等比拉伸变形。
 * scale < 1 时以画布中心 (65,65) 为原点缩小，用于 maskable 安全区。
 */
function momoSquareSvg({ scale = 1, background = BG } = {}) {
  const centered = `<g transform="translate(5 0)">${MOMO_SHAPES}</g>`
  const scaled =
    scale === 1
      ? centered
      : `<g transform="translate(65 65) scale(${scale}) translate(-65 -65)">${centered}</g>`

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130 130" width="130" height="130">
  <rect width="130" height="130" fill="${background}"/>
  ${scaled}
</svg>`
}

async function renderPng(svg, size, outPath) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    background: BG,
    font: { loadSystemFonts: false },
  })
  await writeFile(outPath, resvg.render().asPng())
}

async function main() {
  await mkdir(iconsDir, { recursive: true })

  // favicon：矢量，浏览器标签用
  await writeFile(join(publicDir, 'favicon.svg'), momoSquareSvg(), 'utf8')

  const full = momoSquareSvg()

  await renderPng(full, 192, join(iconsDir, 'icon-192.png'))
  await renderPng(full, 512, join(iconsDir, 'icon-512.png'))

  // maskable：角色缩到 60%，系统裁圆角/圆形都不会切到头
  await renderPng(momoSquareSvg({ scale: 0.6 }), 512, join(iconsDir, 'maskable-512.png'))

  // apple-touch-icon：iOS 自己加圆角，背景必须不透明
  await renderPng(momoSquareSvg({ scale: 0.86 }), 180, join(iconsDir, 'apple-touch-icon-180.png'))

  console.log('[icons] 已生成 favicon.svg + 4 个 PNG 图标')
}

main().catch((err) => {
  console.error('[icons] 生成失败', err)
  process.exit(1)
})
