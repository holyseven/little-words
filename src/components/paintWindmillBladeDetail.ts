import {
  DETAIL_TEXTURE, detailContact, detailExitPoint, detailIncomingPoint,
  detailSourcePoint, detailTurningEnd, type BladeDetailFrame, type BladeTexturePoint,
} from '../logic/windmillBladeDetail'
import { projectScenePoint } from '../logic/windmillScene'
import type { BladePoint3 } from '../logic/windmillGeometry'
export { detailDebug } from '../logic/windmillBladeDetail'

interface Primitive { depth: number; paint: (ctx: CanvasRenderingContext2D, opacity: number) => void }
const BLUE = '#4b97ad'
const ORANGE = '#c57936'
const ORIGIN = { x: 195, y: 77 }
const SCALE = .52
const textures = new WeakMap<HTMLImageElement, HTMLCanvasElement>()
const clamp = (p: number) => Math.min(1, Math.max(0, p))
const ease = (time: number, start: number, duration: number) => {
  const p = clamp((time - start) / duration)
  return p * p * (3 - 2 * p)
}
const project = (point: BladePoint3) => {
  const p = projectScenePoint(point)
  return { x: ORIGIN.x + p.x * SCALE, y: ORIGIN.y + p.y * SCALE, depth: p.depth }
}

/** Keep the original paper grain, silhouette, highlights and fold. This is a
 * runtime mask of the same local asset used by the large front-view wheel.
 */
function originalRedTexture(image: HTMLImageElement): HTMLCanvasElement | null {
  const cached = textures.get(image)
  if (cached) return cached
  if (!image.complete || !image.naturalWidth) return null
  const canvas = document.createElement('canvas')
  canvas.width = DETAIL_TEXTURE.right - DETAIL_TEXTURE.left
  canvas.height = DETAIL_TEXTURE.bottom - DETAIL_TEXTURE.top
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(image, DETAIL_TEXTURE.left, DETAIL_TEXTURE.top, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height)
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
  for (let i = 0; i < pixels.data.length; i += 4) {
    const red = pixels.data[i]
    const green = pixels.data[i + 1]
    const blue = pixels.data[i + 2]
    const max = Math.max(red, green, blue)
    const min = Math.min(red, green, blue)
    const range = max - min
    const hue = range && red === max ? (green - blue) / range : 2
    // Red paper has hue≈.18 in this six-sector scale; yellow starts above.5.
    if (red !== max || range / Math.max(1, max) < .2 || hue < -.18 || hue > .36) pixels.data[i + 3] = 0
  }
  ctx.putImageData(pixels, 0, 0)
  textures.set(image, canvas)
  return canvas
}

function textureTriangle(items: Primitive[], texture: HTMLCanvasElement, vertices: [BladeTexturePoint, BladeTexturePoint, BladeTexturePoint]) {
  const dest = vertices.map(project)
  const a = vertices[0]
  const b = vertices[1]
  const c = vertices[2]
  const determinant = (b.u - a.u) * (c.v - a.v) - (c.u - a.u) * (b.v - a.v)
  if (Math.abs(determinant) < 1e-8) return
  const m11 = ((dest[1].x - dest[0].x) * (c.v - a.v) - (dest[2].x - dest[0].x) * (b.v - a.v)) / determinant
  const m12 = ((dest[1].y - dest[0].y) * (c.v - a.v) - (dest[2].y - dest[0].y) * (b.v - a.v)) / determinant
  const m21 = ((dest[2].x - dest[0].x) * (b.u - a.u) - (dest[1].x - dest[0].x) * (c.u - a.u)) / determinant
  const m22 = ((dest[2].y - dest[0].y) * (b.u - a.u) - (dest[1].y - dest[0].y) * (c.u - a.u)) / determinant
  const tx = dest[0].x - m11 * a.u - m21 * a.v
  const ty = dest[0].y - m12 * a.u - m22 * a.v
  items.push({ depth: dest.reduce((sum, p) => sum + p.depth, 0) / 3, paint: (ctx, opacity) => {
    ctx.save()
    ctx.globalAlpha = opacity
    // A fraction of a pixel of overlap prevents antialias seams between patches.
    const center = { x: (dest[0].x + dest[1].x + dest[2].x) / 3, y: (dest[0].y + dest[1].y + dest[2].y) / 3 }
    const inflated = dest.map(p => {
      const length = Math.max(1, Math.hypot(p.x - center.x, p.y - center.y))
      return { x: p.x + (p.x - center.x) / length * .65, y: p.y + (p.y - center.y) / length * .65 }
    })
    ctx.beginPath()
    ctx.moveTo(inflated[0].x, inflated[0].y)
    ctx.lineTo(inflated[1].x, inflated[1].y)
    ctx.lineTo(inflated[2].x, inflated[2].y)
    ctx.closePath()
    ctx.clip()
    ctx.transform(m11, m12, m21, m22, tx, ty)
    ctx.drawImage(texture, DETAIL_TEXTURE.left, DETAIL_TEXTURE.top)
    ctx.restore()
  } })
}

