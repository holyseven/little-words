/**
 * TTS —— 仅作为预生成音频缺失时的兜底（SPEC 10.1）
 *
 * 人声主路径是 clips.ts 播放的预生成片段（macOS Ava Premium 渲染）。
 * 之所以不把 TTS 作为主路径：iOS Safari 的 Web Speech API 只暴露预装的
 * compact 档语音，用户下载的 Enhanced/Premium 拿不到（Apple 论坛
 * thread/723503 官方确认），音质是「词典腔」，且各设备发音不一致。
 *
 * 这里保留完整的 iOS 兼容处理，因为 M2 新增主题若忘了跑 `npm run audio`，
 * 兜底路径就是唯一的声音来源：
 *  - 每次 speak 前先 cancel()
 *  - voiceschanged 异步加载后才能确定语音
 *  - 回到前台时 cancel() 并重置状态
 *  - speaking 卡住 > 5 秒强制 cancel()
 *  - 队列化：同一时刻只有一条语句，新语句打断旧的
 */

const STUCK_TIMEOUT_MS = 5000

export interface SpeakOptions {
  rate?: number
  pitch?: number
  onEnd?: () => void
}

interface VoiceState {
  voices: SpeechSynthesisVoice[]
  chosen: SpeechSynthesisVoice | null
}

const state: VoiceState = { voices: [], chosen: null }

/** 家长页可改（M4）；这里是运行时生效的值 */
let preferredVoiceName: string | undefined
let defaultRate = 0.85

let stuckTimer: number | undefined
let currentOnEnd: (() => void) | undefined

function synth(): SpeechSynthesis | null {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
    ? window.speechSynthesis
    : null
}

export function isTTSSupported(): boolean {
  return synth() !== null
}

/* -------------------------------------------------------------------------- */
/* 语音选择                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 优选语音。名单里都是现代拼接合成，音质可接受。
 * 注意：iOS Safari 上大概率一个都拿不到，只能落到黑名单过滤后的兜底。
 */
const NICE_NAMES = [
  'samantha',
  'ava',
  'allison',
  'susan',
  'nicky',
  'aaron',
  'zoe',
  'evan',
  'nathan',
  'joelle',
]

/**
 * 绝不使用的语音：
 *  - 搞怪/特效音（Albert、Bad News、Zarvox…）——念单词像玩笑
 *  - Eloquence 家族（Eddy / Flo / Grandma / Grandpa / Reed / Rocko / Sandy /
 *    Shelley）——1980 年代共振峰合成，比词典腔更机械，孩子听不清
 *
 * 这个黑名单很重要：不加的话「任意 en-US」兜底在这台 Mac 上会选中
 * 按字母序排第一的 Albert。
 */
const BLOCKED_NAMES = [
  'albert',
  'bad news',
  'bahh',
  'bells',
  'boing',
  'bubbles',
  'cellos',
  'good news',
  'jester',
  'organ',
  'superstar',
  'trinoids',
  'whisper',
  'wobble',
  'zarvox',
  'fred',
  'junior',
  'kathy',
  'ralph',
  'eddy',
  'flo',
  'grandma',
  'grandpa',
  'reed',
  'rocko',
  'sandy',
  'shelley',
]

function isBlocked(v: SpeechSynthesisVoice): boolean {
  const name = v.name.toLowerCase()
  // 用 startsWith 而非 includes：语音名可能带地区后缀，如 'Eddy (English (US))'
  return BLOCKED_NAMES.some((b) => name === b || name.startsWith(`${b} `) || name.startsWith(`${b}(`))
}

function chooseVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null

  // 1. 家长指定（家长页明确选的，即使在黑名单里也尊重）
  if (preferredVoiceName) {
    const exact = voices.find((v) => v.name === preferredVoiceName)
    if (exact) return exact
  }

  const usable = voices.filter((v) => !isBlocked(v))
  const byLang = (list: SpeechSynthesisVoice[], prefix: string) =>
    list.filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith(prefix))

  const enUS = byLang(usable, 'en-us')

  // 2. en-US 里的优选名字
  const nice = enUS.find((v) => NICE_NAMES.some((n) => v.name.toLowerCase().includes(n)))
  if (nice) return nice

  // 3. 任意可用的 en-US
  if (enUS[0]) return enUS[0]

  // 4. en-GB / en-AU 等其它英语区（Daniel、Karen 等都比 Eloquence 好）
  const anyEn = byLang(usable, 'en')
  if (anyEn[0]) return anyEn[0]

  return null
}

