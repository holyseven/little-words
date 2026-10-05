import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './styles/tokens.css'
import './styles/global.css'
import { App } from './App'
import { installAudioUnlock } from './audio/audioUnlock'
import { initTTS } from './audio/tts'
import { registerAppServiceWorker } from './pwa/register'

// 尽早绑上 window 级监听：孩子第一次点屏幕就完成音频解锁（SPEC 10.2）
installAudioUnlock()
initTTS()

// 首页 hash 兜底：standalone 的 start_url 已带 #/，这里补上直接打开域名的情况
if (!window.location.hash) {
  window.location.replace(`${window.location.pathname}${window.location.search}#/`)
}

/**
 * Service Worker：启动和恢复前台时检查，保存进度后统一应用新版本，
 * 不弹更新提示打扰孩子（SPEC 11.4）。
 */
const swReady = { registered: false }

let removeUpdateChecks: (() => void) | undefined
let disposed = false
void registerAppServiceWorker(() => {
  swReady.registered = true
}).then((cleanup) => {
  if (disposed) cleanup?.()
  else removeUpdateChecks = cleanup
})

// 供家长页（M4）读取离线状态
;(window as unknown as { __swReady?: typeof swReady }).__swReady = swReady
import.meta.hot?.dispose(() => {
  disposed = true
  removeUpdateChecks?.()
})

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('#root 不存在')

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
