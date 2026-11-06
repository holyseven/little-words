import { describe, expect, it } from 'vitest'
import { paperAirDeflection } from '../src/logic/windmillAirflow'
import { turningTangent } from '../src/logic/windmillGeometry'
import { findWindContact, scenePaperPoint, SCENE_FOLD, WIND_RAYS } from '../src/logic/windmillScene'

describe('air leaving the folded paper', () => {
  it.each([0, 70, 180, 290])('starts just in front of the actual hit at angle %i', angle => {
    const paper = scenePaperPoint(angle, .85, .3)
    expect(paperAirDeflection(angle, .85, .3, 0)).toEqual({ ...paper, z: paper.z + 11 })
  })

  it.each([.1, .8, 1, 1.65])('follows the curved surface outside the sheet at radial %i', radial => {
    const angle = 37
    const tangent = turningTangent(angle)
    for (const startAcross of [-1, -.3, 0, .65, 1]) {
      let previousU = Infinity
      for (let index = 0; index <= 100; index += 1) {
        const p = .65 * index / 100
        const point = paperAirDeflection(angle, radial, startAcross, p)
        const u = point.x * tangent.x + point.y * tangent.y
        const paper = findWindContact(angle, point.x, point.y)
        expect(paper).not.toBeNull()
        expect(u).toBeLessThanOrEqual(previousU + 1e-10)
        if (paper) expect(point.z - paper.point.z).toBeGreaterThanOrEqual(3 - 1e-10)
        previousU = u
      }
    }
  })

  it('arrives along the axial wind direction before gradually turning sideways', () => {
    const start = paperAirDeflection(30, 1, .2, 0)
    const next = paperAirDeflection(30, 1, .2, 1e-7)
    expect(Math.hypot(next.x - start.x, next.y - start.y)).toBeLessThan(1e-9)
    expect(next.z).toBeLessThan(start.z)
  })

  it.each([[-1, .2], [0, 1], [.65, 1.65], [1, .8]])('leaves the edge continuously from across %i and radial %i', (across, radial) => {
    const epsilon = 1e-6
    const before = paperAirDeflection(80, radial, across, .65 - epsilon)
    const edge = paperAirDeflection(80, radial, across, .65)
    const after = paperAirDeflection(80, radial, across, .65 + epsilon)
    const upperLip = SCENE_FOLD.sectionAngle + SCENE_FOLD.curlSweep * across >= Math.PI / 2
    const actualEdge = scenePaperPoint(80, radial, upperLip ? 1 : -1)
    expect(edge.x).toBeCloseTo(actualEdge.x, 10)
    expect(edge.y).toBeCloseTo(actualEdge.y, 10)
    expect(edge.z).toBeCloseTo(actualEdge.z + 3, 10)
    for (const axis of ['x', 'y', 'z'] as const) {
      expect(Math.abs(after[axis] - edge[axis])).toBeLessThan(.002)
      expect((after[axis] - edge[axis]) / epsilon).toBeCloseTo((edge[axis] - before[axis]) / epsilon, 1)
    }
  })

  it.each([0, 60, 180, 315])('moves beyond the paper edge opposite the spin and then behind it at angle %i', angle => {
    const tangent = turningTangent(angle)
    for (const radial of [.2, 1, 1.65]) {
      for (const across of [-1, 0, .65, 1]) {
        const edge = paperAirDeflection(angle, radial, across, .65)
        let previousTravel = 0
        for (let index = 1; index <= 35; index += 1) {
          const point = paperAirDeflection(angle, radial, across, .65 + .35 * index / 35)
          const travel = -((point.x - edge.x) * tangent.x + (point.y - edge.y) * tangent.y)
          expect(travel).toBeGreaterThanOrEqual(previousTravel - 1e-10)
          expect(travel).toBeGreaterThan(0)
          previousTravel = travel
        }
        expect(paperAirDeflection(angle, radial, across, 1).z).toBeLessThan(0)
      }
    }
  })

  it('keeps fixed rays and inner lip probes clear of both branches at their actual first hits', () => {
    let upperHits = 0
    let lowerHits = 0
    // The returned corner sits close to the pin, inside the three lesson rays.
    // Inner fixed probes keep the upper-branch case covered as well.
    const rays = [...WIND_RAYS, { x: 15, y: 0 }, { x: 12, y: -12 }, { x: 12, y: 12 }]
    for (let angle = 0; angle < 360; angle += 5) {
      for (const ray of rays) {
        const hit = findWindContact(angle, ray.x, ray.y)
        if (!hit) continue
        const bladeAngle = angle + hit.blade * 90
        const upperLip = SCENE_FOLD.sectionAngle + SCENE_FOLD.curlSweep * hit.across >= Math.PI / 2
        if (upperLip) upperHits += 1
        else lowerHits += 1
        const start = paperAirDeflection(bladeAngle, hit.radial, hit.across, 0)
        expect(start.x).toBeCloseTo(hit.point.x, 8)
        expect(start.y).toBeCloseTo(hit.point.y, 8)
        expect(start.z).toBeCloseTo(hit.point.z + 11, 8)
        const tangent = turningTangent(bladeAngle)
        let previousU = start.x * tangent.x + start.y * tangent.y
        for (let sample = 1; sample <= 100; sample += 1) {
          const p = sample / 100
          const point = paperAirDeflection(bladeAngle, hit.radial, hit.across, p)
          const u = point.x * tangent.x + point.y * tangent.y
          expect(u).toBeLessThanOrEqual(previousU + 1e-9)
          previousU = u
          const paper = findWindContact(bladeAngle, point.x, point.y)
          // Inside the rolled cross-section and while crossing beneath the
          // open upper lip, the stream remains above its foremost layer.
          if (paper?.blade === 0) expect(point.z - paper.point.z).toBeGreaterThanOrEqual(3 - 1e-8)
        }
        expect(paperAirDeflection(bladeAngle, hit.radial, hit.across, 1).z).toBeLessThan(0)
      }
    }
    expect(upperHits).toBeGreaterThan(0)
    expect(lowerHits).toBeGreaterThan(0)
  })

  it('rotates the entire path with its material hit, without fixed screen-axis offsets', () => {
    const rotation = 73 * Math.PI / 180
    for (let step = 0; step <= 20; step += 1) {
      const point = paperAirDeflection(0, .8, .35, step / 20)
      const rotated = paperAirDeflection(73, .8, .35, step / 20)
      expect(rotated.x).toBeCloseTo(point.x * Math.cos(rotation) - point.y * Math.sin(rotation), 8)
      expect(rotated.y).toBeCloseTo(point.x * Math.sin(rotation) + point.y * Math.cos(rotation), 8)
      expect(rotated.z).toBeCloseTo(point.z, 10)
    }
  })

  it('clamps out-of-range and non-finite parameters to finite geometry', () => {
    for (const value of [NaN, Infinity, -Infinity, -2, 5]) {
      for (const point of [
        paperAirDeflection(value, 1, 0, .4),
        paperAirDeflection(0, value, 0, .4),
        paperAirDeflection(0, 1, value, .4),
        paperAirDeflection(0, 1, 0, value),
      ]) expect(Object.values(point).every(Number.isFinite)).toBe(true)
    }
    expect(paperAirDeflection(0, 1, 0, -Infinity)).toEqual(paperAirDeflection(0, 1, 0, 0))
    expect(paperAirDeflection(0, 1, 0, Infinity)).toEqual(paperAirDeflection(0, 1, 0, 1))
    expect(paperAirDeflection(0, -10, -10, 0)).toEqual(paperAirDeflection(0, 0, -1, 0))
    expect(paperAirDeflection(0, 10, 10, 1)).toEqual(paperAirDeflection(0, 1.65, 1, 1))
  })
})
