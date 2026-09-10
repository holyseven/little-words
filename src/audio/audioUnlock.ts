/**
 * 音频解锁（SPEC 10.2）
 *
 * iOS Safari 要求音频必须由用户手势启动。这里在全局第一次 pointerdown 时
 * 一次性完成：resume AudioContext + TTS 预热（朗读一个空格）。
 * 解锁前需要自动播放的地方应显示「▶ 点我开始」，而不是静默失败。
 */

type Listener = (unlocked: boolean) => void

let unlocked = false
let ctx: AudioContext | null = null
const listeners = new Set<Listener>()

/** 懒创建共享 AudioContext；sfx.ts 复用同一个实例 */
export function getAudioContext(): AudioContext | null {
  if (ctx) return ctx

  const Ctor: typeof AudioContext | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

  if (!Ctor) return null

  try {
    ctx = new Ctor()
  } catch {
    return null
  }
  return ctx
}

export function isAudioUnlocked(): boolean {
  return unlocked
}

export function onAudioUnlockChange(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function markUnlocked() {
  if (unlocked) return
  unlocked = true
  for (const fn of listeners) fn(true)
}

/**
 * 在用户手势中调用：恢复 AudioContext 并预热 TTS。
 * 可重复调用（例如「▶ Start」按钮），幂等。
 */
export function unlockAudio(): void {
  const audioCtx = getAudioContext()

  if (audioCtx) {
    if (audioCtx.state === 'suspended') {
      // 手势上下文里 resume 才会成功；失败也不阻塞 TTS 预热
      void audioCtx.resume().catch(() => undefined)
    }

    // 播一个 0 音量的极短音，某些 iOS 版本靠这一步真正打开音频通道
    try {
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      gain.gain.value = 0
      osc.connect(gain).connect(audioCtx.destination)
      osc.start()
      osc.stop(audioCtx.currentTime + 0.01)
    } catch {
      /* 忽略：不影响后续音效 */
    }
  }

  primeSpeech()
  markUnlocked()
}

/** 朗读一个空格，让 iOS 的 speechSynthesis 在手势内完成初始化 */
function primeSpeech(): void {
  const synth = window.speechSynthesis
  if (!synth) return

  try {
    synth.cancel()
    const u = new SpeechSynthesisUtterance(' ')
    u.volume = 0
    u.rate = 1
    synth.speak(u)
  } catch {
    /* 忽略 */
  }
}

/**
 * 安装全局解锁监听：首个 pointerdown 触发后自行移除。
 * capture 阶段监听，保证在任何 stopPropagation 之前拿到事件。
 */
export function installAudioUnlock(): void {
  if (unlocked) return

  const handler = () => {
    unlockAudio()
    window.removeEventListener('pointerdown', handler, true)
    window.removeEventListener('touchstart', handler, true)
    window.removeEventListener('keydown', handler, true)
  }

  window.addEventListener('pointerdown', handler, true)
  // 兜底：极老的 iOS 上 pointerdown 可能缺失
  window.addEventListener('touchstart', handler, true)
  window.addEventListener('keydown', handler, true)
}
