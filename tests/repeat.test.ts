import { describe, expect, it } from 'vitest'
import { analyzeRepeat, repeatFeedback } from '../src/logic/repeat'

describe('跟读练习本地反馈', () => {
  it('空录音提示提高音量', () => {
    const result = analyzeRepeat(new Float32Array(16000), 16000, 2)
    expect(result.score).toBe(0)
    expect(repeatFeedback(result, true)).toContain('声音很轻')
  })
  it('有连续人声且时长接近示范时给三颗星', () => {
    const samples = new Float32Array(32000).fill(0.12)
    const result = analyzeRepeat(samples, 16000, 2)
    expect(result.score).toBe(3)
  })
  it('很短的录音不会被当成完成', () => {
    const result = analyzeRepeat(new Float32Array(5000).fill(0.1), 16000, 2)
    expect(result.score).toBe(1)
  })
})