function line(items: Primitive[], from: BladePoint3, to: BladePoint3, color: string, width: number, alpha = 1, overlay = false) {
  const a = project(from)
  const b = project(to)
  items.push({ depth: overlay ? 1e6 : (a.depth + b.depth) / 2, paint: (ctx, opacity) => {
    ctx.globalAlpha = alpha * opacity
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  } })
}
function arrow(items: Primitive[], from: BladePoint3, to: BladePoint3, color: string, alpha: number, size: number, overlay = false, strokeWidth?: number) {
  const a = project(from)
  const b = project(to)
  const angle = Math.atan2(b.y - a.y, b.x - a.x)
  items.push({ depth: overlay ? 1e6 : b.depth, paint: (ctx, opacity) => {
    ctx.globalAlpha = alpha * opacity
    ctx.strokeStyle = color
    ctx.lineWidth = strokeWidth ?? (color === ORANGE ? 3 : 2)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(b.x - Math.cos(angle - .55) * size, b.y - Math.sin(angle - .55) * size)
    ctx.lineTo(b.x, b.y)
    ctx.lineTo(b.x - Math.cos(angle + .55) * size, b.y - Math.sin(angle + .55) * size)
    ctx.stroke()
  } })
}
function dot(items: Primitive[], point: BladePoint3, radius: number, color: string, alpha = 1, outline = false) {
  const p = project(point)
  items.push({ depth: p.depth + (outline ? 5 : 0), paint: (ctx, opacity) => {
    ctx.globalAlpha = alpha * opacity
    ctx.fillStyle = color
    ctx.strokeStyle = outline ? '#a47e43' : 'transparent'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2)
    ctx.fill()
    if (outline) ctx.stroke()
  } })
}
function label(ctx: CanvasRenderingContext2D, zh: string, en: string, x: number, y: number, color: string, align: CanvasTextAlign = 'center', alpha = 1) {
  ctx.globalAlpha = alpha
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.lineWidth = 4
  ctx.strokeStyle = '#fff9ed'
  ctx.fillStyle = color
  ctx.font = '600 15px system-ui, sans-serif'
  ctx.strokeText(zh, x, y)
  ctx.fillText(zh, x, y)
  ctx.font = '13px system-ui, sans-serif'
  ctx.strokeText(en, x, y + 16)
  ctx.fillText(en, x, y + 16)
}

/** One original paper leaf, observed at45°; only airflow and the turning
 * component of pressure are annotated, with separate colors and straight force.
 */
