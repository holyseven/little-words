export type WindLevel = 0 | 1 | 2

export interface WindmillMotion {
  /** Rotation in degrees, normalized to [0, 360). */
  angle: number
  /** Nonnegative angular-speed magnitude in degrees per second. */
  speed: number
}

export const WIND_SPEEDS = { 0: 0, 1: 100, 2: 190 } as const

// The pictured folded rotor faces the viewer. Its cup orientation under
// front-on wind calls for counterclockwise motion (negative SVG rotation).
export const WINDMILL_DIRECTION = -1

const RESPONSE_RATE = 2.2
const FRICTION_RATE = 1.4
const STOP_SPEED = 0.25
const MAX_FRAME_MS = 100

function normalizeAngle(angle: number): number {
  if (!Number.isFinite(angle)) return 0
  return ((angle % 360) + 360) % 360
}

/**
 * A qualitative paper-pinwheel model, not a wind-speed measurement.
 * Integrate exponential acceleration/drag exactly over this frame so equal
 * elapsed time gives equal motion across different animation frame rates.
 * Pause by not calling this function; wind level 0 still allows coasting.
 */
export function stepWindmill(
  motion: WindmillMotion,
  wind: WindLevel,
  deltaMs: number,
): WindmillMotion {
  const angle = normalizeAngle(motion.angle)
  const speed = Number.isFinite(motion.speed)
    ? Math.max(0, Math.min(WIND_SPEEDS[2], motion.speed))
    : 0
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) return { angle, speed }

  const elapsed = Math.min(deltaMs, MAX_FRAME_MS) / 1000
  const target = wind === 1 || wind === 2 ? WIND_SPEEDS[wind] : WIND_SPEEDS[0]
  const rate = target === 0 ? FRICTION_RATE : RESPONSE_RATE

  // Stop only after the residual motion is imperceptible. Integrating up to
  // this same threshold time also keeps the final angle frame-rate independent.
  if (target === 0 && speed <= STOP_SPEED) return { angle, speed: 0 }
  const duration = target === 0
    ? Math.min(elapsed, Math.log(speed / STOP_SPEED) / rate)
    : elapsed
  const decay = Math.exp(-rate * duration)
  const nextSpeed = target + (speed - target) * decay
  const turn = target * duration + (speed - target) * (1 - decay) / rate

  return {
    angle: normalizeAngle(angle + WINDMILL_DIRECTION * turn),
    speed: target === 0 && duration < elapsed ? 0 : nextSpeed,
  }
}
