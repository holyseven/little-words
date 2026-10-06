import type { StretchAudioBuffer, StretchedAudio } from './timeStretch'

const TARGET_RMS = 10 ** (-16 / 20)
const MIN_GAIN = 0.4
const MAX_GAIN = 2
// Leave a little rounding room when the result is stored as float32.
const PEAK_CEILING = 0.92 - 0.000001
const SILENCE_POWER = 10 ** (-50 / 10)

/**
 * Bring short spoken clips to a similar listening level, once after decoding.
 * A fixed gain uses the voiced 20 ms frames; pauses do not make a phrase louder.
 * A shared, anticipatory limiter protects peaks without clipping the waveform,
 * moving samples or changing pitch. Every channel retains its original balance.
 */
export function normalizeClipLoudness(buffer: StretchAudioBuffer): StretchedAudio {
  if (!Number.isFinite(buffer.sampleRate) || buffer.sampleRate <= 0) throw new RangeError('Invalid sample rate')
  if (!Number.isInteger(buffer.length) || buffer.length < 0 || !Number.isInteger(buffer.numberOfChannels) || buffer.numberOfChannels < 1) {
    throw new RangeError('Invalid audio buffer')
  }
  const input = Array.from({ length: buffer.numberOfChannels }, (_, channel) => buffer.getChannelData(channel))
  if (input.some((channel) => channel.length < buffer.length)) throw new RangeError('Incomplete audio channel')
  const channels = input.map(() => new Float32Array(buffer.length))
  if (buffer.length === 0) return { sampleRate: buffer.sampleRate, length: 0, channels }

  // Measure one energetic channel rather than mixing stereo, which can cancel
  // opposite phases. Peaks still consider all channels to protect both ears.
  const envelope = new Float32Array(buffer.length)
  let reference = input[0]
  let mostEnergy = -1
  for (const channel of input) {
    let energy = 0
    for (let i = 0; i < buffer.length; i++) {
      const value = channel[i]
      if (!Number.isFinite(value)) throw new RangeError('Invalid audio sample')
      energy += value * value
      envelope[i] = Math.max(envelope[i], Math.abs(value))
    }
    if (energy > mostEnergy) { mostEnergy = energy; reference = channel }
  }

  const frameLength = Math.max(1, Math.round(buffer.sampleRate * 0.02))
  const powers: { energy: number; length: number }[] = []
  let highestPower = 0
  for (let start = 0; start < buffer.length; start += frameLength) {
    const end = Math.min(buffer.length, start + frameLength)
    let energy = 0
    for (let i = start; i < end; i++) energy += reference[i] * reference[i]
    const length = end - start
    powers.push({ energy, length })
    highestPower = Math.max(highestPower, energy / length)
  }

  let gain = 1
  if (highestPower >= SILENCE_POWER) {
    const gate = Math.max(SILENCE_POWER, highestPower * 0.01)
    let energy = 0
    let count = 0
    for (const frame of powers) {
      if (frame.energy / frame.length < gate) continue
      energy += frame.energy
      count += frame.length
    }
    const rms = Math.sqrt(energy / count)
    gain = Math.max(MIN_GAIN, Math.min(MAX_GAIN, TARGET_RMS / rms))
  }

  // Preparing the entire clip lets gain fall gently before a peak, so the
  // attack does not miss its first samples. Reverse smoothing has a 5 ms time
  // constant; forward recovery takes 50 ms. Neither pass delays the audio.
  const attack = Math.exp(-1 / (buffer.sampleRate * 0.005))
  const release = Math.exp(-1 / (buffer.sampleRate * 0.05))
  let nextGain = 1
  for (let i = buffer.length - 1; i >= 0; i--) {
    const level = envelope[i] * gain
    const ceiling = level > PEAK_CEILING ? PEAK_CEILING / level : 1
    const limited = Math.min(ceiling, 1 - (1 - nextGain) * attack)
    envelope[i] = limited
    nextGain = limited
  }
  let previousGain = 1
  for (let i = 0; i < buffer.length; i++) {
    const limited = Math.min(envelope[i], 1 - (1 - previousGain) * release)
    previousGain = limited
    for (let channel = 0; channel < input.length; channel++) channels[channel][i] = input[channel][i] * gain * limited
  }

  return { sampleRate: buffer.sampleRate, length: buffer.length, channels }
}
