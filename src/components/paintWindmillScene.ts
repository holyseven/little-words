import { paperAirDeflection } from '../logic/windmillAirflow'
import { rotateBladePoint, turningTangent, type BladePoint3 } from '../logic/windmillGeometry'
import {
  buildBladeMesh, findWindContact, projectScenePoint, SCENE_FOLD, scenePaperNormal, scenePaperPoint, WIND_RAYS,
  type SceneTriangle,
} from '../logic/windmillScene'

interface SceneFrame { angle: number; elapsedMs: number }
interface Primitive { depth: number; paint: (ctx: CanvasRenderingContext2D) => void }

const ORIGIN = { x: 236, y: 122 }
const SCENE_SCALE = .48
const COLORS = ['#e77e66', '#e8bd57', '#65abc6', '#73af9b']
const LIGHT = { x: -.4, y: -.52, z: .75 }
const CAMERA = { x: Math.SQRT1_2 * Math.cos(8 * Math.PI / 180), y: -Math.sin(8 * Math.PI / 180), z: Math.SQRT1_2 * Math.cos(8 * Math.PI / 180) }
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const ease = (time: number, start: number, duration: number) => {
  const p = clamp((time - start) / duration, 0, 1)
  return p * p * (3 - 2 * p)
}
const dot = (a: BladePoint3, b: BladePoint3) => a.x * b.x + a.y * b.y + a.z * b.z
const add = (a: BladePoint3, b: BladePoint3): BladePoint3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z })
const multiply = (a: BladePoint3, scale: number): BladePoint3 => ({ x: a.x * scale, y: a.y * scale, z: a.z * scale })
const cross = (a: BladePoint3, b: BladePoint3): BladePoint3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x })
const unit = (point: BladePoint3) => multiply(point, 1 / Math.hypot(point.x, point.y, point.z))
const projected = (point: BladePoint3) => {
  const p = projectScenePoint(point)
  return { x: ORIGIN.x + p.x * SCENE_SCALE, y: ORIGIN.y + p.y * SCENE_SCALE, depth: p.depth, scale: p.scale }
}
const averageDepth = (points: BladePoint3[]) => points.reduce((sum, point) => sum + projectScenePoint(point).depth, 0) / points.length

function lightAmount(normal: BladePoint3, paper = false) {
  const reverse = paper && dot(normal, CAMERA) < 0
  const facing = reverse ? multiply(normal, -1) : normal
  const diffuse = Math.max(0, dot(facing, LIGHT))
  return (.68 + .32 * diffuse) * (reverse ? 1.04 : 1)
}

function colorAt(hex: string, brightness: number) {
  const value = Number.parseInt(hex.slice(1), 16)
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255]
  return `rgb(${channels.map(channel => Math.round(clamp(channel * brightness, 0, 255))).join(' ')})`
}

function shade(hex: string, normal: BladePoint3, paper = false) {
  return colorAt(hex, lightAmount(normal, paper))
}

function addTriangle(items: Primitive[], vertices: [BladePoint3, BladePoint3, BladePoint3], color: string, brightness?: number[]) {
  const points = vertices.map(projected)
  items.push({ depth: averageDepth(vertices), paint: ctx => {
    ctx.globalAlpha = 1
    let fill: string | CanvasGradient = color
    if (brightness) {
      // A scalar light plane through all three smooth vertex normals gives
      // continuous shared-edge colors, instead of highlighting triangle facets.
      const dx1 = points[1].x - points[0].x
      const dy1 = points[1].y - points[0].y
      const dx2 = points[2].x - points[0].x
      const dy2 = points[2].y - points[0].y
      const determinant = dx1 * dy2 - dy1 * dx2
      const min = Math.min(...brightness)
      const max = Math.max(...brightness)
      if (Math.abs(determinant) > 1e-8 && max - min > .00001) {
        const first = brightness[1] - brightness[0]
        const second = brightness[2] - brightness[0]
        const gx = (first * dy2 - second * dy1) / determinant
        const gy = (dx1 * second - dx2 * first) / determinant
        const norm = gx * gx + gy * gy
        const start = (min - brightness[0]) / norm
        const end = (max - brightness[0]) / norm
        const gradient = ctx.createLinearGradient(points[0].x + gx * start, points[0].y + gy * start, points[0].x + gx * end, points[0].y + gy * end)
        gradient.addColorStop(0, colorAt(color, min))
        gradient.addColorStop(1, colorAt(color, max))
        fill = gradient
      } else fill = colorAt(color, (brightness[0] + brightness[1] + brightness[2]) / 3)
    }
    ctx.fillStyle = fill
    ctx.strokeStyle = fill
    ctx.lineWidth = .4
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    ctx.lineTo(points[1].x, points[1].y)
    ctx.lineTo(points[2].x, points[2].y)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  } })
}

