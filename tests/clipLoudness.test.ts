import { describe, expect, it } from 'vitest'
import { normalizeClipLoudness } from '../src/audio/loudness'
import type { StretchAudioBuffer } from '../src/audio/timeStretch'

function buffer(channels: Float32Array[], sampleRate = 16_000): StretchAudioBuffer {
  return { sampleRate, numberOfChannels: channels.length, length: channels[0].length, getChannelData: (channel) => channels[channel] }
}

function tone(frequency: number, amplitude: number, sampleRate = 16_000): Float32Array {
  return Float32Array.from({ length: sampleRate }, (_, i) => amplitude * Math.sin(2 * Math.PI * frequency * i / sampleRate))
}

function rms(samples: Float32Array): number {
  return Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length)
}

function decibels(level: number): number { return 20 * Math.log10(level) }

function frequencyOf(samples: Float32Array, sampleRate: number): number {
  const crossings: number[] = []
  for (let i = Math.round(sampleRate * 0.1); i < Math.round(sampleRate * 0.9); i++) {
    if (samples[i - 1] <= 0 && samples[i] > 0) crossings.push(i - 1 - samples[i - 1] / (samples[i] - samples[i - 1]))
  }
  return (crossings.length - 1) * sampleRate / (crossings[crossings.length - 1] - crossings[0])
}

describe('短语音响度校准', () => {
  it('响亮和轻声片段收敛到相近响度，轻声最多放大两倍', () => {
    const quiet = tone(230, 0.1)
    const loud = tone(230, 0.3)
    const normalizedQuiet = normalizeClipLoudness(buffer([quiet])).channels[0]
    const normalizedLoud = normalizeClipLoudness(buffer([loud])).channels[0]
    expect(decibels(rms(loud)) - decibels(rms(quiet))).toBeGreaterThan(9)
    expect(Math.abs(decibels(rms(normalizedLoud)) - decibels(rms(normalizedQuiet)))).toBeLessThan(1.2)
    expect(decibels(rms(normalizedLoud))).toBeCloseTo(-16, 4)
    expect(rms(normalizedQuiet)).toBeCloseTo(rms(quiet) * 2, 7)
  })

  it.each([8_000, 22_050, 44_100, 48_000])('采样率 %i 保持音高、时长和输入样本', (sampleRate) => {
    const original = tone(217, 0.12, sampleRate)
    const copy = original.slice()
    const result = normalizeClipLoudness(buffer([original], sampleRate))
    expect(result.sampleRate).toBe(sampleRate)
    expect(result.length).toBe(original.length)
    expect(result.channels[0]).toHaveLength(original.length)
    expect(result.channels[0]).not.toBe(original)
    expect(frequencyOf(result.channels[0], sampleRate)).toBeCloseTo(217, 4)
    expect(original).toEqual(copy)
  })

  it('轻声中的爆破峰值受限，提前柔和降低增益并缓慢恢复', () => {
    const original = tone(200, 0.09)
    // A short consonant-like transient over an otherwise quiet voice.
    original[8_001] = 0.89
    const result = normalizeClipLoudness(buffer([original])).channels[0]
    expect(Math.max(...Array.from(result, Math.abs))).toBeLessThanOrEqual(0.92)
    expect(result[8_001]).toBeGreaterThan(0.91)
    const gainAt = (i: number) => result[i] / original[i]
    expect(gainAt(7_985)).toBeLessThan(gainAt(7_905))
    expect(gainAt(8_025)).toBeLessThan(gainAt(8_105))
    expect(gainAt(7_985)).toBeGreaterThan(gainAt(8_001))
    // Gain follows a smooth envelope, rather than hard-flattening the samples.
    const gains = Array.from({ length: 159 }, (_, j) => gainAt(7_921 + j)).filter(Number.isFinite)
    for (let i = 1; i < gains.length; i++) expect(Math.abs(gains[i] - gains[i - 1])).toBeLessThan(0.04)
    expect(frequencyOf(result, 16_000)).toBeCloseTo(200, 4)
  })

  it('静音和短停顿保留，停顿不会把同一句话放得更大', () => {
    const voice = tone(220, 0.14)
    const withPauses = new Float32Array(voice.length + 16_000)
    withPauses.set(voice, 8_000)
    const plain = normalizeClipLoudness(buffer([voice])).channels[0]
    const paused = normalizeClipLoudness(buffer([withPauses])).channels[0]
    expect(paused.subarray(0, 8_000).every((value) => value === 0)).toBe(true)
    expect(paused.subarray(24_000).every((value) => value === 0)).toBe(true)
    expect(paused.subarray(8_000, 24_000)).toEqual(plain)
  })

  it('多声道共用相同增益和限幅包络，反相不会消失', () => {
    const left = tone(230, 0.09)
    left[4_000] = 0.89
    const right = Float32Array.from(left, (value) => value * -0.5)
    const silence = new Float32Array(left.length)
    const result = normalizeClipLoudness(buffer([silence, left, right]))
    expect(result.channels).toHaveLength(3)
    expect(result.channels[0].every((value) => value === 0)).toBe(true)
    for (let i = 0; i < result.length; i++) expect(result.channels[2][i]).toBeCloseTo(result.channels[1][i] * -0.5, 7)
    expect(Math.max(...Array.from(result.channels[1], Math.abs))).toBeLessThanOrEqual(0.92)
  })

  it.each([0, 1, 17, 400])('静音和极轻底噪（%i 个样本）不被放大或产生 NaN', (length) => {
    for (const value of [0, 0.0004]) {
      const source = new Float32Array(length).fill(value)
      const result = normalizeClipLoudness(buffer([source])).channels[0]
      expect(result).toEqual(source)
      expect(result.every(Number.isFinite)).toBe(true)
    }
  })

  it('较响片段的固定衰减有下限，额外峰值由限幅保护', () => {
    const source = tone(200, 0.9)
    const result = normalizeClipLoudness(buffer([source])).channels[0]
    expect(rms(result)).toBeCloseTo(rms(source) * 0.4, 7)
    expect(Math.max(...Array.from(result, Math.abs))).toBeLessThanOrEqual(0.92)
  })

  it('无效采样率、声道、样本被拒绝', () => {
    const source = buffer([tone(220, 0.1)])
    expect(() => normalizeClipLoudness({ ...source, sampleRate: 0 })).toThrow(RangeError)
    expect(() => normalizeClipLoudness({ ...source, length: -1 })).toThrow(RangeError)
    expect(() => normalizeClipLoudness({ ...source, numberOfChannels: 0 })).toThrow(RangeError)
    expect(() => normalizeClipLoudness({ ...source, getChannelData: () => new Float32Array(1) })).toThrow(RangeError)
    expect(() => normalizeClipLoudness(buffer([new Float32Array([NaN])]))).toThrow(RangeError)
  })
})
