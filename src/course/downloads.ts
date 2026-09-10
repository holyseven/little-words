import { useEffect, useSyncExternalStore } from 'react'
import { courseAssets, courseURL, type CourseAsset } from '../content/curriculum'

export const COURSE_CACHE = 'little-words-course-v1'
interface DownloadState {
  supported: boolean
  checked: boolean
  cached: string[]
  busy: boolean
  activeId?: string
  finishedBytes: number
  totalBytes: number
  message: string
}
let state: DownloadState = { supported: false, checked: false, cached: [], busy: false, finishedBytes: 0, totalBytes: 0, message: '' }
const listeners = new Set<() => void>()
let controller: AbortController | null = null
let checking: Promise<void> | null = null
function publish(patch: Partial<DownloadState>) { state = { ...state, ...patch }; listeners.forEach((f) => f()) }
const supported = () => typeof caches !== 'undefined' && window.isSecureContext
const assetURL = (asset: CourseAsset) => new URL(courseURL(asset.file), location.href).href
export const scopeAssets = (scope: string) => scope === 'all' ? courseAssets : courseAssets.filter((a) => a.unitId === scope)

export async function refreshDownloads(): Promise<void> {
  if (checking) return checking
  checking = (async () => {
    if (!supported()) { publish({ supported: false, checked: true }); return }
    try {
      const cache = await caches.open(COURSE_CACHE)
      const cached = (await Promise.all(courseAssets.map(async (asset) => {
        const response = await cache.match(assetURL(asset))
        return response?.status === 200 && Number(response.headers.get('content-length')) === asset.bytes ? asset.id : null
      }))).filter((id): id is string => !!id)
      publish({ supported: true, checked: true, cached })
    } catch { publish({ supported: false, checked: true, message: '暂时无法使用离线存储，在线播放仍可使用。' }) }
  })().finally(() => { checking = null })
  return checking
}

export async function downloadCourse(scope: string): Promise<void> {
  if (state.busy) return
  if (!supported()) { publish({ message: '离线下载需要 HTTPS；本机 localhost 也可测试。' }); return }
  const assets = scopeAssets(scope)
  if (!assets.length) return
  const job = new AbortController()
  controller = job
  publish({ busy: true, finishedBytes: 0, totalBytes: assets.reduce((n, a) => n + a.bytes, 0), message: '正在准备离线材料…' })
  try {
    const cache = await caches.open(COURSE_CACHE)
    let finishedBytes = 0
    for (const asset of assets) {
      if (job.signal.aborted) throw new DOMException('Aborted', 'AbortError')
      publish({ activeId: asset.id })
      const url = assetURL(asset)
      const existing = await cache.match(url)
      if (existing?.headers.get('x-course-sha256') !== asset.sha256) {
        // 不带 Range，必须下载完整文件才可用于离线跳转。
        const response = await fetch(url, { signal: job.signal })
        if (response.status !== 200) throw new Error('材料暂时无法下载，请联网后重试。')
        const bytes = await response.arrayBuffer()
        if (bytes.byteLength !== asset.bytes) { await cache.delete(url); throw new Error('下载不完整，请重试。已完成的材料会保留。') }
        const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((n) => n.toString(16).padStart(2, '0')).join('')
        if (hash !== asset.sha256) { await cache.delete(url); throw new Error('材料校验未通过，请联网刷新页面后重试。') }
        if (job.signal.aborted) throw new DOMException('Aborted', 'AbortError')
        const headers = new Headers(response.headers)
        headers.delete('content-encoding'); headers.delete('content-range')
        headers.set('content-length', String(bytes.byteLength)); headers.set('x-course-sha256', hash)
        headers.set('content-type', asset.kind === 'animation' ? 'video/mp4' : asset.file.endsWith('.mp3') ? 'audio/mpeg' : 'audio/mp4')
        await cache.put(url, new Response(bytes, { status: 200, headers }))
      }
      finishedBytes += asset.bytes
      publish({ finishedBytes, cached: [...new Set([...state.cached, asset.id])] })
    }
    publish({ message: '下载完成，可以离线学习了。' })
  } catch (error) {
    publish({ message: job.signal.aborted ? '下载已暂停，完成的材料已保留。下次会接着下载。'
      : error instanceof DOMException && error.name === 'QuotaExceededError' ? '设备存储空间不足，请删除一些离线材料后重试。'
      : error instanceof TypeError ? '下载未完成，请检查网络后重试。已完成的材料会保留。'
      : error instanceof Error ? error.message : '下载失败，请检查网络或存储空间后重试。' })
  } finally {
    controller = null
    publish({ busy: false, activeId: undefined })
    await refreshDownloads()
  }
}
export function cancelDownload() { controller?.abort() }

export async function deleteCourseDownload(scope: string): Promise<void> {
  if (state.busy || !supported()) return
  try {
    const cache = await caches.open(COURSE_CACHE)
    const prefix = new URL(courseURL('course-media/'), location.href).href
    const ids = scopeAssets(scope).map((a) => a.id + '-')
    for (const request of await cache.keys()) {
      if (request.url.startsWith(prefix) && ids.some((id) => request.url.slice(prefix.length).startsWith(id))) await cache.delete(request)
    }
    publish({ message: '离线材料已删除，学习进度仍保留。' })
    await refreshDownloads()
  } catch { publish({ message: '未能删除，请重试。' }) }
}

export function useCourseDownloads() {
  const snapshot = useSyncExternalStore((listener) => { listeners.add(listener); return () => listeners.delete(listener) }, () => state)
  useEffect(() => {
    void refreshDownloads()
    const refresh = () => { if (!document.hidden) void refreshDownloads() }
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('online', refresh)
    return () => { document.removeEventListener('visibilitychange', refresh); window.removeEventListener('online', refresh) }
  }, [])
  return snapshot
}
