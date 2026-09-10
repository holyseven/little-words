import { themes } from '../content'
import { defaultSettings, type Settings } from '../store/settings'
import { emptyProgress, type Progress, type DailyTask, type PlayedRange } from '../store/progress'
import { STICKER_POOL } from '../content/stickers'
import { getCourseAsset, getCourseUnit } from '../content/curriculum'
import { playedSeconds } from './courseProgress'

const wordIds = new Set(themes.flatMap((theme) => theme.words.map((w) => w.id)))
const themeIds = new Set(themes.map((theme) => theme.id))
const fail = (): never => { throw new Error('备份格式不正确或版本不兼容，当前进度没有改变。') }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail()
  return value as Record<string, unknown>
}
function number(value: unknown, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > max) return fail()
  return value
}
function boolean(value: unknown): boolean { return typeof value === 'boolean' ? value : fail() }
function decimal(value: unknown, max: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max ? value : fail()
}
function date(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fail()
  const parsed = new Date(`${value}T12:00:00`)
  return Number.isFinite(parsed.getTime()) && parsed.getDate() === Number(value.slice(-2)) ? value : fail()
}
function ranges(value: unknown, duration: number): PlayedRange[] {
  if (!Array.isArray(value) || value.length > 2048) return fail()
  let previousEnd = -1
  return value.map((r): PlayedRange => {
    if (!Array.isArray(r) || r.length !== 2) return fail()
    const start = decimal(r[0], duration), end = decimal(r[1], duration)
    if (end <= start || start < previousEnd) return fail()
    previousEnd = end
    return [start, end]
  })
}
function strings(value: unknown, allowed?: Set<string>): string[] {
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string' || v.length > 200 || (allowed && !allowed.has(v)))) return fail()
  if (new Set(value).size !== value.length) return fail()
  return value
}

export function validateProgress(value: unknown): Progress {
  const p = object(value)
  if (p.version !== 1) return fail()
  const next = emptyProgress()
  next.stars = number(p.stars, 1e9)
  return validateRest(p, next)
}

function validateRest(p: Record<string, unknown>, next: Progress): Progress {
  next.stickers = strings(p.stickers, new Set<string>(STICKER_POOL))
  next.badges = strings(p.badges, themeIds)
  for (const [id, value] of Object.entries(object(p.themes))) {
    if (!themeIds.has(id)) return fail()
    const t = object(value)
    const best = object(t.best)
    const scores: Progress['themes'][string]['best'] = {}
    for (const game of ['listen', 'memory', 'bubble'] as const) {
      if (best[game] !== undefined) scores[game] = number(best[game], game === 'bubble' ? 10 : 8)
    }
    next.themes[id] = { learned: strings(t.learned, new Set(themes.find((theme) => theme.id === id)!.words.map((w) => w.id))), best: scores, completed: boolean(t.completed) }
  }
  for (const [id, value] of Object.entries(object(p.wordStats))) {
    if (!wordIds.has(id)) return fail()
    const stat = object(value)
    next.wordStats[id] = { seen: number(stat.seen), correct: number(stat.correct), wrong: number(stat.wrong), lastSeen: number(stat.lastSeen) }
  }
  if (p.curriculum !== undefined) {
    const curriculum = object(p.curriculum)
    if (curriculum.lastAssetId !== undefined && !getCourseAsset(curriculum.lastAssetId as string)) return fail()
    next.curriculum = { media: {}, ...(curriculum.lastAssetId ? { lastAssetId: curriculum.lastAssetId as string } : {}) }
    for (const [id, value] of Object.entries(object(curriculum.media))) {
      const asset = getCourseAsset(id)
      if (!asset) return fail()
      const item = object(value)
      const covered = ranges(item.covered, asset.duration), completed = boolean(item.completed)
      if (completed && playedSeconds(covered) < asset.duration * 0.9) return fail()
      next.curriculum.media[id] = { position: decimal(item.position, asset.duration), covered, completed,
        lastPlayed: number(item.lastPlayed), dailyDate: date(item.dailyDate), dailyCovered: ranges(item.dailyCovered, asset.duration) }
    }
    if (next.curriculum.lastAssetId && !next.curriculum.media[next.curriculum.lastAssetId]) return fail()
  }
  const daily = object(p.daily)
  if (typeof daily.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(daily.date)) return fail()
  const parsedDate = new Date(`${daily.date}T12:00:00`)
  if (!Number.isFinite(parsedDate.getTime()) || parsedDate.getDate() !== Number(daily.date.slice(-2))) return fail()
  if (!Array.isArray(daily.tasks) || ![0, 3].includes(daily.tasks.length)) return fail()
  const tasks = daily.tasks.map((value): DailyTask => {
    const t = object(value)
    if (typeof t.id !== 'string' || !/^[a-z0-9_-]{1,40}$/.test(t.id)) return fail()
    if (!['learn', 'listen', 'review', 'memory', 'course'].includes(t.kind as string)) return fail()
    if (t.themeId !== undefined && !themeIds.has(t.themeId as string)) return fail()
    const target = number(t.target, 10)
    if (target < 1) return fail()
    if (t.kind === 'course' && (!getCourseAsset(t.assetId as string) || target !== 1)) return fail()
    const ids = t.wordIds === undefined ? undefined : strings(t.wordIds, wordIds)
    const completedWordIds = t.completedWordIds === undefined ? [] : strings(t.completedWordIds, new Set(ids ?? []))
    const count = t.count === undefined ? 0 : number(t.count, target)
    if (ids && (ids.length !== target || completedWordIds.length !== count)) return fail()
    return { id: t.id, kind: t.kind as DailyTask['kind'], target, themeId: t.themeId as string | undefined, wordIds: ids, completedWordIds, count, ...(t.kind === 'course' ? { assetId: t.assetId as string } : {}) }
  })
  if (new Set(tasks.map((t) => t.id)).size !== tasks.length) return fail()
  const done = strings(daily.done, new Set(tasks.map((t) => t.id)))
  // 兼容早期只有 done、没有 count 的存档。
  for (const task of tasks) if (done.includes(task.id) && !task.wordIds) task.count = task.target
  if (done.some((id) => tasks.find((t) => t.id === id)!.count !== tasks.find((t) => t.id === id)!.target)) return fail()
  next.daily = { date: daily.date, tasks, done, usedMs: number(daily.usedMs), bonusMs: number(daily.bonusMs), rewarded: daily.rewarded === undefined ? done.length === 3 : boolean(daily.rewarded) }
  if (next.daily.rewarded && done.length !== 3) return fail()
  return next
}

