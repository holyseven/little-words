import {
  rotateBladePoint, turningTangent,
  type BladePoint, type BladePoint3,
} from './windmillGeometry'

export interface SceneTriangle {
  id: string
  blade: number
  vertices: [BladePoint3, BladePoint3, BladePoint3]
  normal: BladePoint3
  center: BladePoint3
}

export interface WindContact {
  point: BladePoint3
  /** Unit tangent in the direction of the wheel's counterclockwise motion. */
  tangent: BladePoint
  blade: number
  radial: number
  across: number
}

/** A rolled cross-section continues past 90 degrees, revealing its reverse. */
export const SCENE_FOLD = { sectionAngle: .85, curlSweep: 1.25, halfWidth: 78, base: 24, returnRatio: .18 } as const

/** The rolled paper corner returns toward the pin rather than ending in a paddle rim. */
export function sceneRadialScale(across: number): number {
  const a = Math.min(1, Math.max(0, across))
  return 1 - (1 - SCENE_FOLD.returnRatio) * a * a * (3 - 2 * a)
}

export function scenePaperPoint(angle: number, radial: number, across: number): BladePoint3 {
  radial *= sceneRadialScale(across)
  const blade = rotateBladePoint(angle)
  const tangent = turningTangent(angle)
  const theta = SCENE_FOLD.sectionAngle + SCENE_FOLD.curlSweep * across
  const u = radial * SCENE_FOLD.halfWidth * (Math.sin(theta) - Math.sin(SCENE_FOLD.sectionAngle))
  return {
    x: blade.x * radial + tangent.x * u,
    y: blade.y * radial + tangent.y * u,
    z: radial * (SCENE_FOLD.base + SCENE_FOLD.halfWidth * (Math.cos(SCENE_FOLD.sectionAngle) - Math.cos(theta))),
  }
}

/** Smooth analytical normal, including the limiting normal at the shared pin. */
export function scenePaperNormal(angle: number, radial: number, across: number): BladePoint3 {
  const blade = rotateBladePoint(angle)
  const tangent = turningTangent(angle)
  const theta = SCENE_FOLD.sectionAngle + SCENE_FOLD.curlSweep * across
  const cosine = Math.cos(theta)
  const sine = Math.sin(theta)
  // This ruled surface is linear in radial. Its normal has a finite limit at
  // r=0; evaluate that limit with r=1 rather than forming a zero cross product.
  const r = radial > 1e-8 ? radial : 1
  const u = SCENE_FOLD.halfWidth * (sine - Math.sin(SCENE_FOLD.sectionAngle))
  const rise = SCENE_FOLD.base + SCENE_FOLD.halfWidth * (Math.cos(SCENE_FOLD.sectionAngle) - cosine)
  const dr = { x: blade.x + tangent.x * u, y: blade.y + tangent.y * u, z: rise }
  const da = {
    x: tangent.x * r * SCENE_FOLD.halfWidth * SCENE_FOLD.curlSweep * cosine,
    y: tangent.y * r * SCENE_FOLD.halfWidth * SCENE_FOLD.curlSweep * cosine,
    z: r * SCENE_FOLD.halfWidth * SCENE_FOLD.curlSweep * sine,
  }
  const normal = { x: dr.y * da.z - dr.z * da.y, y: dr.z * da.x - dr.x * da.z, z: dr.x * da.y - dr.y * da.x }
  const length = Math.hypot(normal.x, normal.y, normal.z)
  // One orientation for the whole material: the rolled lip may face backward.
  return { x: -normal.x / length, y: -normal.y / length, z: -normal.z / length }
}

const YAW = Math.PI / 4
const ELEVATION = 8 * Math.PI / 180
const DISTANCE = 900
const COS_YAW = Math.cos(YAW)
const SIN_YAW = Math.sin(YAW)
const COS_ELEVATION = Math.cos(ELEVATION)
const SIN_ELEVATION = Math.sin(ELEVATION)
const CAMERA_NORMAL = {
  x: SIN_YAW * COS_ELEVATION,
  y: -SIN_ELEVATION,
  z: COS_YAW * COS_ELEVATION,
}
const CAMERA_RIGHT = { x: COS_YAW, y: 0, z: -SIN_YAW }
const CAMERA_DOWN = {
  x: SIN_YAW * SIN_ELEVATION,
  y: COS_ELEVATION,
  z: COS_YAW * SIN_ELEVATION,
}
const dot = (a: BladePoint3, b: BladePoint3) => a.x * b.x + a.y * b.y + a.z * b.z
const subtract = (a: BladePoint3, b: BladePoint3): BladePoint3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })

