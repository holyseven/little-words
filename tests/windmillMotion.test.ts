import { describe, expect, it } from 'vitest'
import { coastLessonMotion, COAST_LESSON_DURATION_MS, stepWindmill, WIND_SPEEDS, type WindLevel, type WindmillMotion } from '../src/logic/windmillMotion'

function simulate(motion: WindmillMotion, wind: WindLevel, totalMs: number, frameMs: number): WindmillMotion {
  let result = motion
  for (let elapsed = 0; elapsed < totalMs; elapsed += frameMs) {
    result = stepWindmill(result, wind, Math.min(frameMs, totalMs - elapsed))
  }
  return result
}

describe('paper pinwheel motion', () => {
  it('does not start moving on its own without wind', () => {
    expect(simulate({ angle: 42, speed: 0 }, 0, 10000, 20)).toEqual({ angle: 42, speed: 0 })
  })

  it.each([1, 2] as const)('accelerates gradually toward the level %i speed without overshooting', (wind) => {
    const first = stepWindmill({ angle: 0, speed: 0 }, wind, 16)
    const later = simulate(first, wind, 1000, 20)
    const settled = simulate(later, wind, 10000, 20)
    expect(first.speed).toBeGreaterThan(0)
    expect(first.speed).toBeLessThan(WIND_SPEEDS[wind] / 10)
    expect(later.speed).toBeGreaterThan(first.speed)
    expect(later.speed).toBeLessThan(WIND_SPEEDS[wind])
    expect(settled.speed).toBeCloseTo(WIND_SPEEDS[wind], 6)
    expect(settled.speed).toBeLessThanOrEqual(WIND_SPEEDS[wind])
  })

  it('coasts when wind stops, then friction slows it to a complete stop', () => {
    const moving = { angle: 20, speed: WIND_SPEEDS[2] }
    const first = stepWindmill(moving, 0, 16)
    expect(first.angle).toBeLessThan(moving.angle)
    expect(first.speed).toBeGreaterThan(0)
    expect(first.speed).toBeLessThan(moving.speed)
    const slower = simulate(first, 0, 1000, 20)
    expect(slower.speed).toBeGreaterThan(0)
    expect(slower.speed).toBeLessThan(first.speed)
    const stopped = simulate(slower, 0, 10000, 20)
    expect(stopped.speed).toBe(0)
    expect(stepWindmill(stopped, 0, 100)).toEqual(stopped)
  })

  it('slows smoothly when the wind drops from strong to gentle', () => {
    const next = stepWindmill({ angle: 0, speed: WIND_SPEEDS[2] }, 1, 16)
    expect(next.speed).toBeGreaterThan(WIND_SPEEDS[1])
    expect(next.speed).toBeLessThan(WIND_SPEEDS[2])
  })

  it('turns the pictured front-facing rotor counterclockwise while speeding up', () => {
    const moving = simulate({ angle: 180, speed: 0 }, 1, 1000, 20)
    expect(moving.angle).toBeLessThan(180)
    expect(moving.angle).toBeGreaterThan(0)
    expect(moving.speed).toBeGreaterThan(0)
  })

  it('preserves counterclockwise direction when crossing zero degrees', () => {
    const moving = stepWindmill({ angle: 1, speed: WIND_SPEEDS[1] }, 1, 100)
    expect(moving.angle).toBeCloseTo(351, 8)
    expect(moving.speed).toBe(WIND_SPEEDS[1])
  })

  it.each([0, 1, 2] as const)('gives the same angle and speed at different frame rates for wind %i', (wind) => {
    const start = { angle: 120, speed: 185 }
    const smallFrames = simulate(start, wind, 8000, 8)
    const largeFrames = simulate(start, wind, 8000, 100)
    expect(smallFrames.angle).toBeCloseTo(largeFrames.angle, 8)
    expect(smallFrames.speed).toBeCloseTo(largeFrames.speed, 8)
  })

  it('caps long frames so a background tab cannot suddenly jump ahead', () => {
    const start = { angle: 25, speed: 80 }
    expect(stepWindmill(start, 2, 10000)).toEqual(stepWindmill(start, 2, 100))
  })

  it.each([NaN, Infinity, -Infinity, -1, 0])('does not advance for an invalid or empty delta of %s', (delta) => {
    expect(stepWindmill({ angle: 25, speed: 80 }, 2, delta)).toEqual({ angle: 25, speed: 80 })
  })

  it('sanitizes broken state and runtime wind inputs without producing NaN', () => {
    expect(stepWindmill({ angle: NaN, speed: Infinity }, 0, 16)).toEqual({ angle: 0, speed: 0 })
    expect(stepWindmill({ angle: -10, speed: -4 }, 0, 16)).toEqual({ angle: 350, speed: 0 })
    const limited = stepWindmill({ angle: Infinity, speed: 1000000 }, 2, 100)
    expect(limited.angle).toBeGreaterThanOrEqual(0)
    expect(limited.angle).toBeLessThan(360)
    expect(limited.speed).toBe(WIND_SPEEDS[2])
    expect(stepWindmill({ angle: 30, speed: 0 }, 9 as WindLevel, 16)).toEqual({ angle: 30, speed: 0 })
  })
})

describe('the narrated coast-down', () => {
  it('keeps visibly turning through the eight-second voice, then holds a complete stop', () => {
    const duringVoice = coastLessonMotion(220, 8_000)
    const halfSecondLater = coastLessonMotion(220, 8_500)
    expect(duringVoice.speed).toBeGreaterThan(10)
    expect(duringVoice.angle - halfSecondLater.angle).toBeGreaterThan(4)
    const stopped = coastLessonMotion(220, COAST_LESSON_DURATION_MS)
    expect(stopped.speed).toBe(0)
    expect(coastLessonMotion(220, 12_000)).toEqual(stopped)
  })

  it('loses speed smoothly without reversing or depending on earlier frame samples', () => {
    let prior = coastLessonMotion(347, 0)
    expect(prior.speed).toBe(WIND_SPEEDS[1])
    for (let time = 100; time <= COAST_LESSON_DURATION_MS; time += 100) {
      const next = coastLessonMotion(347, time)
      expect(next.speed).toBeLessThanOrEqual(prior.speed)
      const ccwTurn = (prior.angle - next.angle + 360) % 360
      expect(ccwTurn).toBeGreaterThanOrEqual(0)
      expect(ccwTurn).toBeLessThanOrEqual(WIND_SPEEDS[1] / 10)
      prior = next
    }
    const atEightSeconds = coastLessonMotion(347, 8_000)
    for (let time = 0; time < 8_000; time += 16) coastLessonMotion(347, time)
    expect(coastLessonMotion(347, 8_000)).toEqual(atEightSeconds)
    expect(coastLessonMotion(347, 0)).toEqual({ angle: 347, speed: WIND_SPEEDS[1] })
  })
})
