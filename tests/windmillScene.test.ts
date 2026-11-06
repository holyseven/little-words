import { describe, expect, it } from 'vitest'
import { bladeLessonAngle, bladePaperPoint, turningTangent, type BladePoint3 } from '../src/logic/windmillGeometry'
import { buildBladeMesh, findWindContact, projectScenePoint, SCENE_FOLD, scenePaperNormal, scenePaperPoint, sceneRadialScale, WIND_RAYS } from '../src/logic/windmillScene'

const cross = (a: {x: number; y: number}, b: {x: number; y: number}) => a.x * b.y - a.y * b.x
const difference = (a: {x: number; y: number}, b: {x: number; y: number}) => ({ x: a.x - b.x, y: a.y - b.y })

describe('the windmill perspective scene', () => {
  it('puts the camera in front, 45 degrees around and eight degrees above the wheel', () => {
    const origin = projectScenePoint({ x: 0, y: 0, z: 0 })
    const front = projectScenePoint({ x: 0, y: 0, z: 300 })
    const back = projectScenePoint({ x: 0, y: 0, z: -300 })
    expect(origin).toEqual({ x: 0, y: 0, depth: 0, scale: 1 })
    expect(front.depth).toBeGreaterThan(0)
    expect(front.scale).toBeGreaterThan(origin.scale)
    expect(back.scale).toBeLessThan(origin.scale)
    expect(front.x).toBeLessThan(0)
    expect(front.y).toBeGreaterThan(0)
    expect(front.y / -front.x).toBeCloseTo(Math.sin(8 * Math.PI / 180), 10)
    const xAxis = projectScenePoint({ x: 1, y: 0, z: 0 })
    const zAxis = projectScenePoint({ x: 0, y: 0, z: 1 })
    expect(xAxis.depth).toBeCloseTo(zAxis.depth, 10)
    expect(xAxis.x).toBeCloseTo(-zAxis.x, 10)
  })

  it('preserves front-face handedness and projects local CCW motion along its force', () => {
    expect(cross(projectScenePoint({ x: 1, y: 0, z: 0 }), projectScenePoint({ x: 0, y: 1, z: 0 }))).toBeGreaterThan(0)
    for (const angle of [-100, 0, 70, 150, 270]) {
      const point = bladePaperPoint(angle, 1, 0)
      const at = projectScenePoint(point)
      const next = projectScenePoint(bladePaperPoint(angle - .00001, 1, 0))
      const tangent = turningTangent(angle)
      const force = projectScenePoint({ x: point.x + tangent.x * .00001, y: point.y + tangent.y * .00001, z: point.z })
      const motion = difference(next, at)
      const push = difference(force, at)
      expect((motion.x * push.x + motion.y * push.y) / (Math.hypot(motion.x, motion.y) * Math.hypot(push.x, push.y))).toBeCloseTo(1, 8)
    }
  })

  it('projects parallel axial rays toward one common vanishing point', () => {
    const far = projectScenePoint({ x: 0, y: 0, z: -1e12 })
    const directions = WIND_RAYS.map(ray => {
      const front = projectScenePoint({ ...ray, z: 350 })
      const rear = projectScenePoint({ ...ray, z: -200 })
      const direction = difference(rear, front)
      const toVanishingPoint = difference(far, front)
      expect(cross(direction, toVanishingPoint) / (Math.hypot(direction.x, direction.y) * Math.hypot(toVanishingPoint.x, toVanishingPoint.y))).toBeCloseTo(0, 8)
      expect(direction.x * toVanishingPoint.x + direction.y * toVanishingPoint.y).toBeGreaterThan(0)
      return direction
    })
    // Perspective world-parallel lines converge; they are not identical pixel directions.
    expect(Math.abs(cross(directions[0], directions[1]))).toBeGreaterThan(1)
  })

  it('builds four curved, nondegenerate, consistently lit meshes with stable identities', () => {
    const first = buildBladeMesh(0)
    const turned = buildBladeMesh(-48)
    expect(first).toHaveLength(1520)
    expect(new Set(first.map(face => face.id)).size).toBe(first.length)
    expect(turned.map(face => face.id)).toEqual(first.map(face => face.id))
    expect(new Set(first.map(face => face.blade))).toEqual(new Set([0, 1, 2, 3]))
    for (const face of first) {
      expect(Math.hypot(face.normal.x, face.normal.y, face.normal.z)).toBeCloseTo(1, 10)
      for (const axis of ['x', 'y', 'z'] as const) {
        expect(face.center[axis]).toBeCloseTo(face.vertices.reduce((sum, vertex) => sum + vertex[axis], 0) / 3, 10)
      }
    }
    expect(Math.max(...first.map(face => face.center.z))).toBeGreaterThan(50)
    expect(Math.min(...first.map(face => face.normal.z))).toBeLessThan(0)
    expect(Math.max(...first.map(face => face.normal.z))).toBeGreaterThan(.5)
  })

  it.each([0, 45, 90, 180, 270, bladeLessonAngle(0), bladeLessonAngle(14_000)])('hits the exact paper surface for fixed rays at angle %i', angle => {
    for (let blade = 0; blade < 4; blade += 1) {
      for (const radial of [.2, .9, 1.65]) {
        for (const across of [-1, -.5, 0, .35, 1]) {
          const point = scenePaperPoint(angle + blade * 90, radial, across)
          const contact = findWindContact(angle, point.x, point.y)
          expect(contact).not.toBeNull()
          if (!contact) continue
          expect(contact.point.x).toBe(point.x)
          expect(contact.point.y).toBe(point.y)
          // The curled lip can hide a lower point sharing the same incoming ray.
          expect(contact.point.z).toBeGreaterThanOrEqual(point.z - 1e-8)
          const frontSurface = scenePaperPoint(angle + contact.blade * 90, contact.radial, contact.across)
          expect(frontSurface.x).toBeCloseTo(point.x, 9)
          expect(frontSurface.y).toBeCloseTo(point.y, 9)
          expect(frontSurface.z).toBeCloseTo(contact.point.z, 9)
          expect(contact.point.x * contact.tangent.x + contact.point.y * contact.tangent.y).toBeCloseTo(0, 10)
          expect(Math.hypot(contact.tangent.x, contact.tangent.y)).toBeCloseTo(1, 10)
          expect(contact.tangent.x * contact.point.y - contact.tangent.y * contact.point.x).toBeGreaterThan(0)
        }
      }
    }
  })

  it('widens the curled sails while preserving the selected point and the pin attachment', () => {
    expect(SCENE_FOLD.sectionAngle + SCENE_FOLD.curlSweep).toBeGreaterThan(Math.PI / 2)
    for (const angle of [-100, 0, 90, 270]) {
      const selected = scenePaperPoint(angle, 1, 0)
      const original = bladePaperPoint(angle, 1, 0)
      expect(selected.x).toBeCloseTo(original.x, 10)
      expect(selected.y).toBeCloseTo(original.y, 10)
      expect(selected.z).toBe(original.z)
      for (const across of [-1, -.5, 0, .5, 1]) {
        const root = scenePaperPoint(angle, 0, across)
        expect(root.x).toBeCloseTo(0, 10)
        expect(root.y).toBeCloseTo(0, 10)
        expect(root.z).toBeCloseTo(0, 10)
      }
    }
  })

  it('rolls broad curved rims through depth with smooth normals on both edges', () => {
    for (const angle of [0, 90, 180, 270]) {
      const low = scenePaperPoint(angle, 1.65, -1)
      const middle = scenePaperPoint(angle, 1.65, 0)
      const high = scenePaperPoint(angle, 1.65, 1)
      expect(middle.z).toBeGreaterThan(low.z)
      expect(Math.hypot(high.x, high.y)).toBeLessThan(Math.hypot(middle.x, middle.y) * .25)
      const lipStart = scenePaperPoint(angle, 1.65, .65)
      const tangent = turningTangent(angle)
      // The final lip reverses its sideways travel while continuing in depth.
      expect((high.x - lipStart.x) * tangent.x + (high.y - lipStart.y) * tangent.y).toBeLessThan(0)
      for (const across of [-1, -.5, 0, .5, 1]) {
        const normal = scenePaperNormal(angle, 1, across)
        expect(Math.hypot(normal.x, normal.y, normal.z)).toBeCloseTo(1, 10)
        if (across <= .5) expect(normal.z).toBeGreaterThan(0)
        if (across === 1) expect(normal.z).toBeLessThan(0)
        expect(scenePaperNormal(angle, 0, across)).toEqual(normal)
        const point = scenePaperPoint(angle, 1, across)
        const nextR = scenePaperPoint(angle, 1.000001, across)
        const nextA = scenePaperPoint(angle, 1, across + .000001)
        const radialDerivative = { x: (nextR.x - point.x) / .000001, y: (nextR.y - point.y) / .000001, z: (nextR.z - point.z) / .000001 }
        const acrossDerivative = { x: (nextA.x - point.x) / .000001, y: (nextA.y - point.y) / .000001, z: (nextA.z - point.z) / .000001 }
        expect(normal.x * radialDerivative.x + normal.y * radialDerivative.y + normal.z * radialDerivative.z).toBeCloseTo(0, 5)
        expect(normal.x * acrossDerivative.x + normal.y * acrossDerivative.y + normal.z * acrossDerivative.z).toBeCloseTo(0, 3)
      }
    }
  })

  it('keeps a wind ray fixed as the highlighted paper rotates underneath it', () => {
    const ray = { x: 90, y: 0 }
    const angles = [bladeLessonAngle(0), bladeLessonAngle(6_000)]
    const contacts = angles.map(angle => findWindContact(angle, ray.x, ray.y))
    expect(contacts.every(Boolean)).toBe(true)
    expect(contacts[0]?.point.x).toBe(contacts[1]?.point.x)
    expect(contacts[0]?.point.y).toBe(contacts[1]?.point.y)
    expect(contacts[0]?.point.z).not.toBeCloseTo(contacts[1]?.point.z ?? 0, 4)
    for (let index = 0; index < angles.length; index += 1) {
      const contact = contacts[index]
      if (!contact) continue
      const surface: BladePoint3 = scenePaperPoint(angles[index] + contact.blade * 90, contact.radial, contact.across)
      expect(contact.point.z).toBeCloseTo(surface.z, 10)
    }
  })

  it('meets the reverse lip before the surface folded underneath it', () => {
    const angle = bladeLessonAngle(0)
    const under = scenePaperPoint(angle, .3, .4)
    const hit = findWindContact(angle, under.x, under.y)
    expect(hit).not.toBeNull()
    expect(hit?.across).toBeGreaterThan(.6)
    expect(hit?.point.z).toBeGreaterThan(under.z + 3)
    if (hit) expect(scenePaperNormal(angle, hit.radial, hit.across).z).toBeLessThan(0)
  })

  it('returns the rolled corner toward the pin without moving the selected point', () => {
    expect(sceneRadialScale(-1)).toBe(1)
    expect(sceneRadialScale(0)).toBe(1)
    expect(sceneRadialScale(1)).toBeCloseTo(.18, 10)
    expect(sceneRadialScale(.5)).toBeLessThan(1)
    expect(sceneRadialScale(.5)).toBeGreaterThan(.18)
  })

  it('lets rays outside the paper pass through instead of inventing a contact', () => {
    expect(findWindContact(0, 400, 400)).toBeNull()
    expect(findWindContact(0, 0, 0)).toBeNull()
    expect(findWindContact(0, Infinity, 0)).toBeNull()
    expect(findWindContact(0, 0, NaN)).toBeNull()
  })
})
