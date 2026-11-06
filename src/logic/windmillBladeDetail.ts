import { PAPER_ROTOR, SELECTED_BLADE, type BladePoint, type BladePoint3 } from './windmillGeometry'
import { projectScenePoint } from './windmillScene'

export interface BladeDetailFrame { angle: number; elapsedMs: number }
export interface BladeTexturePoint extends BladePoint3 { u: number; v: number }

/** Highlight one parallel incident streamline through the same visible fold.
 * Its annotation follows the paper; its incoming direction stays axial. */
export const DETAIL_WIND_RAY = { sourceZ: 320, direction: { x: 0, y: 0, z: -1 } } as const
/** The original PNG's bright crease at row500 occupies columns378..382. */
export const DETAIL_FOLD_TARGET = { u: 380, v: 500 } as const
export const DETAIL_TEXTURE = { size: 1254, left: 250, top: 28, right: 622, bottom: 705 } as const

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))
const unitScale = PAPER_ROTOR.bounds.width / DETAIL_TEXTURE.size

/** The original illustration's visible fold, lifted a little into depth.
 * Its x/y are never reshaped: the exact original red silhouette is the texture.
 */
export function detailFoldHeight(u: number, v: number): number {
  const x = PAPER_ROTOR.bounds.x + u * unitScale
  const y = PAPER_ROTOR.bounds.y + v * unitScale
  const radial = Math.hypot(x, y) / 180
  // Approximate the visible diagonal fold ridge, not a replacement blade rim.
  const t = clamp((v - 340) / 280, 0, 1)
  const ridgeX = 270 + 330 * t * t
  const ridge = Math.exp(-Math.pow((u - ridgeX) / 72, 2))
  return radial * (13 + 19 * ridge)
}

export function detailSourcePoint(u: number, v: number, angle: number): BladeTexturePoint {
  const x = PAPER_ROTOR.bounds.x + u * unitScale
  const y = PAPER_ROTOR.bounds.y + v * unitScale
  const radians = (Number.isFinite(angle) ? angle : 0) * Math.PI / 180
  const cosine = Math.cos(radians)
  const sine = Math.sin(radians)
  return { x: x * cosine - y * sine, y: x * sine + y * cosine, z: detailFoldHeight(u, v), u, v }
}

export function detailSourceAtWorld(angle: number, x: number, y: number): BladePoint {
  const radians = (Number.isFinite(angle) ? angle : 0) * Math.PI / 180
  const cosine = Math.cos(radians)
  const sine = Math.sin(radians)
  const sourceX = x * cosine + y * sine
  const sourceY = -x * sine + y * cosine
  return { x: (sourceX - PAPER_ROTOR.bounds.x) / unitScale, y: (sourceY - PAPER_ROTOR.bounds.y) / unitScale }
}

export function detailContact(angle: number) {
  const source = { x: DETAIL_FOLD_TARGET.u, y: DETAIL_FOLD_TARGET.v }
  const material = detailSourcePoint(source.x, source.y, angle)
  const point = { x: material.x, y: material.y, z: material.z + 1.5 }
  const radius = Math.hypot(point.x, point.y)
  // This is the turning component of the push, not the complete pressure force.
  const tangent = { x: point.y / radius, y: -point.x / radius, z: 0 }
  return { point, source, tangent }
}

export function detailIncomingPoint(angle: number, progress: number): BladePoint3 {
  const contact = detailContact(angle).point
  const p = clamp(progress, 0, 1)
  return { x: contact.x, y: contact.y, z: DETAIL_WIND_RAY.sourceZ + (contact.z - DETAIL_WIND_RAY.sourceZ) * p }
}

/** A short qualitative deflection, viewed on the front of the same paper.
 * It first approaches axially, then follows the paper opposite the turning push.
 * This close-up stops before claiming to show the complete downstream wake.
 */
export function detailExitPoint(angle: number, progress: number): BladePoint3 {
  const { point, tangent } = detailContact(angle)
  const p = clamp(progress, 0, 1)
  const sideways = 48 * p * p
  const x = point.x - tangent.x * sideways
  const y = point.y - tangent.y * sideways
  const source = detailSourceAtWorld(angle, x, y)
  const height = detailFoldHeight(source.x, source.y)
  // Stay in front of the illustrated fold rather than drawing a hidden path
  // behind it as if it were an overlay. The initial derivative remains axial.
  return { x, y, z: height + 1.5 - 3 * p + 12 * p * p }
}

export function detailTurningEnd(angle: number, length = 77): BladePoint3 {
  const { point, tangent } = detailContact(angle)
  return { x: point.x + tangent.x * length, y: point.y + tangent.y * length, z: point.z }
}

export function detailSelectedPoint(angle: number): BladePoint3 {
  const u = (SELECTED_BLADE.x - PAPER_ROTOR.bounds.x) / unitScale
  const v = (SELECTED_BLADE.y - PAPER_ROTOR.bounds.y) / unitScale
  return detailSourcePoint(u, v, angle)
}

export function detailDebug(frame: BladeDetailFrame) {
  const { point, tangent, source } = detailContact(frame.angle)
  return {
    selected: projectScenePoint(detailSelectedPoint(frame.angle)),
    contact: projectScenePoint(point),
    source: projectScenePoint(detailIncomingPoint(frame.angle, 0)),
    exit: projectScenePoint(detailExitPoint(frame.angle, 1)),
    force: projectScenePoint(detailTurningEnd(frame.angle)),
    ray: DETAIL_WIND_RAY,
    foldTarget: DETAIL_FOLD_TARGET,
    materialContact: source,
    tangent,
  }
}
