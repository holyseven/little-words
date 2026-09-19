/**
 * 音频片段播放（替代运行时 TTS 朗读人声）
 *
 * 片段由 `npm run audio` 用 macOS 的 Ava (Premium) 预生成，见 scripts/gen-audio.mjs。
 * 走 Web Audio 而不是 <audio>：
 *  - 复用已解锁的 AudioContext，绕开 iOS 对 <audio> 自动播放的限制
 *  - 解码后缓存在内存，重复朗读同一个词零延迟（孩子会反复点）
 *  - 能精确知道播放结束，用于驱动 UI 流程
 *
 * 片段缺失时回落到 speechSynthesis（M2 加新主题忘了跑脚本也不会没声音）。
 */

import manifest from '../content/audioManifest.json'
import { getAudioContext, isAudioUnlocked } from './audioUnlock'
import { speak, cancelSpeech } from './tts'

interface ClipMeta {
  hash: string
  text: string
  durationMs: number
}

const clips = manifest.clips as Record<string, ClipMeta>

/** Vite 的 base，部署到子路径时 public/ 资源前缀会跟着变 */
const BASE = import.meta.env.BASE_URL

type ClipKind = 'w' | 's' | 'p'

/** 已解码的音频，key 与 manifest 一致 */
const decoded = new Map<string, AudioBuffer>()
/** 正在解码的 promise，避免同一片段并发请求两次 */
const inflight = new Map<string, Promise<AudioBuffer | null>>()

/** 当前正在播的片段，新的播放会打断它（同一时刻只有一个人声） */
let current: { source: AudioBufferSourceNode } | null = null
/** stop / 新请求都会使尚在下载或解码的旧请求失效。 */
let generation = 0
let activePlayback: { id: number; onCancel?: () => void } | null = null
let sequenceTimer: ReturnType<typeof setTimeout> | null = null
let playbackRate = 1
export function setClipRate(rate: number): void { playbackRate = Math.max(0.7, Math.min(1, rate)) / 0.85 }

export function clipId(kind: ClipKind, id: string): string {
  return `${kind}/${id}`
}

export function hasClip(kind: ClipKind, id: string): boolean {
  return clipId(kind, id) in clips
}

/** 台词文本 → 文件名，规则必须与 gen-audio.mjs 里的 slug() 一致 */
export function phraseId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
}

async function load(key: string): Promise<AudioBuffer | null> {
  const cached = decoded.get(key)
  if (cached) return cached

  const pending = inflight.get(key)
  if (pending) return pending

  const ctx = getAudioContext()
  if (!ctx) return null

  const task = (async () => {
    try {
      const res = await fetch(`${BASE}audio/${key}.m4a`)
      if (!res.ok) return null

      const bytes = await res.arrayBuffer()
      // Safari 老版本只支持回调式 decodeAudioData，这里包一层
      const buf = await new Promise<AudioBuffer>((resolve, reject) => {
        const ret = ctx.decodeAudioData(bytes, resolve, reject)
        // 现代浏览器返回 promise；两种都兼容
        if (ret && typeof ret.then === 'function') ret.then(resolve, reject)
      })

      decoded.set(key, buf)
      return buf
    } catch (err) {
      console.warn('[clips] 解码失败', key, err)
      return null
    } finally {
      inflight.delete(key)
    }
  })()

  inflight.set(key, task)
  return task
}

/** 停止当前人声（切页、打断时调用） */
export function stopClip(): void {
  generation++
  const cancelled = activePlayback
  activePlayback = null
  if (sequenceTimer !== null) {
    clearTimeout(sequenceTimer)
    sequenceTimer = null
  }
  if (current) {
    const { source } = current
    current = null
    // 先摘掉 onended 再 stop，避免 stop 触发的回调被当成正常播完
    source.onended = null
    try {
      source.stop()
    } catch {
      /* 已经停了 */
    }
  }
  cancelSpeech()
  cancelled?.onCancel?.()
}

export interface PlayOptions {
  onEnd?: () => void
  /** 被其他人声或 stop 打断；与正常完成回调互斥。 */
  onCancel?: () => void
  /** 音频文件缺失时用于 TTS 兜底的文本 */
  fallbackText?: string
}

/**
 * 播放一个片段。同一时刻只有一条人声，新的会打断旧的。
 * 正常播放完成时调用 onEnd；被新语音或切页取消的请求不触发完成回调。
 */
