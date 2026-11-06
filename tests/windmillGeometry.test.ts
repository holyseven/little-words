import { describe, expect, it } from 'vitest'
import {
  bladeAirPoint,
  bladeLessonAngle,
  bladeLessonPose,
  bladePaperPoint,
  projectBladePoint,
  projectBladeSidePoint,
  rotateBladePoint,
  SELECTED_BLADE,
  turningTangent,
} from '../src/logic/windmillGeometry'

describe('one shared paper-blade geometry', () => {
  it('opens with the selected material point exactly to the right of the pin', () => {
    const point = rotateBladePoint(bladeLessonAngle(0))
    expect(point.x).toBeCloseTo(Math.hypot(SELECTED_BLADE.x, SELECTED_BLADE.y), 10)
    expect(point.y).toBeCloseTo(0, 10)
    expect(turningTangent(bladeLessonAngle(0)).y).toBeCloseTo(-1, 10)
  })

  it.each([-200, -48, 0, 90, 180, 360])('keeps the turning push tangent to the circle at angle %i', angle => {
    const point = rotateBladePoint(angle)
    const tangent = turningTangent(angle)
    expect(point.x * tangent.x + point.y * tangent.y).toBeCloseTo(0, 10)
    expect(Math.hypot(tangent.x, tangent.y)).toBeCloseTo(1, 10)
    const next = rotateBladePoint(angle - .001)
    const motionAlongPush = (next.x - point.x) * tangent.x + (next.y - point.y) * tangent.y
    expect(motionAlongPush).toBeGreaterThan(0)
  })

  it('preserves rotation handedness when the plane is viewed obliquely', () => {
    const xAxis = projectBladePoint({ x: 1, y: 0 })
    const yAxis = projectBladePoint({ x: 0, y: 1 })
    expect(xAxis.x * yAxis.y - xAxis.y * yAxis.x).toBeGreaterThan(0)
  })

  it('uses an orthographic camera 45 degrees around the wheel and 15 degrees above it', () => {
    const axes = [
      projectBladePoint({ x: 1, y: 0, z: 0 }),
      projectBladePoint({ x: 0, y: 1, z: 0 }),
      projectBladePoint({ x: 0, y: 0, z: 1 }),
    ]
    // The screen axes must be orthonormal, so the apparent depth comes from
    // one camera rotation rather than independent shears of the scene parts.
    expect(Math.hypot(...axes.map(axis => axis.x))).toBeCloseTo(1, 10)
    expect(Math.hypot(...axes.map(axis => axis.y))).toBeCloseTo(1, 10)
    expect(axes.reduce((sum, axis) => sum + axis.x * axis.y, 0)).toBeCloseTo(0, 10)
    expect(axes[0].x).toBeCloseTo(Math.SQRT1_2, 10)
    expect(axes[1].x).toBeCloseTo(0, 10)
    expect(axes[2].x).toBeCloseTo(-Math.SQRT1_2, 10)
    expect(axes[1].y).toBeCloseTo(Math.cos(Math.PI / 12), 10)
    expect(axes[0].y).toBeCloseTo(Math.sin(Math.PI / 12) * Math.SQRT1_2, 10)
    expect(axes[2].y).toBeCloseTo(axes[0].y, 10)
  })

  it.each([0, 70, 180])('keeps incoming wind parallel to the axle in the oblique view at angle %i', angle => {
    const inletWorld = bladeAirPoint(angle, 0, 430)
    const contactWorld = bladeAirPoint(angle, .58, 430)
    const inlet = projectBladePoint(inletWorld)
    const contact = projectBladePoint(contactWorld)
    const axleBack = projectBladePoint({ x: 0, y: 0, z: -1 })
    const incoming = { x: contact.x - inlet.x, y: contact.y - inlet.y }
    const travel = inletWorld.z - contactWorld.z
    expect(contactWorld.x).toBe(inletWorld.x)
    expect(contactWorld.y).toBe(inletWorld.y)
    expect(incoming.x).toBeCloseTo(axleBack.x * travel, 10)
    expect(incoming.y).toBeCloseTo(axleBack.y * travel, 10)
    expect(incoming.x).toBeGreaterThan(0)
    expect(incoming.y).toBeLessThan(0)
    // A translation to the selected blade cannot change the wind direction.
    expect(incoming.x * axleBack.y - incoming.y * axleBack.x).toBeCloseTo(0, 10)
    expect(incoming.x * axleBack.x + incoming.y * axleBack.y).toBeGreaterThan(0)
  })

  it.each([0, 70, 180])('projects the selected blade motion along its turning push at angle %i', angle => {
    const point = bladePaperPoint(angle, 1, 0)
    const at = projectBladePoint(point)
    const next = projectBladePoint(bladePaperPoint(angle - .001, 1, 0))
    const tangent = turningTangent(angle)
    const pushEnd = projectBladePoint({ x: point.x + tangent.x, y: point.y + tangent.y, z: point.z })
    const motion = { x: next.x - at.x, y: next.y - at.y }
    const push = { x: pushEnd.x - at.x, y: pushEnd.y - at.y }
    const alignment = (motion.x * push.x + motion.y * push.y)
      / (Math.hypot(motion.x, motion.y) * Math.hypot(push.x, push.y))
    expect(alignment).toBeCloseTo(1, 8)
  })

  it('looks exactly along the rotor plane in side view and preserves vertical position', () => {
    const nearSide = projectBladeSidePoint({ x: 120, y: -35, z: 24 })
    const farSide = projectBladeSidePoint({ x: -120, y: -35, z: 24 })
    expect(nearSide).toEqual({ x: -24, y: -35 })
    expect(farSide).toEqual(nearSide)
    expect(projectBladeSidePoint({ x: 120, y: -35 })).toEqual({ x: -0, y: -35 })
  })

  it.each([0, 70, 180])('shows axial wind moving horizontally onto the front in side view at angle %i', angle => {
    const inlet = projectBladeSidePoint(bladeAirPoint(angle, 0))
    const approaching = projectBladeSidePoint(bladeAirPoint(angle, .4))
    const contact = projectBladeSidePoint(bladeAirPoint(angle, .58))
    expect(approaching.x).toBeGreaterThan(inlet.x)
    expect(contact.x).toBeGreaterThan(approaching.x)
    expect(approaching.y).toBe(inlet.y)
    expect(contact.y).toBe(inlet.y)
  })

  it.each([0, 90, 180, bladeLessonAngle(14_000)])('keeps the same selected red point in front and side views at angle %i', angle => {
    const front = rotateBladePoint(angle)
    const paper = bladePaperPoint(angle, 1, 0)
    const side = projectBladeSidePoint(paper)
    expect(paper.x).toBeCloseTo(front.x, 10)
    expect(paper.y).toBeCloseTo(front.y, 10)
    expect(paper.z).toBe(24)
    expect(side.y).toBe(front.y)
    expect(side.x).toBe(-24)
  })

  it.each([0, 90, 180, 270])('attaches the folded paper to the pin and curls with its turning tangent at angle %i', angle => {
    for (const across of [-1, 0, 1]) {
      const root = bladePaperPoint(angle, 0, across)
      expect(root.x).toBeCloseTo(0, 10)
      expect(root.y).toBeCloseTo(0, 10)
      expect(root.z).toBe(0)
    }
    const lowEdge = bladePaperPoint(angle, 1, -1)
    const highEdge = bladePaperPoint(angle, 1, 1)
    const tangent = turningTangent(angle)
    const alongTangent = (highEdge.x - lowEdge.x) * tangent.x + (highEdge.y - lowEdge.y) * tangent.y
    expect(alongTangent).toBeGreaterThan(0)
    expect(highEdge.z).toBeGreaterThan(lowEdge.z)
    // The two edges stay at the same radial station; only their tangential
    // offset and fold depth differ.
    const radius = rotateBladePoint(angle)
    expect((highEdge.x - lowEdge.x) * radius.x + (highEdge.y - lowEdge.y) * radius.y).toBeCloseTo(0, 8)
  })

  it.each([0, 70, 180])('brings wind perpendicular to the rotor plane at angle %i', angle => {
    const first = bladeAirPoint(angle, 0)
    const approach = bladeAirPoint(angle, .4)
    const contact = bladeAirPoint(angle, .58)
    expect(approach.x).toBe(first.x)
    expect(approach.y).toBe(first.y)
    expect(contact.x).toBe(first.x)
    expect(contact.y).toBe(first.y)
    expect(first.z).toBeGreaterThan(approach.z)
    expect(approach.z).toBeGreaterThan(contact.z)
    // The incoming direction has no component along either rotor-plane axis.
    expect(approach.x - first.x).toBe(0)
    expect(approach.y - first.y).toBe(0)
  })

  it.each([0, 70, 180])('turns the air opposite the paper push at angle %i', angle => {
    const start = bladeAirPoint(angle, .58)
    const end = bladeAirPoint(angle, 1)
    const push = turningTangent(angle)
    const sideways = { x: end.x - start.x, y: end.y - start.y }
    expect(sideways.x * push.x + sideways.y * push.y).toBeCloseTo(-95, 8)
    expect(end.z).toBeLessThan(start.z)
    for (let index = 0; index <= 100; index += 1) {
      expect(bladeAirPoint(angle, index / 100).z).toBeGreaterThanOrEqual(10 - 1e-10)
    }
    const justAfter = bladeAirPoint(angle, .580001)
    expect(Math.hypot(justAfter.x - start.x, justAfter.y - start.y)).toBeLessThan(.000001)
  })

  it('holds for the explanation, then turns both views monotonically CCW and holds the poster', () => {
    const start = bladeLessonAngle(0)
    expect(bladeLessonAngle(3_999)).toBe(start)
    expect(bladeLessonAngle(4_000)).toBe(start)
    let previous = start
    for (let time = 4_100; time <= 14_000; time += 100) {
      const angle = bladeLessonAngle(time)
      expect(angle).toBeLessThan(previous)
      previous = angle
    }
    expect(start - previous).toBeCloseTo(48, 10)
    expect(bladeLessonAngle(30_000)).toBe(previous)
    expect(bladeLessonAngle(-Infinity)).toBe(start)
    expect(bladeLessonAngle(Infinity)).toBe(previous)
    expect(bladeLessonAngle(NaN)).toBe(start)
  })

  it.each([0, 120, 350])('joins the lesson from entry angle %i without a visible jump or reversal', entry => {
    const before = rotateBladePoint(entry)
    const first = rotateBladePoint(bladeLessonPose(0, entry))
    expect(first.x).toBeCloseTo(before.x, 10)
    expect(first.y).toBeCloseTo(before.y, 10)
    let previous = bladeLessonPose(0, entry)
    for (let time = 100; time <= 1_500; time += 100) {
      const angle = bladeLessonPose(time, entry)
      expect(angle).toBeLessThan(previous)
      previous = angle
    }
    for (const time of [1_500, 2_000, 4_000, 8_000, 14_000, 30_000]) {
      expect(bladeLessonPose(time, entry)).toBe(bladeLessonAngle(time))
    }
  })

  it('handles wrapped and invalid entry poses without producing a non-finite angle', () => {
    expect(bladeLessonPose(0, -10)).toBeCloseTo(bladeLessonPose(0, 350), 10)
    expect(bladeLessonPose(0, 710)).toBeCloseTo(bladeLessonPose(0, 350), 10)
    for (const entry of [NaN, Infinity, -Infinity]) {
      expect(bladeLessonPose(0, entry)).toBe(bladeLessonPose(0, 0))
      expect(bladeLessonPose(Infinity, entry)).toBe(bladeLessonAngle(14_000))
      expect(Number.isFinite(bladeLessonPose(NaN, entry))).toBe(true)
    }
  })
})
