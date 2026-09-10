/**
 * 合成音效（SPEC 10.4）—— 全部用 Web Audio API 生成，不打包任何音效文件。
 *
 * 硬性要求：软起音 attack ≥ 5ms、软释音 release ≥ 60ms、主增益 ≤ 0.4，避免爆音。
 * 错误提示必须温和（SPEC 5.2：不用刺耳声音），所以 wrong 的增益只有 0.2。
 */

import { getAudioContext, isAudioUnlocked } from './audioUnlock'

/** 主增益上限（SPEC 10.4） */
const MASTER_GAIN = 0.4

/** 家长页可整体关闭音效（M4） */
let enabled = true

export function setSfxEnabled(on: boolean): void {
  enabled = on
}

export function isSfxEnabled(): boolean {
  return enabled
}

/* -------------------------------------------------------------------------- */
/* 基础工具                                                                    */
/* -------------------------------------------------------------------------- */

interface ToneOptions {
  /** 起始频率 Hz */
  freq: number
  /** 结束频率 Hz，用于滑音；省略则恒定 */
  toFreq?: number
  /** 时长秒 */
  duration: number
  type?: OscillatorType
  /** 峰值增益，最终会被 MASTER_GAIN 限制 */
  gain?: number
  /** 相对当前时间的起播延迟（秒） */
  delay?: number
}

/**
 * 播放一个带软起音/软释音包络的单音。
 * attack 6ms、release 至少 60ms —— 这是不爆音的关键。
 */
function tone(ctx: AudioContext, o: ToneOptions): void {
  const attack = 0.006
  const release = Math.max(0.06, o.duration * 0.5)
  const peak = Math.min(o.gain ?? 0.3, MASTER_GAIN)
  const start = ctx.currentTime + (o.delay ?? 0)
  const sustainEnd = start + Math.max(o.duration, attack + 0.01)
  const stop = sustainEnd + release

  const osc = ctx.createOscillator()
  osc.type = o.type ?? 'sine'
  osc.frequency.setValueAtTime(o.freq, start)
  if (o.toFreq !== undefined) {
    // 指数滑音听起来比线性更自然；频率必须 > 0
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.toFreq), sustainEnd)
  }

  const env = ctx.createGain()
  env.gain.setValueAtTime(0.0001, start)
  env.gain.exponentialRampToValueAtTime(peak, start + attack)
  env.gain.exponentialRampToValueAtTime(0.0001, stop)

  osc.connect(env).connect(ctx.destination)
  osc.start(start)
  osc.stop(stop + 0.02)
}

/** 生成一段白噪声 buffer（pop 的爆裂感、celebrate 的"闪光"都靠它） */
function noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds))
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  return buf
}

interface NoiseOptions {
  duration: number
  gain?: number
  /** 带通中心频率 */
  filterHz?: number
  /** 带通 Q 值，越大越"窄"越像撞击 */
  q?: number
  filterType?: BiquadFilterType
  delay?: number
}

function noise(ctx: AudioContext, o: NoiseOptions): void {
  const start = ctx.currentTime + (o.delay ?? 0)
  const peak = Math.min(o.gain ?? 0.2, MASTER_GAIN)
  const stop = start + o.duration + 0.06

  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer(ctx, o.duration + 0.06)

  const env = ctx.createGain()
  env.gain.setValueAtTime(0.0001, start)
  env.gain.exponentialRampToValueAtTime(peak, start + 0.005)
  env.gain.exponentialRampToValueAtTime(0.0001, stop)

  if (o.filterHz) {
    const filter = ctx.createBiquadFilter()
    filter.type = o.filterType ?? 'bandpass'
    filter.frequency.value = o.filterHz
    filter.Q.value = o.q ?? 1
    src.connect(filter).connect(env).connect(ctx.destination)
  } else {
    src.connect(env).connect(ctx.destination)
  }

  src.start(start)
  src.stop(stop + 0.02)
}

/** 取到可用且已解锁的 AudioContext，否则返回 null（静默跳过） */
function ready(): AudioContext | null {
  if (!enabled || !isAudioUnlocked()) return null

  const ctx = getAudioContext()
  if (!ctx) return null

  // 系统中断（来电、切后台）后可能又变回 suspended
  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => undefined)
  }
  return ctx
}

/* -------------------------------------------------------------------------- */
/* 音效（SPEC 10.4 表格）                                                      */
/* -------------------------------------------------------------------------- */

/** 音名 → 频率（十二平均律，A4 = 440Hz） */
const C5 = 523.25
const E5 = 659.25
const G5 = 783.99
const C6 = 1046.5

/** 每次点击的轻柔反馈：正弦波 660Hz，60ms */
export function playTap(): void {
  const ctx = ready()
  if (!ctx) return
  tone(ctx, { freq: 660, duration: 0.06, type: 'sine', gain: 0.22 })
}

/** 答对：三角波琶音 C5→E5→G5，每音 90ms */
export function playCorrect(): void {
  const ctx = ready()
  if (!ctx) return
  const step = 0.09
  ;[C5, E5, G5].forEach((freq, i) => {
    tone(ctx, { freq, duration: step, type: 'triangle', gain: 0.26, delay: i * step })
  })
}

/**
 * 答错：三角波 220Hz→180Hz 下滑 150ms，增益 0.2。
 * 刻意做得很轻柔 —— SPEC 4.2「零挫败」，不能让孩子觉得被否定。
 */
export function playWrong(): void {
  const ctx = ready()
  if (!ctx) return
  tone(ctx, { freq: 220, toFreq: 180, duration: 0.15, type: 'triangle', gain: 0.2 })
}

/** 庆祝：快速上行琶音 C5-E5-G5-C6 + 高频「闪光」噪声 300ms */
export function playCelebrate(): void {
  const ctx = ready()
  if (!ctx) return
  const step = 0.075
  ;[C5, E5, G5, C6].forEach((freq, i) => {
    tone(ctx, { freq, duration: step, type: 'triangle', gain: 0.24, delay: i * step })
  })
  // 闪光：高频窄带噪声，叠在琶音上方
  noise(ctx, { duration: 0.3, gain: 0.1, filterHz: 6000, q: 0.8, delay: step })
}

/** 泡泡破裂：带通白噪声 40ms + 正弦 900Hz→300Hz 下滑 */
export function playPop(): void {
  const ctx = ready()
  if (!ctx) return
  noise(ctx, { duration: 0.04, gain: 0.22, filterHz: 1400, q: 1.4 })
  tone(ctx, { freq: 900, toFreq: 300, duration: 0.07, type: 'sine', gain: 0.2 })
}

/** 翻牌：正弦 400Hz→800Hz 上滑 80ms */
export function playFlip(): void {
  const ctx = ready()
  if (!ctx) return
  tone(ctx, { freq: 400, toFreq: 800, duration: 0.08, type: 'sine', gain: 0.2 })
}

/** 获得贴纸：celebrate + 铃声（正弦 1320Hz 衰减 400ms） */
export function playSticker(): void {
  const ctx = ready()
  if (!ctx) return
  playCelebrate()
  tone(ctx, { freq: 1320, duration: 0.4, type: 'sine', gain: 0.16, delay: 0.12 })
}

export type SfxName = 'tap' | 'correct' | 'wrong' | 'celebrate' | 'pop' | 'flip' | 'sticker'

const PLAYERS: Record<SfxName, () => void> = {
  tap: playTap,
  correct: playCorrect,
  wrong: playWrong,
  celebrate: playCelebrate,
  pop: playPop,
  flip: playFlip,
  sticker: playSticker,
}

export function playSfx(name: SfxName): void {
  PLAYERS[name]()
}