export async function playClip(key: string, opts: PlayOptions = {}): Promise<void> {
  stopClip()
  const requestId = generation
  activePlayback = { id: requestId, onCancel: opts.onCancel }
  await playInRequest(key, { ...opts, onEnd: () => finishPlayback(requestId, opts.onEnd) }, requestId)
}

export interface SequenceClip {
  key: string
  fallbackText?: string
}

/**
 * 按顺序朗读已有片段，词间留 250ms 给孩子听清。
 * 整段共用一个请求编号：任何新的人声或 stop 都会取消后面的词。
 */
export async function playClipSequence(items: readonly SequenceClip[], opts: PlayOptions = {}): Promise<void> {
  stopClip()
  const requestId = generation
  activePlayback = { id: requestId, onCancel: opts.onCancel }
  const queue = items.map((item) => ({ ...item }))
  let index = 0

  const playNext = async (): Promise<void> => {
    if (requestId !== generation) return
    const item = queue[index++]
    if (!item) {
      finishPlayback(requestId, opts.onEnd)
      return
    }
    await playInRequest(item.key, {
      fallbackText: item.fallbackText,
      onEnd: () => {
        if (index === queue.length) {
          finishPlayback(requestId, opts.onEnd)
          return
        }
        // 即使 TTS 不可用、同步调用 onEnd，也不递归启动下一条。
        sequenceTimer = setTimeout(() => {
          sequenceTimer = null
          void playNext()
        }, 250)
      },
    }, requestId)
  }

  await playNext()
}

function finishPlayback(requestId: number, onEnd?: () => void): void {
  if (requestId !== generation || activePlayback?.id !== requestId) return
  activePlayback = null
  onEnd?.()
}

/** 播放序列中的一项，不创建新请求，也不会取消同一序列。 */
async function playInRequest(key: string, opts: PlayOptions, requestId: number): Promise<void> {
  if (requestId !== generation) return
  let ended = false
  const finish = () => {
    if (ended || requestId !== generation) return
    ended = true
    opts.onEnd?.()
  }
  const useFallback = () => fallback({ ...opts, onEnd: finish })

  const ctx = getAudioContext()

  // 音频未解锁前 AudioContext 是 suspended，播了也没声；交给调用方的解锁 UI 处理
  if (!ctx || !isAudioUnlocked() || !(key in clips)) {
    useFallback()
    return
  }

  // 首次点击的音频恢复是异步的；确认设备已就绪再播放。
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume()
    } catch {
      // 下面的状态检查会转入 TTS 兜底，不让播放流程卡住。
    }
  }
  if (requestId !== generation) return
  if (ctx.state !== 'running') {
    useFallback()
    return
  }

  const buf = await load(key)
  // 必须在失败兜底之前检查：旧请求失败后也不能突然开始 TTS。
  if (requestId !== generation) return
  // 解码会跨过一个或多个任务队列；iPad Safari 可能在这段时间把
  // AudioContext 标回 suspended/interrupted。再次 resume，避免首个或
  // 偶发的片段在一个未完全唤醒的输出通道里以很小音量开始播放。
  if (ctx.state !== 'running') {
    try {
      await ctx.resume()
    } catch {
      // 状态检查会把无法恢复的设备交给原有的 TTS 兜底。
    }
  }
  if (requestId !== generation) return
  if (ctx.state !== 'running') {
    useFallback()
    return
  }
  if (!buf) {
    useFallback()
    return
  }

  const source = ctx.createBufferSource()
  source.buffer = buf
  source.playbackRate.value = playbackRate
  source.connect(ctx.destination)

  const entry = { source }
  current = entry

  source.onended = () => {
    if (current === entry) current = null
    finish()
  }

  source.start()
}

function fallback(opts: PlayOptions): void {
  if (opts.fallbackText) {
    speak(opts.fallbackText, { onEnd: opts.onEnd })
  } else {
    opts.onEnd?.()
  }
}

/** 预解码若干片段，减少首次点击的延迟 */
export function preloadClips(keys: string[]): void {
  if (!isAudioUnlocked()) return
  for (const key of keys) {
    if (key in clips && !decoded.has(key)) void load(key)
  }
}

/** 生成音频用的语音名，家长页展示用 */
export const audioVoiceName = manifest.voice as string
