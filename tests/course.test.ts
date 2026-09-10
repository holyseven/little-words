import { describe, expect, it } from 'vitest'
import { readFileSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { courseAssets, courseUnits, getCourseAsset, unitAssets } from '../src/content/curriculum'
import { continuousRange, mergePlayed, playedSeconds, recordCoursePlayback } from '../src/logic/courseProgress'
import { emptyProgress } from '../src/store/progress'
import { ensureDaily, awardDailyBonus } from '../src/logic/daily'
import { themes } from '../src/content'
import { createBackup, parseBackup } from '../src/logic/backup'
import { defaultSettings } from '../src/store/settings'
import { parseRoute } from '../src/router'
const date = new Date(2026, 8, 8, 9)
const now = date.getTime()

describe('课程资源', () => {
  it('全部 61 份材料与原清单一致，正确扩展名、文件大小、哈希和封面均有效', () => {
    expect(courseAssets).toHaveLength(61)
    expect(courseUnits).toHaveLength(6)
    expect(new Set(courseAssets.map((a) => a.id)).size).toBe(61)
    for (const a of courseAssets) {
      const data = readFileSync(new URL('../public/' + a.file, import.meta.url))
      expect(data.length).toBe(a.bytes)
      expect(createHash('sha256').update(data).digest('hex')).toBe(a.sha256)
      if (a.file.endsWith('.m4a')) expect(data.toString('ascii', 4, 8)).toBe('ftyp')
      if (a.poster) expect(statSync(new URL('../public/' + a.poster, import.meta.url)).size).toBeGreaterThan(1000)
    }
    expect(courseAssets.filter((a) => a.file.endsWith('.m4a'))).toHaveLength(32)
    expect(unitAssets('g1t1-u4').filter((a) => a.kind === 'animation')).toHaveLength(2)
  })
  it('单位、附录与合集分类无遗失；没有伪造缺失的入口', () => {
    expect(courseUnits.flatMap((u) => u.assets)).toHaveLength(46)
    expect(courseAssets.filter((a) => !a.unitId)).toHaveLength(15)
    for (const unit of courseUnits) for (const id of unit.assets) expect(getCourseAsset(id)?.unitId).toBe(unit.id)
    expect(getCourseAsset('g1t1-u4-video-3')).toBeUndefined()
  })
  it('课程路由精确解析并拒绝多余段', () => {
    expect(parseRoute('/course/unit/g1t1-u1')).toEqual({ name: 'course-unit', unitId: 'g1t1-u1' })
    expect(parseRoute('/course/play/g1t1-u1-words')).toEqual({ name: 'course-player', assetId: 'g1t1-u1-words' })
    expect(parseRoute('/course/extras')).toEqual({ name: 'course-extras' })
    expect(parseRoute('/course/play/a/b').name).toBe('notfound')
  })
})

describe('实际播放覆盖与奖励', () => {
  it('重叠与重听合并，分离区间不把没听的中间算进去', () => {
    const ranges = mergePlayed([[0, 5], [12, 15]], [3, 8], 20)
    expect(ranges).toEqual([[0, 8], [12, 15]])
    expect(playedSeconds(ranges)).toBe(11)
    expect(mergePlayed(ranges, [0, 8], 20)).toEqual(ranges)
  })
  it('播放器只接受与真实用时匹配的进度，跳到末尾不算播放', () => {
    expect(continuousRange(2, 3, 1, 1)).toEqual([2, 3])
    expect(continuousRange(2, 2.85, 1, 0.85)).toEqual([2, 2.85])
    expect(continuousRange(2, 30, 1, 1)).toBeNull()
    expect(continuousRange(20, 5, 1, 1)).toBeNull()
    const p = recordCoursePlayback(emptyProgress(), 'g1t1-u1-words', 34, null, now)
    expect(p.stars).toBe(0)
    expect(p.curriculum?.media['g1t1-u1-words'].completed).toBe(false)
  })
  it('首次实际听完加一星，再听、重开或从备份恢复不会重发', () => {
    const asset = getCourseAsset('g1t1-u1-words')!
    let p = recordCoursePlayback(emptyProgress(), asset.id, asset.duration, [0, asset.duration], now, true)
    expect(p.stars).toBe(1)
    p = recordCoursePlayback(p, asset.id, asset.duration, [0, asset.duration], now + 1000, true)
    expect(p.stars).toBe(1)
    const imported = parseBackup(JSON.stringify(createBackup(p, defaultSettings))).progress
    expect(recordCoursePlayback(imported, asset.id, 1, [0, 1], now + 2000).stars).toBe(1)
  })
  it('达到 90% 后仍继续播放，结束后才结算，不提前打断最后一句', () => {
    const a = courseAssets[0]!
    let p = recordCoursePlayback(emptyProgress(), a.id, a.duration * .95, [0, a.duration * .95], now)
    expect(p.stars).toBe(0)
    expect(p.curriculum!.media[a.id].completed).toBe(false)
    p = recordCoursePlayback(p, a.id, a.duration, [a.duration * .95, a.duration], now + 1000, true)
    expect(p.stars).toBe(1)
  })
  it('听过不等于认识，原主题单词与徽章不受课程播放影响', () => {
    const a = courseAssets[0]!
    const p = recordCoursePlayback(emptyProgress(), a.id, a.duration, [0, a.duration], now, true)
    expect(p.themes).toEqual({}); expect(p.wordStats).toEqual({}); expect(p.badges).toEqual([])
  })
  it('跨天只重置当天播放覆盖，历史记录保留', () => {
    const a = courseAssets[0]!
    const p = recordCoursePlayback(emptyProgress(), a.id, a.duration, [0, a.duration], now, true)
    const tomorrow = recordCoursePlayback(p, a.id, 2, [0, 2], now + 86400000)
    expect(tomorrow.curriculum!.media[a.id].completed).toBe(true)
    expect(tomorrow.curriculum!.media[a.id].dailyCovered).toEqual([[0, 2]])
    expect(tomorrow.stars).toBe(1)
  })
})

describe('课程每日任务与备份', () => {
  it('三个任务来自当前单元；切换家长单元不会刷新当天任务或奖励', () => {
    const p = ensureDaily(emptyProgress(), themes, false, date, 'g1t1-u5')
    expect(p.daily.tasks).toHaveLength(3)
    expect(p.daily.tasks.every((t) => getCourseAsset(t.assetId)?.unitId === 'g1t1-u5')).toBe(true)
    expect(ensureDaily(p, themes, false, date, 'g1t1-u6')).toBe(p)
  })
  it('三个任务真实播放后发一次 10 星；旧的学习任务当天保留', () => {
    let p = ensureDaily(emptyProgress(), themes, false, date, 'g1t1-u1')
    for (const task of p.daily.tasks) {
      const a = getCourseAsset(task.assetId)!
      p = recordCoursePlayback(p, a.id, a.duration, [0, a.duration], now, true)
    }
    expect(p.stars).toBe(3)
    expect(p.daily.done).toHaveLength(3)
    p = awardDailyBonus(p)
    expect(p.stars).toBe(13)
    expect(awardDailyBonus(p)).toBe(p)
    const previous = ensureDaily(emptyProgress(), themes, false, date)
    expect(ensureDaily(previous, themes, false, date, 'g1t1-u1')).toBe(previous)
  })
  it('备份保留课程播放与家长设置，兼容没有课程字段的旧备份', () => {
    let p = ensureDaily(emptyProgress(), themes, false, date, 'g1t1-u2')
    p = recordCoursePlayback(p, 'g1t1-u2-words', 3, [0, 3], now)
    const parsed = parseBackup(JSON.stringify(createBackup(p, { ...defaultSettings, currentUnitId: 'g1t1-u2', courseRate: 0.7 })))
    expect(parsed.progress.curriculum).toEqual(p.curriculum)
    expect(parsed.progress.daily.tasks[0].assetId).toBe(p.daily.tasks[0].assetId)
    expect(parsed.settings).toMatchObject({ currentUnitId: 'g1t1-u2', courseRate: 0.7 })
    expect(parseBackup(JSON.stringify(emptyProgress())).progress.curriculum).toBeUndefined()
  })
  it('拒绝伪造资源、越界位置、重叠区间和不合法设置', () => {
    const p = recordCoursePlayback(emptyProgress(), 'g1t1-u1-words', 3, [0, 3], now)
    const base = createBackup(p, defaultSettings)
    const mutations = [
      (b: any) => { b.progress.curriculum.media['g1t1-u1-words'].position = 1e6 },
      (b: any) => { b.progress.curriculum.media['g1t1-u1-words'].covered = [[0, 3], [1, 4]] },
      (b: any) => { b.progress.curriculum.media['g1t1-u1-words'].completed = true },
      (b: any) => { b.progress.curriculum.lastAssetId = 'unknown' },
      (b: any) => { b.settings.currentUnitId = 'unknown' },
      (b: any) => { b.settings.courseRate = 10 },
    ]
    for (const change of mutations) { const value = JSON.parse(JSON.stringify(base)); change(value); expect(() => parseBackup(JSON.stringify(value))).toThrow() }
  })
})
