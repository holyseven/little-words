import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'

import './styles/tokens.css'
import './styles/global.css'
import { App } from './App'
import { installAudioUnlock } from './audio/audioUnlock'
import { initTTS } from './audio/tts'

// 尽早绑上 window 级监听：孩子第一次点屏幕就完成音频解锁（SPEC 10.2）
installAudioUnlock()
initTTS()

// 首页 hash 兜底：standalone 的 start_url 已带 #/，这里补上直接打开域名的情况
if (!window.location.hash) {
  window.location.replace(`${window.location.pathname}#/`)
}

/**
 * Service Worker：autoUpdate + skipWaiting，下次冷启动自动用新版本，
 * 不弹更新提示打扰孩子（SPEC 11.4）。
 */
const swReady = { registered: false }

const updateSW = registerSW({
  immediate: true,
  onRegisteredSW() {
    swReady.registered = true
  },
  onRegisterError(err) {
    console.warn('[sw] 注册失败', err)
  },
})

// 供家长页（M4）读取离线状态
;(window as unknown as { __swReady?: typeof swReady }).__swReady = swReady
void updateSW

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('#root 不存在')

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