export function paintWindmillBladeDetail(ctx: CanvasRenderingContext2D, width: number, height: number, frame: BladeDetailFrame, image: HTMLImageElement): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, width, height)
  const fit = Math.min(width / 390, height / 170)
  ctx.setTransform(fit, 0, 0, fit, (width - 390 * fit) / 2, (height - 170 * fit) / 2)
  const time = Math.max(0, frame.elapsedMs)
  // The first1.5s aligns the front wheel's selected leaf. Reveal the close-up
  // only once that transient full rotation has settled into the lesson pose.
  const sceneAlpha = ease(time, 1_500, 350)
  if (sceneAlpha <= 0) {
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    return
  }
  const items: Primitive[] = []
  const texture = originalRedTexture(image)
  const angle = frame.angle

  // A short rear axle establishes the front/back direction without another wheel.
  for (let index = 0; index < 12; index += 1) {
    const a = { x: 0, y: 0, z: -120 + index * 10 }
    const b = { x: 0, y: 0, z: -110 + index * 10 }
    line(items, a, b, '#b6986a', 4.5)
    line(items, { ...a, y: -1.5 }, { ...b, y: -1.5 }, '#e3cc9f', 1)
  }
  if (texture) {
    const columns = 12
    const rows = 22
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const u = DETAIL_TEXTURE.left + (DETAIL_TEXTURE.right - DETAIL_TEXTURE.left) * column / columns
        const nextU = DETAIL_TEXTURE.left + (DETAIL_TEXTURE.right - DETAIL_TEXTURE.left) * (column + 1) / columns
        const v = DETAIL_TEXTURE.top + (DETAIL_TEXTURE.bottom - DETAIL_TEXTURE.top) * row / rows
        const nextV = DETAIL_TEXTURE.top + (DETAIL_TEXTURE.bottom - DETAIL_TEXTURE.top) * (row + 1) / rows
        const a = detailSourcePoint(u, v, angle)
        const b = detailSourcePoint(nextU, v, angle)
        const c = detailSourcePoint(nextU, nextV, angle)
        const d = detailSourcePoint(u, nextV, angle)
        textureTriangle(items, texture, [a, b, c])
        textureTriangle(items, texture, [a, c, d])
      }
    }
  }
  dot(items, { x: 0, y: 0, z: 4 }, 5.4, '#d3ad58', 1, true)
  dot(items, { x: -1.7, y: -2, z: 8 }, 1.1, '#fff2c8')

  const air = ease(time, 500, 850)
  const deflect = ease(time, 2_500, 550)
  const push = ease(time, 2_700, 650)
  const { point } = detailContact(angle)
  for (let step = 0; step < 26; step += 1) line(items, detailIncomingPoint(angle, step / 26), detailIncomingPoint(angle, (step + 1) / 26), BLUE, 1.7, .58 * air)
  arrow(items, detailIncomingPoint(angle, .86), detailIncomingPoint(angle, 1), BLUE, air, 6)
  if (deflect > 0) {
    for (let step = 0; step < 16; step += 1) line(items, detailExitPoint(angle, step / 16), detailExitPoint(angle, (step + 1) / 16), BLUE, 1.7, .75 * deflect)
    arrow(items, detailExitPoint(angle, .85), detailExitPoint(angle, 1), BLUE, deflect, 5)
  }
  for (let index = 0; index < 6; index += 1) {
    const p = ((time / 3_600 + index / 6) % 1 + 1) % 1
    const onExit = p > .78
    const point = onExit ? detailExitPoint(angle, (p - .78) / .22) : detailIncomingPoint(angle, p / .78)
    const fade = Math.min(1, p / .07, (1 - p) / .07)
    dot(items, point, 2.4, BLUE, fade * air * (onExit ? deflect : 1))
  }
  // The orange annotation is explicitly the turning component, so it lies in
  // the rotor plane. Its direction matches CCW motion in the large front view.
  line(items, point, detailTurningEnd(angle), '#fff4d9', 6.1, .9 * push, true)
  arrow(items, point, detailTurningEnd(angle), '#fff4d9', .9 * push, 8, true, 6.1)
  line(items, point, detailTurningEnd(angle), ORANGE, 3.3, push, true)
  arrow(items, point, detailTurningEnd(angle), ORANGE, push, 8, true)

  items.sort((a, b) => a.depth - b.depth)
  for (const item of items) item.paint(ctx, sceneAlpha)
  ctx.globalAlpha = air * sceneAlpha
  ctx.fillStyle = BLUE
  const contactScreen = project(point)
  ctx.beginPath()
  ctx.arc(contactScreen.x, contactScreen.y, 2.8, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
  const inletScreen = project(detailIncomingPoint(angle, 0))
  label(ctx, '来风', 'Wind', Math.max(42, inletScreen.x + 16), Math.max(15, inletScreen.y - 29), BLUE, 'center', sceneAlpha)
  if (push > 0) {
    label(ctx, '推着转的力', 'Turning push', 333, 28, ORANGE, 'center', push * sceneAlpha)
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0)
}
