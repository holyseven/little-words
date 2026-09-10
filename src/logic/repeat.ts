export interface RepeatAnalysis {
  duration: number
  voicedRatio: number
  rms: number
  score: 0 | 1 | 2 | 3
  label: 'quiet' | 'short' | 'ready' | 'great'
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