export type Backup = { format: 'little-words-backup'; version: 1; exportedAt: string; progress: Progress; settings: Omit<Settings, 'parentPin' | 'persisted'> }
export function createBackup(progress: Progress, settings: Settings): Backup {
  const { parentPin: _pin, persisted: _persisted, ...portable } = settings
  return { format: 'little-words-backup', version: 1, exportedAt: new Date().toISOString(), progress, settings: portable }
}

export function parseBackup(text: string): { progress: Progress; settings?: Partial<Settings> } {
  let value: unknown
  try { value = JSON.parse(text) } catch { return fail() }
  const root = object(value)
  if (root.format === undefined) return { progress: validateProgress(root) }
  if (root.format !== 'little-words-backup' || root.version !== 1) return fail()
  const s = object(root.settings)
  const settings: Partial<Settings> = {}
  for (const key of ['showZh', 'sfx', 'unlockAll'] as const) settings[key] = boolean(s[key])
  if (typeof s.rate !== 'number' || !Number.isFinite(s.rate) || s.rate < 0.7 || s.rate > 1) return fail()
  settings.rate = s.rate
  if (!['auto', 'day', 'night'].includes(s.appearance as string)) return fail()
  settings.appearance = s.appearance as Settings['appearance']
  if (![0, 10, 15, 20, 30].includes(s.dailyLimitMin as number)) return fail()
  settings.dailyLimitMin = s.dailyLimitMin as number
  if (s.voiceName !== undefined && (typeof s.voiceName !== 'string' || s.voiceName.length > 200)) return fail()
  settings.voiceName = s.voiceName as string | undefined
  if (s.currentUnitId !== undefined) {
    if (!getCourseUnit(s.currentUnitId as string)) return fail()
    settings.currentUnitId = s.currentUnitId as string
  }
  if (s.dailySource !== undefined) {
    if (s.dailySource !== 'course' && s.dailySource !== 'themes') return fail()
    settings.dailySource = s.dailySource
  }
  if (s.courseRate !== undefined) {
    if (![0.7, 0.85, 1].includes(s.courseRate as number)) return fail()
    settings.courseRate = s.courseRate as number
  }
  return { progress: validateProgress(root.progress), settings: { ...defaultSettings, ...settings } }
}
