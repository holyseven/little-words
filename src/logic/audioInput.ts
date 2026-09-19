/**
 * Keep the quietest iPad/Safari microphone captures in a useful range before
 * sending them to a pronunciation model. This is deliberately a one-way
 * adjustment: already loud speech is left untouched and the gain is capped so
 * background noise cannot be amplified without bound.
 */
// Keep this close to the monitor threshold below: a quiet child voice should
// still be considered speech, while the later gain cap limits room noise.
const VOICED_SAMPLE_GATE = 0.004
const TARGET_RMS = 0.08
const MAX_GAIN = 4
const MAX_PEAK = 0.92

export function normalizeSpeechPcm(samples: Float32Array): Float32Array {
  if (samples.length === 0) return new Float32Array()

  let sumSquares = 0
  let voicedCount = 0
  let peak = 0
  for (const sample of samples) {
    const absolute = Math.abs(sample)
    if (absolute < VOICED_SAMPLE_GATE) continue
    sumSquares += sample * sample
    voicedCount += 1
    peak = Math.max(peak, absolute)
  }
  if (voicedCount === 0 || peak === 0) return new Float32Array(samples)

  const rms = Math.sqrt(sumSquares / voicedCount)
  const gain = Math.min(MAX_GAIN, TARGET_RMS / rms, MAX_PEAK / peak)
  // Do not make a loud recording quieter. A tiny tolerance avoids copying and
  // rewriting an otherwise unchanged buffer because of floating point noise.
  if (!Number.isFinite(gain) || gain <= 1.05) return new Float32Array(samples)

  const normalized = new Float32Array(samples.length)
  for (let i = 0; i < samples.length; i += 1) {
    normalized[i] = Math.max(-1, Math.min(1, (samples[i] ?? 0) * gain))
  }
  return normalized
}