function addLine(items: Primitive[], from: BladePoint3, to: BladePoint3, color: string, width: number, alpha = 1, bias = 0) {
  const start = projected(from)
  const end = projected(to)
  items.push({ depth: (start.depth + end.depth) / 2 + bias, paint: ctx => {
    ctx.globalAlpha = alpha
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(start.x, start.y)
    ctx.lineTo(end.x, end.y)
    ctx.stroke()
  } })
}

function addDot(items: Primitive[], point: BladePoint3, color: string, radius: number, alpha = 1) {
  const position = projected(point)
  items.push({ depth: position.depth, paint: ctx => {
    ctx.globalAlpha = alpha
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(position.x, position.y, radius * position.scale, 0, Math.PI * 2)
    ctx.fill()
  } })
}

function addArrowHead(items: Primitive[], from: BladePoint3, to: BladePoint3, color: string, alpha: number, size = 5) {
  const start = projected(from)
  const end = projected(to)
  const angle = Math.atan2(end.y - start.y, end.x - start.x)
  items.push({ depth: end.depth, paint: ctx => {
    ctx.globalAlpha = alpha
    ctx.strokeStyle = color
    ctx.lineWidth = 1.8
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(end.x - Math.cos(angle - .52) * size, end.y - Math.sin(angle - .52) * size)
    ctx.lineTo(end.x, end.y)
    ctx.lineTo(end.x - Math.cos(angle + .52) * size, end.y - Math.sin(angle + .52) * size)
    ctx.stroke()
  } })
}

/** Shaded solid cylinders use the same camera and depth queue as the paper. */
function addCylinder(items: Primitive[], from: BladePoint3, to: BladePoint3, radius: number, color: string, sides = 12) {
  const axis = unit({ x: to.x - from.x, y: to.y - from.y, z: to.z - from.z })
  const seed = Math.abs(axis.y) > .9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 }
  const first = unit(cross(axis, seed))
  const second = cross(axis, first)
  const ring = (center: BladePoint3, index: number) => {
    const angle = index / sides * Math.PI * 2
    return add(center, add(multiply(first, radius * Math.cos(angle)), multiply(second, radius * Math.sin(angle))))
  }
  // Short segments let paper and wind correctly hide individual shaft sections.
  const segments = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z) / 25))
  for (let length = 0; length < segments; length += 1) {
    const start = add(from, multiply({ x: to.x - from.x, y: to.y - from.y, z: to.z - from.z }, length / segments))
    const end = add(from, multiply({ x: to.x - from.x, y: to.y - from.y, z: to.z - from.z }, (length + 1) / segments))
    for (let index = 0; index < sides; index += 1) {
      const normalAngle = (index + .5) / sides * Math.PI * 2
      const normal = add(multiply(first, Math.cos(normalAngle)), multiply(second, Math.sin(normalAngle)))
      const fill = shade(color, normal)
      const a = ring(start, index)
      const b = ring(start, index + 1)
      const c = ring(end, index + 1)
      const d = ring(end, index)
      addTriangle(items, [a, b, c], fill)
      addTriangle(items, [a, c, d], fill)
    }
  }
  for (let index = 0; index < sides; index += 1) {
    addTriangle(items, [from, ring(from, index), ring(from, index + 1)], shade(color, multiply(axis, -1)))
    addTriangle(items, [to, ring(to, index), ring(to, index + 1)], shade(color, axis))
  }
}

function label(ctx: CanvasRenderingContext2D, zh: string, en: string, x: number, y: number, align: CanvasTextAlign = 'center', color = '#517367') {
  ctx.globalAlpha = 1
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = 'rgba(252,247,236,.97)'
  ctx.lineWidth = 4
  ctx.fillStyle = color
  ctx.font = '600 14px system-ui, sans-serif'
  ctx.strokeText(zh, x, y)
  ctx.fillText(zh, x, y)
  ctx.font = '13px system-ui, sans-serif'
  ctx.strokeText(en, x, y + 15)
  ctx.fillText(en, x, y + 15)
}

let cachedAngle = NaN
let cachedMesh: SceneTriangle[] = []

