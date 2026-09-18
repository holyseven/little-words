export interface RepeatAnalysis {
  duration: number
  voicedRatio: number
  rms: number
  score: 0 | 1 | 2 | 3
  label: 'quiet' | 'short' | 'ready' | 'great'
}

export interface RepeatRecognitionWord {
  word: string
  conf?: number
}

export interface RepeatRecognitionEvidence {
  soundMs: number
  finalText: string
  finalWords: RepeatRecognitionWord[]
  partialText: string
}

export interface RepeatRecognitionDecision {
  matched: boolean
  /** 目标词被猜中但证据偏弱；给鼓励和轻提示，不当作失败。 */
  uncertain: boolean
  source: 'final' | 'partial' | 'none'
  confidence?: number
}

function normalizedTokens(value: string): string[] {
  return value.trim().toLowerCase().replace(/[^a-z']+/g, ' ').trim().split(' ').filter(Boolean)
}

/**
 * 只做“听到了目标词吗”的宽容判定：最终结果优先，partial 只能在没有
 * 任何最终词时兜底。conf 是解码置信度，不是发音标准度，只用来标记
 * 一次需要轻声提醒的 uncertain 结果。
 */
export function decideRepeat(evidence: RepeatRecognitionEvidence, expected: string): RepeatRecognitionDecision {
  if (evidence.soundMs < 120) return { matched: false, uncertain: false, source: 'none' }
  const target = expected.trim().toLowerCase()
  const finalWords = evidence.finalWords.filter((item) => item.word.trim())
  const finalTokens = finalWords.map((item) => item.word.trim().toLowerCase())
  const finalTextTokens = normalizedTokens(evidence.finalText)

  if (finalWords.length > 0 || finalTextTokens.length > 0) {
    const matched = finalWords.length > 0 ? finalTokens.includes(target) : finalTextTokens.includes(target)
    if (!matched) return { matched: false, uncertain: false, source: 'final' }
    const confidences = finalWords.filter((item) => item.word.trim().toLowerCase() === target && item.conf !== undefined).map((item) => item.conf!)
    const confidence = confidences.length ? Math.max(...confidences) : undefined
    return { matched: true, uncertain: confidence !== undefined && confidence < 0.5, source: 'final', confidence }
  }

  const partialMatched = normalizedTokens(evidence.partialText).includes(target)
  return partialMatched
    ? { matched: true, uncertain: true, source: 'partial' }
    : { matched: false, uncertain: false, source: 'none' }
}

/** 评估录音是否适合继续练习，不冒充音素级发音评分。 */
export function analyzeRepeat(samples: Float32Array, sampleRate: number, referenceDuration: number): RepeatAnalysis {
  const duration = samples.length / sampleRate
  let sum = 0
  let voiced = 0
  const frame = Math.max(1, Math.floor(sampleRate * 0.02))
  for (let i = 0; i < samples.length; i += frame) {
    let energy = 0
    const end = Math.min(samples.length, i + frame)
    for (let j = i; j < end; j++) energy += samples[j]! * samples[j]!
    const rms = Math.sqrt(energy / Math.max(1, end - i))
    sum += energy
    if (rms >= 0.018) voiced += end - i
  }
  const rms = Math.sqrt(sum / Math.max(1, samples.length))
  const voicedRatio = voiced / Math.max(1, samples.length)
  const durationRatio = duration / Math.max(0.1, referenceDuration)
  if (rms < 0.008 || voicedRatio < 0.08) return { duration, voicedRatio, rms, score: 0, label: 'quiet' }
  if (durationRatio < 0.28) return { duration, voicedRatio, rms, score: 1, label: 'short' }
  if (durationRatio >= 0.55 && durationRatio <= 1.8 && voicedRatio >= 0.2) return { duration, voicedRatio, rms, score: 3, label: 'great' }
  return { duration, voicedRatio, rms, score: 2, label: 'ready' }
}

export function repeatFeedback(analysis: RepeatAnalysis, showZh: boolean): string {
  if (showZh) {
    if (analysis.label === 'quiet') return '声音很轻，再靠近一点，大声说给我听。'
    if (analysis.label === 'short') return '听起来很快，再听一遍，慢慢说完整。'
    if (analysis.label === 'great') return '听到了！节奏不错，再试一次会更有把握。'
    return '完成了一次跟读，继续保持！'
  }
  if (analysis.label === 'quiet') return 'The recording is quiet. Move closer and speak up.'
  if (analysis.label === 'short') return 'That was quick. Listen once more and say the whole line.'
  if (analysis.label === 'great') return 'I heard you! Nice rhythm. Try it once more.'
  return 'You completed a repeat. Keep going!'
}

export function analyzeLive(duration: number, rms: number, voicedRatio: number, referenceDuration: number): RepeatAnalysis {
  const durationRatio = duration / Math.max(0.1, referenceDuration)
  if (rms < 0.008 || voicedRatio < 0.08) return { duration, voicedRatio, rms, score: 0, label: 'quiet' }
  if (durationRatio < 0.28) return { duration, voicedRatio, rms, score: 1, label: 'short' }
  if (durationRatio >= 0.55 && durationRatio <= 1.8 && voicedRatio >= 0.2) return { duration, voicedRatio, rms, score: 3, label: 'great' }
  return { duration, voicedRatio, rms, score: 2, label: 'ready' }
}
