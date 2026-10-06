import { describe, expect, it } from 'vitest'
import { timeStretch, type StretchAudioBuffer } from '../src/audio/timeStretch'

function buffer(channels: Float32Array[], sampleRate = 16_000): StretchAudioBuffer {
  return { sampleRate, numberOfChannels: channels.length, length: channels[0].length, getChannelData: (channel) => channels[channel] }
}

function tone(frequency: number, seconds = 1, sampleRate = 16_000): Float32Array {
  return Float32Array.from({ length: Math.round(seconds * sampleRate) }, (_, i) => 0.6 * Math.sin(2 * Math.PI * frequency * i / sampleRate))
}

/** Estimate from the crossing times rather than the algorithm's frame offsets. */
function frequencyOf(signal: Float32Array, sampleRate: number, from: number, to: number): number {
  const crossings: number[] = []
  for (let i = Math.max(1, Math.round(from * sampleRate)); i < Math.min(signal.length, Math.round(to * sampleRate)); i++) {
    if (signal[i - 1] <= 0 && signal[i] > 0) crossings.push(i - 1 - signal[i - 1] / (signal[i] - signal[i - 1]))
  }
  return (crossings.length - 1) * sampleRate / (crossings[crossings.length - 1] - crossings[0])
}

describe('短语音保持音高的速度调整', () => {
  it.each([0.7 / 0.85, 0.85, 1 / 0.85])('时长对应播放倍率 %s，基频保持原声', (rate) => {
    for (const frequency of [85, 220, 437]) {
      const source = buffer([tone(frequency)])
      const stretched = timeStretch(source, rate)
      expect(stretched.length).toBe(Math.round(source.length / rate))
      expect(stretched.channels[0]).toHaveLength(stretched.length)
      const measured = frequencyOf(stretched.channels[0], stretched.sampleRate, 0.1, stretched.length / stretched.sampleRate - 0.1)
      expect(Math.abs(measured - frequency)).toBeLessThan(frequency * 0.015)
      expect(stretched.channels[0].every(Number.isFinite)).toBe(true)
    }
  })

  it('原速直接复用样本，不改音质也不额外分配音频', () => {
    const samples = tone(220)
    const result = timeStretch(buffer([samples]), 1)
    expect(result.channels[0]).toBe(samples)
    expect(result.length).toBe(samples.length)
  })

  it('不同音节与中间停顿按时序伸长，保留前后不同的声音', () => {
    const sampleRate = 16_000
    const samples = Float32Array.from({ length: sampleRate }, (_, i) => {
      const time = i / sampleRate
      if (time >= 0.4 && time < 0.6) return 0
      const frequency = time < 0.4 ? 180 : 320
      return 0.5 * Math.sin(2 * Math.PI * frequency * time)
    })
    const rate = 0.7 / 0.85
    const output = timeStretch(buffer([samples]), rate).channels[0]
    expect(frequencyOf(output, sampleRate, 0.1 / rate, 0.3 / rate)).toBeCloseTo(180, 0)
    expect(frequencyOf(output, sampleRate, 0.7 / rate, 0.9 / rate)).toBeCloseTo(320, 0)
    const silence = output.subarray(Math.round(0.46 * sampleRate / rate), Math.round(0.54 * sampleRate / rate))
    expect(silence.every((value) => value === 0)).toBe(true)
    expect(output.slice(0, 200)).toEqual(samples.slice(0, 200))
    expect(output.slice(-200)).toEqual(samples.slice(-200))
  })

  it('立体声共享时间偏移，反相和音量关系保持不变', () => {
    const left = tone(240, 0.4)
    const right = Float32Array.from(left, (value) => value * -0.5)
    const silent = new Float32Array(left.length)
    const result = timeStretch(buffer([silent, left, right]), 0.8)
    expect(result.channels[0].every((value) => value === 0)).toBe(true)
    for (let i = 0; i < result.length; i++) expect(result.channels[2][i]).toBeCloseTo(result.channels[1][i] * -0.5, 7)
  })

  it.each([1, 2, 7, 37, 160, 800])('短音频 %i 个样本不会越界或产生 NaN', (length) => {
    const samples = Float32Array.from({ length }, (_, i) => Math.sin(i * 0.4) * 0.6)
    for (const rate of [0.7 / 0.85, 0.85, 1 / 0.85]) {
      const result = timeStretch(buffer([samples]), rate)
      expect(result.channels[0]).toHaveLength(Math.max(1, Math.round(length / rate)))
      expect(result.channels[0].every((value) => Number.isFinite(value) && Math.abs(value) <= 0.6)).toBe(true)
    }
  })

  it.each([8_000, 44_100, 48_000])('采样率 %i 下基频也保持，输入样本不被覆盖', (sampleRate) => {
    const samples = tone(230, 0.5, sampleRate)
    const original = samples.slice()
    const output = timeStretch(buffer([samples], sampleRate), 0.85)
    expect(frequencyOf(output.channels[0], sampleRate, 0.08, 0.45)).toBeCloseTo(230, 0)
    expect(samples).toEqual(original)
  })

  it('静音和恒定样本不会导致相关系数除零', () => {
    for (const value of [0, 0.25]) {
      const output = timeStretch(buffer([new Float32Array(2_000).fill(value)]), 0.85)
      expect(output.channels[0].every((sample) => sample === value)).toBe(true)
    }
    expect(timeStretch(buffer([new Float32Array()]), 0.85).length).toBe(0)
  })

  it.each([0, -1, NaN, Infinity])('无效倍率 %s 被拒绝', (rate) => {
    expect(() => timeStretch(buffer([tone(220, 0.1)]), rate)).toThrow(RangeError)
  })

  it('拒绝不完整音频通道和无法分配的时长', () => {
    const source = buffer([tone(220, 0.1)])
    expect(() => timeStretch({ ...source, numberOfChannels: 2, getChannelData: () => new Float32Array(5) }, 0.85)).toThrow(RangeError)
    expect(() => timeStretch({ ...source, sampleRate: 0 }, 0.85)).toThrow(RangeError)
    expect(() => timeStretch(source, Number.MIN_VALUE)).toThrow(RangeError)
  })
})