/** Shade the smooth paper surface, rather than highlighting tessellation edges. */
function paperLight(angle: number, blade: number, point: BladePoint3) {
  const radiusPoint = rotateBladePoint(angle + blade * 90)
  const radius = Math.hypot(radiusPoint.x, radiusPoint.y)
  const tangent = turningTangent(angle + blade * 90)
  const radial = (point.x * radiusPoint.x + point.y * radiusPoint.y) / (radius * radius)
  if (radial < 1e-8) return lightAmount(scenePaperNormal(angle + blade * 90, 0, 0), true)
  const qT = point.x * tangent.x + point.y * tangent.y
  // A material vertex has depth as well as silhouette position, so atan2
  // selects its actual side of the overhang rather than the first wind hit.
  const sine = qT / (radial * SCENE_FOLD.halfWidth) + Math.sin(SCENE_FOLD.sectionAngle)
  const cosine = Math.cos(SCENE_FOLD.sectionAngle) - (point.z / radial - SCENE_FOLD.base) / SCENE_FOLD.halfWidth
  const across = (Math.atan2(sine, cosine) - SCENE_FOLD.sectionAngle) / SCENE_FOLD.curlSweep
  const light = lightAmount(scenePaperNormal(angle + blade * 90, radial, across), true)
  // Shade the returned fold as part of the material, so its ridge is smoothly
  // occluded with the paper instead of looking like a dashed line on top.
  const shadow = .09 * Math.exp(-Math.pow((across - .42) / .15, 2))
  const ridge = .065 * Math.exp(-Math.pow((across - .58) / .1, 2))
  return light - shadow + ridge
}