function refreshVoices(): void {
  const s = synth()
  if (!s) return

  // 远程语音可能联网，离线应用只暴露设备内置语音。
  const voices = s.getVoices().filter((voice) => voice.localService)
  if (voices.length === 0) return

  state.voices = voices
  state.chosen = chooseVoice(voices)
}

/** 可用的英文语音列表，供家长页展示（M4） */
export function getEnglishVoices(): SpeechSynthesisVoice[] {
  return state.voices.filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith('en'))
}

/** 设备是否装了英文语音；没有时家长页要给出下载指引（SPEC 10.1） */
export function hasEnglishVoice(): boolean {
  // 语音列表可能还没加载完，此时不下「没有语音」的结论
  return state.voices.length === 0 || getEnglishVoices().length > 0
}

export function setVoiceName(name: string | undefined): void {
  preferredVoiceName = name
  state.chosen = chooseVoice(state.voices)
}

export function setRate(rate: number): void {
  defaultRate = rate
}

/* -------------------------------------------------------------------------- */
/* 朗读                                                                        */
/* -------------------------------------------------------------------------- */

function clearStuckTimer(): void {
  if (stuckTimer !== undefined) {
    window.clearTimeout(stuckTimer)
    stuckTimer = undefined
  }
}

/** 结束回调只跑一次：end / error / 卡死超时 三者竞争 */
function finish(): void {
  clearStuckTimer()
  const cb = currentOnEnd
  currentOnEnd = undefined
  cb?.()
}

export function cancelSpeech(): void {
  const s = synth()
  clearStuckTimer()
  currentOnEnd = undefined
  if (!s) return
  try {
    s.cancel()
  } catch {
    /* 忽略 */
  }
}

/**
 * 朗读一段英文。同一时刻只有一条语句在播，新语句会打断旧语句。
 * 不支持 TTS 或没有英文语音时静默返回，并立即触发 onEnd，
 * 让依赖 onEnd 推进流程的 UI 不会卡住。
 */
export function speak(text: string, opts: SpeakOptions = {}): void {
  const s = synth()
  if (!s || !text.trim()) {
    opts.onEnd?.()
    return
  }

  // 打断上一条（同时清掉它的 onEnd，避免旧回调误触发）
  cancelSpeech()
  refreshVoices()
  if (!state.chosen) { opts.onEnd?.(); return }

  const u = new SpeechSynthesisUtterance(text)
  if (state.chosen) {
    u.voice = state.chosen
    u.lang = state.chosen.lang
  } else {
    u.lang = 'en-US'
  }
  u.rate = opts.rate ?? defaultRate
  u.pitch = opts.pitch ?? 1.05
  u.volume = 1

  currentOnEnd = opts.onEnd

  u.onend = () => finish()
  u.onerror = () => finish()

  // iOS 上 speaking 偶发卡住：超时强制复位，避免后续朗读全部失效
  stuckTimer = window.setTimeout(() => {
    try {
      s.cancel()
    } catch {
      /* 忽略 */
    }
    finish()
  }, STUCK_TIMEOUT_MS + text.length * 60)

  try {
    s.speak(u)
  } catch {
    finish()
  }
}

/* -------------------------------------------------------------------------- */
/* 初始化                                                                      */
/* -------------------------------------------------------------------------- */

let initialized = false

/** 在 App 启动时调用一次 */
export function initTTS(): void {
  if (initialized) return
  initialized = true

  const s = synth()
  if (!s) return

  refreshVoices()
  // iOS/Safari 上语音列表异步就绪
  s.addEventListener('voiceschanged', refreshVoices)

  // 回到前台：cancel 并重置，否则 iOS 上后续 speak 会静默失败（SPEC 10.1 / 11.5）
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      cancelSpeech()
    } else {
      cancelSpeech()
      refreshVoices()
    }
  })

  // 页面隐藏（切 App / 锁屏）时停止朗读
  window.addEventListener('pagehide', cancelSpeech)
}
