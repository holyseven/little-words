import { describe, expect, it } from 'vitest'
import { normalizeSpeechPcm } from '../src/logic/audioInput'

describe('跟读采音电平', () => {
  it('会提升安静的人声，同时保留静音区', () => {
    const input = new Float32Array([0, 0.02, -0.02, 0, 0.03, -0.03, 0])
    const output = normalizeSpeechPcm(input)

    expect(output[0]).toBe(0)
    expect(Math.abs(output[1] ?? 0)).toBeGreaterThan(Math.abs(input[1] ?? 0))
    expect(Math.max(...Array.from(output).map(Math.abs))).toBeLessThanOrEqual(0.92)
  })

  it('不会放大纯静音或已经足够响的录音', () => {
    const silence = new Float32Array(8)
    const loud = new Float32Array([0.2, -0.25, 0.3, -0.28])

    expect(Array.from(normalizeSpeechPcm(silence))).toEqual(Array.from(silence))
    expect(Array.from(normalizeSpeechPcm(loud))).toEqual(Array.from(loud))
  })
})
