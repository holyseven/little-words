/**
 * 音频解锁状态 hook：未解锁时 UI 需要显示「▶ 点我开始」而不是静默失败
 * （SPEC 10.2）。
 */

import { useEffect, useState } from 'react'
import { isAudioUnlocked, onAudioUnlockChange, unlockAudio } from '../audio/audioUnlock'

export function useAudioUnlocked(): { unlocked: boolean; unlock: () => void } {
  const [unlocked, setUnlocked] = useState(isAudioUnlocked)

  useEffect(() => {
    // 全局 pointerdown 监听器可能在本组件挂载前就已触发
    if (isAudioUnlocked()) {
      setUnlocked(true)
      return
    }
    return onAudioUnlockChange(setUnlocked)
  }, [])

  return { unlocked, unlock: unlockAudio }
}
