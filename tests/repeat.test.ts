import { describe, expect, it } from 'vitest'
import { analyzeRepeat, decideAzureRepeat, decideRepeat, repeatFeedback } from '../src/logic/repeat'

describe('跟读练习本地反馈', () => {
  it('最终结果优先于 partial，避免中途猜中后最终改词仍然通过', () => {
    const result = decideRepeat({ soundMs: 800, finalText: 'dog', finalWords: [{ word: 'dog', conf: 0.91 }], partialText: 'cat' }, 'cat')
    expect(result.matched).toBe(false)
    expect(result.source).toBe('final')
  })

  it('没有最终结果时允许 partial 兜底，但标记为温和提醒', () => {
    const result = decideRepeat({ soundMs: 800, finalText: '', finalWords: [], partialText: 'cat' }, 'cat')
    expect(result).toMatchObject({ matched: true, uncertain: true, source: 'partial' })
  })

  it('低置信度命中仍然通过，但不把它当成清晰命中', () => {
    const result = decideRepeat({ soundMs: 800, finalText: 'cat', finalWords: [{ word: 'cat', conf: 0.31 }], partialText: '' }, 'cat')
    expect(result).toMatchObject({ matched: true, uncertain: true, source: 'final', confidence: 0.31 })
  })

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
  it('在线评估的中等分数通过但给温和提示', () => {
    expect(decideAzureRepeat({ recognized: true, accuracyScore: 68 }, 420)).toMatchObject({ matched: true, uncertain: true })
  })
  it('在线评估低分或没有目标词时不通过', () => {
    expect(decideAzureRepeat({ recognized: true, accuracyScore: 59 }, 420).matched).toBe(false)
    expect(decideAzureRepeat({ recognized: false, accuracyScore: 98 }, 420).matched).toBe(false)
  })
  it('词分数较高但存在明显低分音素时只给温和提示', () => {
    expect(decideAzureRepeat({ recognized: true, accuracyScore: 92, phonemeScores: [96, 12, 94] }, 420))
      .toMatchObject({ matched: true, uncertain: true })
  })
})
