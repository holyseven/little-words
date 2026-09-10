import { expect, it } from 'vitest'
import { resolveAppearance } from '../src/logic/appearance'

it('自动外观在 19 点切夜间，7 点切回白天，系统深色优先', () => {
  for (const hour of [0, 6, 19, 23]) expect(resolveAppearance('auto', false, hour)).toBe('night')
  for (const hour of [7, 12, 18]) expect(resolveAppearance('auto', false, hour)).toBe('day')
  expect(resolveAppearance('auto', true, 12)).toBe('night')
  expect(resolveAppearance('day', true, 22)).toBe('day')
  expect(resolveAppearance('night', false, 12)).toBe('night')
})
