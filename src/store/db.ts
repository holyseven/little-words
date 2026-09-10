/**
 * IndexedDB 封装（SPEC 12.1）—— store 名 `little-words`。
 *
 * 用 idb-keyval 的自定义 store，避免和其它站点的默认库混在一起。
 * 所有读操作在失败时返回 undefined（比如隐私模式下 IndexedDB 不可用），
 * 让 App 退化为「本次会话内可玩、但不保存进度」，而不是白屏。
 */

import { createStore, get, set, setMany, del, clear, type UseStore } from 'idb-keyval'

/**
 * 懒创建 store：createStore 会立刻碰 indexedDB，
 * 在模块顶层调用会让「没有 IndexedDB 的环境」（隐私模式、单测的 node 环境）
 * 在 import 阶段就抛错。这里推迟到真正读写时，且失败后不再重试。
 */
let store: UseStore | null = null
let storeFailed = false

function getStore(): UseStore | null {
  if (store) return store
  if (storeFailed) return null

  try {
    store = createStore('little-words', 'kv')
    return store
  } catch (err) {
    storeFailed = true
    console.warn('[db] IndexedDB 不可用，本次会话不保存进度', err)
    return null
  }
}

export const KEY_PROGRESS = 'progress'
export const KEY_SETTINGS = 'settings'

export async function dbGet<T>(key: string): Promise<T | undefined> {
  const s = getStore()
  if (!s) return undefined
  try {
    return await get<T>(key, s)
  } catch (err) {
    console.warn('[db] 读取失败', key, err)
    return undefined
  }
}

export async function dbSet<T>(key: string, value: T): Promise<void> {
  const s = getStore()
  if (!s) return
  try {
    await set(key, value, s)
  } catch (err) {
    console.warn('[db] 写入失败', key, err)
  }
}

export async function dbDel(key: string): Promise<void> {
  const s = getStore()
  if (!s) return
  try {
    await del(key, s)
  } catch (err) {
    console.warn('[db] 删除失败', key, err)
  }
}

/** 导入/重置用同一个事务提交进度与设置，失败时保留旧存档。 */
export async function dbReplace(progress: unknown, settings: unknown): Promise<void> {
  const s = getStore()
  if (!s) throw new Error('当前浏览器无法保存数据，原进度没有改变。')
  try { await setMany([[KEY_PROGRESS, progress], [KEY_SETTINGS, settings]], s) }
  catch { throw new Error('保存失败，原进度没有改变。请检查设备存储空间。') }
}

export async function dbClear(): Promise<void> {
  const s = getStore()
  if (!s) return
  try {
    await clear(s)
  } catch (err) {
    console.warn('[db] 清空失败', err)
  }
}

/**
 * 请求持久化存储，避免 iOS 在空间紧张时清掉进度（SPEC 11.4）。
 * 结果记录到设置里，家长页展示。
 */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true
    if (navigator.storage?.persist) return await navigator.storage.persist()
  } catch {
    /* 忽略 */
  }
  return false
}