/** Paint all physical parts from one perspective camera; no CSS 3D transforms. */
export function paintWindmillScene(ctx: CanvasRenderingContext2D, width: number, height: number, frame: SceneFrame): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, width, height)
  const fit = Math.min(width / 390, height / 260)
  ctx.setTransform(fit, 0, 0, fit, (width - 390 * fit) / 2, (height - 260 * fit) / 2)
  const { angle, elapsedMs } = frame
  const time = Math.max(0, elapsedMs)
  const items: Primitive[] = []

  addCylinder(items, { x: 0, y: 5, z: -70 }, { x: 0, y: 190, z: -70 }, 5, '#c5a16f')
  addCylinder(items, { x: 0, y: 0, z: -480 }, { x: 0, y: 0, z: 18 }, 4.2, '#b29565')
  if (cachedAngle !== angle) {
    cachedAngle = angle
    cachedMesh = buildBladeMesh(angle)
  }
  for (const face of cachedMesh) addTriangle(items, face.vertices, COLORS[face.blade], face.vertices.map(point => paperLight(angle, face.blade, point)))

  // Delicate paper edges give the folds a thickness cue, without a wireframe.
  for (let blade = 0; blade < 4; blade += 1) {
    const bladeAngle = angle + blade * 90
    const edgeColor = blade === 0 ? '#bd6956' : ['#bd6956', '#c49a40', '#4d8da9', '#579480'][blade]
    for (let index = 0; index < 10; index += 1) {
      const r0 = index / 10 * 1.65
      const r1 = (index + 1) / 10 * 1.65
      addLine(items, scenePaperPoint(bladeAngle, r0, -1), scenePaperPoint(bladeAngle, r1, -1), edgeColor, .55, .72, .1)
      addLine(items, scenePaperPoint(bladeAngle, r0, 1), scenePaperPoint(bladeAngle, r1, 1), '#fff0cd', .7, .56, .1)
    }
    for (let index = 0; index < 20; index += 1) {
      addLine(items, scenePaperPoint(bladeAngle, 1.65, -1 + index / 10), scenePaperPoint(bladeAngle, 1.65, -1 + (index + 1) / 10), edgeColor, .55, .65, .1)
    }
  }
  addCylinder(items, { x: 0, y: 0, z: 20 }, { x: 0, y: 0, z: 29 }, 8, '#deb764', 20)

  const airAlpha = ease(time, 300, 900)
  const deflectAlpha = ease(time, 2_000, 700)
  for (let ray = 0; ray < WIND_RAYS.length; ray += 1) {
    const { x, y } = WIND_RAYS[ray]
    const contact = findWindContact(angle, x, y)
    const endZ = contact ? contact.point.z + 11 : -150
    const sourceZ = 380
    const at = (progress: number) => ({ x, y, z: sourceZ + (endZ - sourceZ) * progress })
    const departing = contact
      ? (progress: number) => paperAirDeflection(angle + contact.blade * 90, contact.radial, contact.across, progress)
      : null
    for (let index = 0; index < 28; index += 1) addLine(items, at(index / 28), at((index + 1) / 28), '#6da8b9', 1.25, .42 * airAlpha)
    const arrowZ = endZ + 45
    addArrowHead(items, { x, y, z: arrowZ + 25 }, { x, y, z: arrowZ }, '#5c9fb3', airAlpha, 5.5)
    if (departing && deflectAlpha > 0) {
      for (let index = 0; index < 32; index += 1) {
        addLine(items, departing(index / 32), departing((index + 1) / 32), '#4f9db3', 1.55, .72 * deflectAlpha)
      }
      addArrowHead(items, departing(.91), departing(1), '#4f9db3', deflectAlpha, 5.5)
    }
    for (let index = 0; index < 6; index += 1) {
      const p = ((time / 4_000 + index / 6 + ray * .08) % 1 + 1) % 1
      const fade = Math.min(1, p / .08, (1 - p) / .08)
      // A particle travels from the fixed inlet into that ray's actual hit,
      // then leaves the same sheet. No detached track follows the red marker.
      const point = departing && p > .68 ? departing((p - .68) / .32) : at(departing ? p / .68 : p)
      addDot(items, point, '#5a9eb2', 2.1, fade * airAlpha * .88 * (departing && p > .68 ? deflectAlpha : 1))
    }
  }

  const selected = scenePaperPoint(angle, 1, 0)
  const selectedScreen = projected(selected)
  items.push({ depth: selectedScreen.depth + 4, paint: context => {
    context.globalAlpha = 1
    context.fillStyle = '#fff8df'
    context.strokeStyle = '#ad8746'
    context.lineWidth = 1.1
    context.beginPath()
    context.arc(selectedScreen.x, selectedScreen.y, 3.8, 0, Math.PI * 2)
    context.fill()
    context.stroke()
  } })

  const spinAlpha = ease(time, 4_000, 700)
  const selectedPlane = rotateBladePoint(angle)
  const radius = Math.hypot(selectedPlane.x, selectedPlane.y) * 1.7
  // Motion annotation uses the physical wheel plane, with its own overlay
  // queue so it stays readable without looking like a force on the paper.
  const rotationCue: Primitive[] = []
  const startAngle = Math.atan2(selectedPlane.y, selectedPlane.x) + .8
  const arcPoint = (p: number) => ({ x: Math.cos(startAngle - p * .6) * radius, y: Math.sin(startAngle - p * .6) * radius, z: 24 })
  if (spinAlpha > 0) {
    for (let index = 0; index < 20; index += 1) addLine(rotationCue, arcPoint(index / 20), arcPoint((index + 1) / 20), '#b38742', 2.15, spinAlpha)
    addArrowHead(rotationCue, arcPoint(.92), arcPoint(1), '#b38742', spinAlpha, 6)
  }

  items.sort((a, b) => a.depth - b.depth)
  for (const item of items) item.paint(ctx)
  for (const item of rotationCue) item.paint(ctx)
  ctx.globalAlpha = 1

  label(ctx, '来风', 'Wind', 88, 70, 'center', '#5b91a1')
  const axlePoint = projected({ x: 0, y: 0, z: -480 })
  ctx.strokeStyle = '#a09374'
  ctx.lineWidth = .8
  ctx.beginPath()
  ctx.moveTo(axlePoint.x + 3, axlePoint.y - 3)
  ctx.lineTo(329, 82)
  ctx.stroke()
  label(ctx, '中心轴', 'Axle', 338, 60, 'center', '#84744e')
  if (spinAlpha > 0) {
    const start = projected(arcPoint(0))
    ctx.save()
    ctx.globalAlpha = spinAlpha
    label(ctx, '转动', 'Spin', clamp(start.x + 14, 96, 347), clamp(start.y + 10, 24, 214), 'left', '#a17638')
    ctx.restore()
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0)
}

export function sceneDebug(frame: SceneFrame) {
  return {
    selected: projected(scenePaperPoint(frame.angle, 1, 0)),
    axleFront: projected({ x: 0, y: 0, z: 18 }),
    axleBack: projected({ x: 0, y: 0, z: -480 }),
    rays: WIND_RAYS.map(ray => {
      const contact = findWindContact(frame.angle, ray.x, ray.y)
      return { source: projected({ ...ray, z: 380 }), contact: contact ? projected(contact.point) : null }
    }),
  }
}
