/**
 * 家长设置（SPEC 12.1），兼容旧版本缺失的字段。
 */

import { dbGet, dbSet, KEY_SETTINGS } from './db'
import { resolveAppearance } from '../logic/appearance'

export interface Settings {
  showZh: boolean
  voiceName?: string
  rate: number
  sfx: boolean
  appearance: 'auto' | 'day' | 'night'
  /** 每日时长上限（分钟），0 = 关闭 */
  dailyLimitMin: number
  unlockAll: boolean
  parentPin?: string
  persisted?: boolean
  currentUnitId: string
  dailySource: 'course' | 'themes'
  courseRate: number
  /** 原创动画的播放倍率，与课本媒体和单词语速分别保存。 */
  storyRate: number
  /** 跟读评估通道；默认先尝试 Azure，失败时自动回退 Vosk。 */
  repeatEngine: 'azure' | 'vosk'
}

export const defaultSettings: Settings = {
  showZh: true,
  rate: 0.85,
  sfx: true,
  appearance: 'auto',
  dailyLimitMin: 20,
  unlockAll: false,
  currentUnitId: 'g1t1-u1',
  dailySource: 'course',
  courseRate: 1,
  storyRate: 1,
  repeatEngine: 'azure',
}

export async function loadSettings(): Promise<Settings> {
  const saved = await dbGet<Partial<Settings>>(KEY_SETTINGS)
  // 合并默认值：老版本存档缺字段时也能正常启动
  const settings = { ...defaultSettings, ...saved }
  if (![0.7, 0.85, 1].includes(settings.storyRate)) settings.storyRate = defaultSettings.storyRate
  return settings
}

export async function saveSettings(s: Settings): Promise<void> {
  await dbSet(KEY_SETTINGS, s)
}

/**
 * 把外观设置写到 <html data-theme>。
 * 自动模式结合系统深色偏好与 19:00–7:00 时段。
 */
export function applyAppearance(appearance: Settings['appearance']): void {
  const root = document.documentElement
  const resolved = resolveAppearance(appearance, matchMedia('(prefers-color-scheme: dark)').matches, new Date().getHours())
  root.setAttribute('data-theme', resolved)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'night' ? '#2B2824' : '#F6F1E7')
}
