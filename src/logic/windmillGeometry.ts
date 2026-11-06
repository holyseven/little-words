export interface BladePoint { x: number; y: number }
export interface BladePoint3 extends BladePoint { z: number }

/** Original paper art bounds, with its brass pin placed at the origin. */
export const PAPER_ROTOR = {
  bounds: { x: -206, y: -207.65, width: 420, height: 420 },
} as const

/** A material point on the red blade; every view follows this same point. */
export const SELECTED_BLADE = { x: -84, y: -76 } as const

// Plane coordinates follow SVG: right is +x, down is +y. Negative rotation is
// counterclockwise. Positive z is the wheel's front side, independent of camera.
const VIEW_YAW = Math.PI / 4
const VIEW_ELEVATION = Math.PI / 12
const VIEW_COS_YAW = Math.cos(VIEW_YAW)
const VIEW_SIN_YAW = Math.sin(VIEW_YAW)
const VIEW_COS_ELEVATION = Math.cos(VIEW_ELEVATION)
const VIEW_SIN_ELEVATION = Math.sin(VIEW_ELEVATION)

export function rotateBladePoint(angleDeg: number): BladePoint {
  const angle = (Number.isFinite(angleDeg) ? angleDeg : 0) * Math.PI / 180
  const cosine = Math.cos(angle)
  const sine = Math.sin(angle)
  return {
    x: SELECTED_BLADE.x * cosine - SELECTED_BLADE.y * sine,
    y: SELECTED_BLADE.x * sine + SELECTED_BLADE.y * cosine,
  }
}

/** Direction of the turning push, not the whole aerodynamic force. */
export function turningTangent(angleDeg: number): BladePoint {
  const point = rotateBladePoint(angleDeg)
  const radius = Math.hypot(point.x, point.y)
  return { x: point.y / radius, y: -point.x / radius }
}

/** One orthographic camera, 45° off the front and 15° above the wheel.
 * The front (+z) projects down-left. Air arriving along -z therefore moves
 * up-right, parallel to the visible axle, while the rotor retains its handedness.
 */
export function projectBladePoint(point: BladePoint & { z?: number }): BladePoint {
  const z = point.z ?? 0
  return {
    x: VIEW_COS_YAW * point.x - VIEW_SIN_YAW * z,
    y: VIEW_SIN_YAW * VIEW_SIN_ELEVATION * point.x + VIEW_COS_ELEVATION * point.y + VIEW_COS_YAW * VIEW_SIN_ELEVATION * z,
  }
}

/**
 * True side camera looking along the rotor's x direction. Front-side depth
 * appears on the left, so axial wind approaching the paper travels right.
 */
export function projectBladeSidePoint(point: BladePoint & { z?: number }): BladePoint {
  return { x: -(point.z ?? 0), y: point.y }
}

/**
 * A qualitative folded-paper surface attached to the same pin and radial
 * direction as the selected red blade. This describes a schematic fold,
 * not an exact 3D reconstruction of the raster artwork.
 *
 * radial: 0 at the pin, 1 at the selected material point, 1.65 at the rim.
 * across: -1 to 1 across the curled sheet, in the turning-tangent direction.
 */
export function bladePaperPoint(angleDeg: number, radial: number, across: number): BladePoint3 {
  const blade = rotateBladePoint(angleDeg)
  const tangent = turningTangent(angleDeg)
  const u = 38 * across * radial
  return {
    x: blade.x * radial + tangent.x * u,
    y: blade.y * radial + tangent.y * u,
    z: radial * (24 + .55 * u + .004 * u * u),
  }
}

const START_ANGLE = -Math.atan2(SELECTED_BLADE.y, SELECTED_BLADE.x) * 180 / Math.PI

/** Hold the selected blade at the right, then turn both views 48° CCW. */
export function bladeLessonAngle(elapsedMs: number): number {
  const time = Number.isNaN(elapsedMs) ? 0 : elapsedMs
  const progress = Math.max(0, Math.min(1, (time - 4_000) / 10_000))
  const eased = progress * progress * (3 - 2 * progress)
  return START_ANGLE - 48 * eased
}

/** Join the explanation from the wheel's current pose without reversing it. */
export function bladeLessonPose(elapsedMs: number, entryAngle: number): number {
  const time = Number.isNaN(elapsedMs) ? 0 : elapsedMs
  const entry = Number.isFinite(entryAngle) ? ((entryAngle % 360) + 360) % 360 : 0
  const remainingTurn = (entry - START_ANGLE + 360) % 360
  const progress = Math.max(0, Math.min(1, time / 1_500))
  const aligned = progress * progress * (3 - 2 * progress)
  return bladeLessonAngle(time) + remainingTurn * (1 - aligned)
}

/**
 * A qualitative stream, not a fluid simulation. Air approaches parallel to the
 * axle, then bends opposite the turning push. It stays in front of the paper
 * so the illustrative stream does not appear to pass through the sheet.
 */
export function bladeAirPoint(angleDeg: number, progress: number, inletDepth = 260): BladePoint3 {
  const p = Number.isNaN(progress) ? 0 : Math.max(0, Math.min(1, progress))
  const blade = rotateBladePoint(angleDeg)
  if (p <= .58) return { ...blade, z: inletDepth - (inletDepth - 30) * p / .58 }

  const tangent = turningTangent(angleDeg)
  const t = (p - .58) / .42
  const s = 1 - t
  // Cubic control points have sideways offsets 0, 0, 55, 95 and depths
  // 30, 20, 10, 10: the incoming direction joins without a sideways corner.
  const sideways = 3 * s * t * t * 55 + t * t * t * 95
  const z = s * s * s * 30 + 3 * s * s * t * 20 + 3 * s * t * t * 10 + t * t * t * 10
  return { x: blade.x - tangent.x * sideways, y: blade.y - tangent.y * sideways, z }
}
