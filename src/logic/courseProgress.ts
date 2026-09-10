import { getCourseAsset } from '../content/curriculum'
import { todayKey, type Progress, type PlayedRange } from '../store/progress'
import { applyDailyEvent } from './daily'

/** 记录实际播放区间，重复听和拖动都不会扩大已覆盖区间。 */
export function mergePlayed(ranges: PlayedRange[], addition: PlayedRange | null, duration: number): PlayedRange[] {
  const sorted = [...ranges, ...(addition ? [addition] : [])]
    .map(([a, b]): PlayedRange => [Math.max(0, a), Math.min(duration, b)])
    .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && b > a)
    .sort((a, b) => a[0] - b[0])
  const merged: PlayedRange[] = []
  for (const [a, b] of sorted) {
    const last = merged[merged.length - 1]
    if (last && a <= last[1] + 0.05) last[1] = Math.max(last[1], b)
    else merged.push([a, b])
  }
  return merged
}
export const playedSeconds = (ranges: PlayedRange[]) => ranges.reduce((sum, [a, b]) => sum + b - a, 0)

export function recordCoursePlayback(p: Progress, assetId: string, position: number, range: PlayedRange | null, now = Date.now(), ended = false): Progress {
  const asset = getCourseAsset(assetId)
  if (!asset || !Number.isFinite(position)) return p
  const before = p.curriculum?.media[assetId]
  const date = todayKey(new Date(now))
  const covered = mergePlayed(before?.covered ?? [], range, asset.duration)
  const dailyCovered = mergePlayed(before?.dailyDate === date ? before.dailyCovered : [], range, asset.duration)
  const completed = !!before?.completed || (ended && playedSeconds(covered) >= asset.duration * 0.9)
  const next = { ...p, stars: p.stars + (completed && !before?.completed ? 1 : 0), curriculum: {
    lastAssetId: assetId,
    media: { ...p.curriculum?.media, [assetId]: { position: Math.max(0, Math.min(position, asset.duration)), covered, completed, lastPlayed: now, dailyDate: date, dailyCovered } },
  } }
  return ended && playedSeconds(dailyCovered) >= asset.duration * 0.9 ? applyDailyEvent(next, { kind: 'course', assetId }) : next
}

/** timeupdate 有延迟；只接受与真实播放时间匹配的连续区间。 */
export function continuousRange(from: number, to: number, wallSeconds: number, rate: number): PlayedRange | null {
  return to > from && wallSeconds >= 0 && to - from <= wallSeconds * rate + 0.6 ? [from, to] : null
}
