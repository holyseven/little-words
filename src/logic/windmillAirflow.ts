import { rotateBladePoint, turningTangent, type BladePoint3 } from './windmillGeometry'
import { scenePaperPoint, SCENE_FOLD } from './windmillScene'

const EDGE_PROGRESS = .65
const clamp = (value: number, low: number, high: number, fallback: number) => (
  Number.isNaN(value) ? fallback : Math.max(low, Math.min(high, value))
)

const cubic = (a: number, b: number, c: number, d: number, t: number) => {
  const s = 1 - t
  return s * s * s * a + 3 * s * s * t * b + 3 * s * t * t * c + t * t * t * d
}

/** A qualitative air path after a fixed incoming ray meets folded paper.
 * Air bends opposite the turning direction while staying on the front side
 * of the curved sheet, then leaves its edge and continues behind the wheel.
 * This illustrates direction, rather than an exact fluid momentum budget.
 */
export function paperAirDeflection(angle: number, radial: number, across: number, progress: number): BladePoint3 {
  const bladeAngle = Number.isFinite(angle) ? angle : 0
  const r = clamp(radial, 0, 1.65, 1)
  const startAcross = clamp(across, -1, 1, 0)
  const p = clamp(progress, 0, 1, 0)
  // Past the rolled lip's crest, increasing across moves opposite T. Leave
  // through that open lip rather than tracing back through the other layer.
  const upperLip = SCENE_FOLD.sectionAngle + SCENE_FOLD.curlSweep * startAcross >= Math.PI / 2
  const edgeAcross = upperLip ? 1 : -1

  if (p <= EDGE_PROGRESS) {
    const t = p / EDGE_PROGRESS
    const point = scenePaperPoint(bladeAngle, r, startAcross + (edgeAcross - startAcross) * t * t)
    return { ...point, z: point.z + 3 + 8 * (1 - t) * (1 - t) }
  }

  const edge = scenePaperPoint(bladeAngle, r, edgeAcross)
  edge.z += 3
  // Use the sheet's real spatial derivative at its open edge so the stream
  // continues around the curl instead of crossing back through its paper.
  const delta = 1e-5
  const lower = scenePaperPoint(bladeAngle, r, edgeAcross - delta)
  const upper = scenePaperPoint(bladeAngle, r, edgeAcross + delta)
  const outward = {
    x: edgeAcross * (upper.x - lower.x) / (2 * delta),
    y: edgeAcross * (upper.y - lower.y) / (2 * delta),
    z: edgeAcross * (upper.z - lower.z) / (2 * delta),
  }
  const edgeSpeed = 2 * Math.abs(edgeAcross - startAcross) / EDGE_PROGRESS
  const firstFactor = edgeSpeed * (1 - EDGE_PROGRESS) / 3
  const firstTravel = Math.hypot(outward.x, outward.y) * firstFactor
  const outwardLength = Math.hypot(outward.x, outward.y)
  const tangent = turningTangent(bladeAngle)
  const blade = rotateBladePoint(bladeAngle)
  const effectiveRadial = (edge.x * blade.x + edge.y * blade.y) / (blade.x * blade.x + blade.y * blade.y)
  const lowerEdge = scenePaperPoint(bladeAngle, effectiveRadial, -1)
  const coveredTravel = Math.max(0, (edge.x - lowerEdge.x) * tangent.x + (edge.y - lowerEdge.y) * tangent.y)
  // The high lip overhangs a lower layer. Travel clear of that layer before
  // descending behind the wheel, rather than dropping through its paper.
  const exitTravel = Math.max(75, firstTravel * 2, upperLip ? coveredTravel * 1.4 + 25 : 0)
  const exitDirection = outwardLength > 1e-10
    ? { x: outward.x / outwardLength, y: outward.y / outwardLength }
    : { x: -tangent.x, y: -tangent.y }
  const first = {
    x: edge.x + outward.x * firstFactor,
    y: edge.y + outward.y * firstFactor,
    z: edge.z + outward.z * firstFactor,
  }
  const second = {
    x: edge.x + exitDirection.x * exitTravel,
    y: edge.y + exitDirection.y * exitTravel,
    z: upperLip ? Math.max(edge.z, first.z) : edge.z - 55,
  }
  const last = {
    x: edge.x + exitDirection.x * exitTravel,
    y: edge.y + exitDirection.y * exitTravel,
    z: Math.min(edge.z - 100, -55),
  }
  const t = (p - EDGE_PROGRESS) / (1 - EDGE_PROGRESS)
  return {
    x: cubic(edge.x, first.x, second.x, last.x, t),
    y: cubic(edge.y, first.y, second.y, last.y, t),
    z: cubic(edge.z, first.z, second.z, last.z, t),
  }
}