/** A single perspective camera for paper, axle, force and wind.
 * +z is the wheel's front. Wind travels toward -z, independently of the camera.
 * Screen translation and scene sizing are left to the drawing component.
 */
export function projectScenePoint(point: BladePoint3): BladePoint & { depth: number; scale: number } {
  const depth = dot(point, CAMERA_NORMAL)
  const scale = DISTANCE / (DISTANCE - depth)
  return {
    x: dot(point, CAMERA_RIGHT) * scale,
    y: dot(point, CAMERA_DOWN) * scale,
    depth,
    scale,
  }
}

/** Fixed world-space rays: moving paper passes through the wind field. */
export const WIND_RAYS: readonly BladePoint[] = [
  { x: 90, y: 0 },
  { x: 45, y: -75 },
  { x: 45, y: 75 },
]

function triangle(id: string, blade: number, vertices: SceneTriangle['vertices']): SceneTriangle | null {
  const first = subtract(vertices[1], vertices[0])
  const second = subtract(vertices[2], vertices[0])
  const normal = {
    x: first.y * second.z - first.z * second.y,
    y: first.z * second.x - first.x * second.z,
    z: first.x * second.y - first.y * second.x,
  }
  const length = Math.hypot(normal.x, normal.y, normal.z)
  if (length < 1e-8) return null
  return {
    id,
    blade,
    vertices,
    normal: { x: -normal.x / length, y: -normal.y / length, z: -normal.z / length },
    center: {
      x: (vertices[0].x + vertices[1].x + vertices[2].x) / 3,
      y: (vertices[0].y + vertices[1].y + vertices[2].y) / 3,
      z: (vertices[0].z + vertices[1].z + vertices[2].z) / 3,
    },
  }
}

/** Curved paper tessellated for genuine surface shading and depth occlusion. */
export function buildBladeMesh(angle: number): SceneTriangle[] {
  const mesh: SceneTriangle[] = []
  for (let blade = 0; blade < 4; blade += 1) {
    const points = Array.from({ length: 11 }, (_, radial) => (
      Array.from({ length: 21 }, (_, across) => scenePaperPoint(angle + blade * 90, radial / 10 * 1.65, -1 + across / 10))
    ))
    for (let radial = 0; radial < 10; radial += 1) {
      for (let across = 0; across < 20; across += 1) {
        const a = points[radial][across]
        const b = points[radial + 1][across]
        const c = points[radial + 1][across + 1]
        const d = points[radial][across + 1]
        const first = triangle(`${blade}-${radial}-${across}-0`, blade, [a, b, c])
        const second = triangle(`${blade}-${radial}-${across}-1`, blade, [a, c, d])
        if (first) mesh.push(first)
        if (second) mesh.push(second)
      }
    }
  }
  return mesh
}

/** First paper surface met by a fixed ray arriving along the negative z axis.
 * The sheet has an exact inverse in its radial/tangential plane coordinates.
 * Select the largest z if silhouettes overlap, since the ray arrives from +z.
 */
export function findWindContact(angle: number, x: number, y: number): WindContact | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  let contact: WindContact | null = null
  for (let blade = 0; blade < 4; blade += 1) {
    const bladeAngle = angle + blade * 90
    const radiusPoint = rotateBladePoint(bladeAngle)
    const radius = Math.hypot(radiusPoint.x, radiusPoint.y)
    const basisTangent = turningTangent(bladeAngle)
    const radial = (x * radiusPoint.x + y * radiusPoint.y) / (radius * radius)
    if (radial <= 1e-8 || radial > 1.65 + 1e-10) continue
    const u = x * basisTangent.x + y * basisTangent.y
    const q = u / (radial * SCENE_FOLD.halfWidth) + Math.sin(SCENE_FOLD.sectionAngle)
    if (q < -1 - 1e-10 || q > 1 + 1e-10) continue
    const principal = Math.asin(Math.max(-1, Math.min(1, q)))
    for (const theta of [principal, Math.PI - principal]) {
      const across = (theta - SCENE_FOLD.sectionAngle) / SCENE_FOLD.curlSweep
      if (across < -1 - 1e-10 || across > 1 + 1e-10) continue
      const parameterRadial = radial / sceneRadialScale(across)
      if (parameterRadial > 1.65 + 1e-10) continue
      const z = radial * (SCENE_FOLD.base + SCENE_FOLD.halfWidth * (Math.cos(SCENE_FOLD.sectionAngle) - Math.cos(theta)))
      if (contact && contact.point.z >= z) continue
      const distanceFromPin = Math.hypot(x, y)
      contact = {
        point: { x, y, z },
        tangent: { x: y / distanceFromPin, y: -x / distanceFromPin },
        blade,
        radial: parameterRadial,
        across,
      }
    }
  }
  return contact
}
