/** The part of AudioBuffer needed to prepare a clip; also usable without Web Audio. */
export interface StretchAudioBuffer {
  sampleRate: number
  length: number
  numberOfChannels: number
  getChannelData(channel: number): Float32Array
}

export interface StretchedAudio {
  sampleRate: number
  length: number
  channels: Float32Array[]
}

/**
 * Change a short spoken clip's duration without changing its pitch (WSOLA).
 * The returned samples should be played at playbackRate = 1. A rate below 1
 * makes a longer clip. Cache the result when a child repeats the same word.
 * All channels use the same frame positions, so stereo stays in phase.
 */
export function timeStretch(buffer: StretchAudioBuffer, playbackRate: number): StretchedAudio {
  if (!Number.isFinite(playbackRate) || playbackRate <= 0) throw new RangeError('Invalid playback rate')
  if (!Number.isFinite(buffer.sampleRate) || buffer.sampleRate <= 0) throw new RangeError('Invalid sample rate')
  if (!Number.isInteger(buffer.length) || buffer.length < 0 || !Number.isInteger(buffer.numberOfChannels) || buffer.numberOfChannels < 1) {
    throw new RangeError('Invalid audio buffer')
  }

  const input = Array.from({ length: buffer.numberOfChannels }, (_, channel) => buffer.getChannelData(channel))
  if (input.some((channel) => channel.length < buffer.length)) throw new RangeError('Incomplete audio channel')
  const length = buffer.length === 0 ? 0 : Math.max(1, Math.round(buffer.length / playbackRate))
  if (!Number.isSafeInteger(length) || length > 0x7fffffff) throw new RangeError('Audio duration is too large')
  if (playbackRate === 1 || buffer.length === 0) return { sampleRate: buffer.sampleRate, length, channels: input }

  const channels = input.map(() => new Float32Array(length))
  // About 40 ms per frame: long enough to contain speech pitch periods, while
  // keeping the alignment search cheap enough for an iPad's main thread.
  const hop = Math.max(1, Math.min(Math.round(buffer.sampleRate * 0.02), Math.floor(Math.min(buffer.length, length) / 4)))
  const frameLength = Math.min(hop * 2, buffer.length, length)
  const finalPosition = length - frameLength
  const lastInputPosition = buffer.length - frameLength
  const searchRadius = Math.max(1, Math.round(buffer.sampleRate * 0.01))
  const stride = Math.max(1, Math.round(buffer.sampleRate / 12_000))

  // Choose one energetic channel for alignment instead of averaging channels
  // that may cancel each other. Alignment is then shared by every channel.
  let alignmentChannel = 0
  let mostEnergy = -1
  for (let channel = 0; channel < input.length; channel++) {
    let energy = 0
    for (let i = 0; i < buffer.length; i += stride) energy += input[channel][i] * input[channel][i]
    if (energy > mostEnergy) { alignmentChannel = channel; mostEnergy = energy }
    channels[channel].set(input[channel].subarray(0, frameLength))
  }

  let previousPosition = 0
  for (let position = Math.min(hop, finalPosition); position > 0; position = Math.min(position + hop, finalPosition)) {
    const overlap = previousPosition + frameLength - position
    const expected = Math.min(lastInputPosition, Math.round(position * playbackRate))
    // Pin the final frame to the original ending. Spoken clips usually have a
    // quiet tail; retaining it avoids repeating or chopping off the last sound.
    const sourcePosition = position === finalPosition
      ? lastInputPosition
      : bestAlignment(input[alignmentChannel], channels[alignmentChannel], position, overlap, expected, lastInputPosition, searchRadius, stride)

    for (let channel = 0; channel < channels.length; channel++) {
      const source = input[channel]
      const output = channels[channel]
      for (let i = 0; i < overlap; i++) {
        const blend = (1 - Math.cos(Math.PI * (i + 1) / (overlap + 1))) / 2
        output[position + i] = output[position + i] * (1 - blend) + source[sourcePosition + i] * blend
      }
      output.set(source.subarray(sourcePosition + overlap, sourcePosition + frameLength), position + overlap)
    }
    previousPosition = position
    if (position === finalPosition) break
  }
  return { sampleRate: buffer.sampleRate, length, channels }
}

function bestAlignment(
  source: Float32Array,
  output: Float32Array,
  position: number,
  overlap: number,
  expected: number,
  lastInputPosition: number,
  searchRadius: number,
  stride: number,
): number {
  let sum = 0
  let squares = 0
  let count = 0
  for (let i = 0; i < overlap; i += stride) {
    const value = output[position + i]
    sum += value
    squares += value * value
    count++
  }
  const mean = sum / count
  const energy = squares - sum * mean
  if (energy <= 1e-12) return expected

  const first = Math.max(0, expected - searchRadius)
  const last = Math.min(lastInputPosition, expected + searchRadius)
  let bestPosition = expected
  let bestScore = -Infinity
  const score = (candidate: number) => {
    let candidateSum = 0
    let candidateSquares = 0
    let dot = 0
    for (let i = 0; i < overlap; i += stride) {
      const value = source[candidate + i]
      candidateSum += value
      candidateSquares += value * value
      dot += value * output[position + i]
    }
    const candidateEnergy = candidateSquares - candidateSum * candidateSum / count
    if (candidateEnergy <= 1e-12) return
    // A small distance penalty resolves near-identical periodic matches in
    // favor of the requested timing, preventing repeated syllables from drift.
    const distance = (candidate - expected) / searchRadius
    const value = (dot - mean * candidateSum) / Math.sqrt(energy * candidateEnergy) - 0.003 * distance * distance
    if (value > bestScore) { bestScore = value; bestPosition = candidate }
  }
  score(expected)
  for (let candidate = first; candidate <= last; candidate += stride) score(candidate)
  const coarsePosition = bestPosition
  for (let candidate = Math.max(first, coarsePosition - stride + 1); candidate <= Math.min(last, coarsePosition + stride - 1); candidate++) score(candidate)
  return bestPosition
}
