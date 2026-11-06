import { describe, expect, it } from 'vitest'
import { rotateBladePoint } from '../src/logic/windmillGeometry'
import {
  DETAIL_FOLD_TARGET, DETAIL_WIND_RAY, detailContact, detailExitPoint, detailFoldHeight, detailIncomingPoint,
  detailSelectedPoint, detailSourceAtWorld, detailSourcePoint, detailTurningEnd,
} from '../src/logic/windmillBladeDetail'

// The bright crease was checked against the original1254px PNG, rather than
// inferring the target from the schematic depth function.
const measuredCrease = { row: 500, firstColumn: 378, lastColumn: 382 }

describe('one original paper blade in the45-degree detail', () => {
  it('keeps the axial streamline aimed at the original visible crease throughout the turn', () => {
    expect(DETAIL_FOLD_TARGET.v).toBe(measuredCrease.row)
    expect(DETAIL_FOLD_TARGET.u).toBeGreaterThanOrEqual(measuredCrease.firstColumn)
    expect(DETAIL_FOLD_TARGET.u).toBeLessThanOrEqual(measuredCrease.lastColumn)
    for (let angle = 90; angle <= 138; angle += .25) {
      const { point, source } = detailContact(angle)
      expect(source).toEqual({ x: DETAIL_FOLD_TARGET.u, y: DETAIL_FOLD_TARGET.v })
      const material = detailSourcePoint(source.x, source.y, angle)
      expect(material.x).toBeCloseTo(point.x, 9)
      expect(material.y).toBeCloseTo(point.y, 9)
      const incoming = detailIncomingPoint(angle, 0)
      expect(incoming.x - point.x).toBe(0)
      expect(incoming.y - point.y).toBe(0)
      expect(incoming.z).toBe(DETAIL_WIND_RAY.sourceZ)
      expect(DETAIL_WIND_RAY.direction).toEqual({ x: 0, y: 0, z: -1 })
    }
  })

  it('preserves the original selected material point while both views turn together', () => {
    for (const angle of [0, 90, 114, 138, 498]) {
      const selected = detailSelectedPoint(angle)
      const original = rotateBladePoint(angle)
      expect(selected.x).toBeCloseTo(original.x, 10)
      expect(selected.y).toBeCloseTo(original.y, 10)
      const inverse = detailSourceAtWorld(angle, selected.x, selected.y)
      const restored = detailSourcePoint(inverse.x, inverse.y, angle)
      expect(restored.z).toBeCloseTo(selected.z, 10)
    }
  })

  it('joins the axial arrival continuously to a sideways deflection above the same paper', () => {
    for (const angle of [90, 114, 138]) {
      const contact = detailContact(angle)
      const arrival = detailIncomingPoint(angle, 1)
      const departure = detailExitPoint(angle, 0)
      expect(arrival.x).toBeCloseTo(departure.x, 10)
      expect(arrival.y).toBeCloseTo(departure.y, 10)
      expect(arrival.z).toBeCloseTo(departure.z, 10)
      const start = detailIncomingPoint(angle, 0)
      expect(start.x).toBe(contact.point.x)
      expect(start.y).toBe(contact.point.y)
      expect(start.z).toBeGreaterThan(contact.point.z + 200)
      const near = detailExitPoint(angle, .000001)
      expect(Math.hypot(near.x - contact.point.x, near.y - contact.point.y) / (contact.point.z - near.z)).toBeLessThan(.0001)
      const exit = detailExitPoint(angle, 1)
      for (let p = 0; p <= 1; p += .02) {
        const air = detailExitPoint(angle, p)
        const material = detailSourceAtWorld(angle, air.x, air.y)
        expect(air.z - detailFoldHeight(material.x, material.y)).toBeGreaterThan(1.2)
      }
      expect((exit.x - contact.point.x) * contact.tangent.x + (exit.y - contact.point.y) * contact.tangent.y).toBeLessThan(0)
    }
  })

  it('draws the turning component perpendicular to the radius with the sameCCW torque as the front wheel', () => {
    const { point } = detailContact(114)
    const force = detailTurningEnd(114)
    const dx = force.x - point.x
    const dy = force.y - point.y
    expect(point.x * dx + point.y * dy).toBeCloseTo(0, 10)
    expect(point.x * dy - point.y * dx).toBeLessThan(0)
    expect(force.z).toBe(point.z)
    const radius = Math.hypot(point.x, point.y)
    const angle = Math.atan2(point.y, point.x) - .001
    const next = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }
    expect(dx * (next.x - point.x) + dy * (next.y - point.y)).toBeGreaterThan(0)
  })
})
