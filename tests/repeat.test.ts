import { describe, expect, it } from 'vitest'
import { analyzeRepeat, decideAzureRepeat, decideRepeat, repeatFeedback } from '../src/logic/repeat'
import { voskVocabulary } from '../src/logic/speechTokens'

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

  it('短语按完整顺序命中，用最弱的词确定置信度', () => {
    const result = decideRepeat({ soundMs: 800, finalText: 'my pencil case', finalWords: [
      { word: 'my', conf: 0.99 }, { word: 'pencil', conf: 0.96 }, { word: 'case', conf: 0.31 },
    ], partialText: '' }, 'pencil case')
    expect(result).toMatchObject({ matched: true, uncertain: true, source: 'final', confidence: 0.31 })
  })

  it('没有逐词数据时仍可匹配带标点的完整短语', () => {
    expect(decideRepeat({ soundMs: 800, finalText: 'A pencil, case!', finalWords: [], partialText: '' }, 'pencil case'))
      .toMatchObject({ matched: true, uncertain: false, source: 'final' })
  })

  it.each(['pencil', 'case pencil', 'pencil red case', 'pencilcase'])('不把 %s 当成完整 pencil case，也不借用 partial 通过', (spoken) => {
    expect(decideRepeat({ soundMs: 800, finalText: spoken, finalWords: spoken.split(' ').map((word) => ({ word, conf: 0.99 })), partialText: 'pencil case' }, 'pencil case'))
      .toMatchObject({ matched: false, source: 'final' })
  })

  it('完整 partial 短语只给温和提醒，不完整的不能通过', () => {
    const evidence = { soundMs: 800, finalText: '', finalWords: [], partialText: 'pencil case' }
    expect(decideRepeat(evidence, 'pencil case')).toMatchObject({ matched: true, uncertain: true, source: 'partial' })
    expect(decideRepeat({ ...evidence, partialText: 'pencil' }, 'pencil case').matched).toBe(false)
  })

  it.each([
    ['schoolbag', ['school', 'bag']],
    ['school bag', ['schoolbag']],
  ])('接受 %s 对应的课本书包读法', (expected, spoken) => {
    expect(decideRepeat({ soundMs: 800, finalText: spoken.join(' '), finalWords: spoken.map((word) => ({ word, conf: 0.92 })), partialText: '' }, expected))
      .toMatchObject({ matched: true, uncertain: false, confidence: 0.92 })
  })

  it.each(['school', 'bag'])('不会把 schoolbag 的一部分当成单独的 %s', (expected) => {
    const evidence = { soundMs: 800, finalText: 'schoolbag', finalWords: [{ word: 'schoolbag', conf: 0.99 }], partialText: '' }
    expect(decideRepeat(evidence, expected).matched).toBe(false)
    expect(decideRepeat({ ...evidence, finalWords: [] }, expected).matched).toBe(false)
  })

  it('同一个单词读两次时保留原先使用最好置信度的行为', () => {
    expect(decideRepeat({ soundMs: 800, finalText: 'cat cat', finalWords: [{ word: 'cat', conf: 0.2 }, { word: 'cat', conf: 0.91 }], partialText: '' }, 'cat'))
      .toMatchObject({ matched: true, uncertain: false, confidence: 0.91 })
  })

  it('两条 Vosk 采音路径共用包含 school bag 的去重词表', () => {
    expect(voskVocabulary('schoolbag', ['School bag', 'schoolbag', 'pencil case', 'cat', '']))
      .toEqual(['school bag', 'pencil case', 'cat', '[unk]'])
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
