import { describe, expect, it } from 'vitest'
import { themes } from '../src/content'
import { accrueUsage, applyDailyEvent, awardDailyBonus, dailyLimitReached, ensureDaily } from '../src/logic/daily'
import { emptyProgress } from '../src/store/progress'

const morning = new Date(2026, 8, 8, 9)
const daily = () => ensureDaily(emptyProgress(), themes, false, morning)
describe('每日任务', () => {
  it('新用户得到可完成的 3 个任务，旧的同日空任务会迁移且保留已用时长', () => {
    const initial = { ...emptyProgress(), daily: { ...emptyProgress().daily, date: '2026-09-08', usedMs: 1234 } }
    const p = ensureDaily(initial, themes, false, morning)
    expect(p.daily.tasks.map((t) => t.kind)).toEqual(['learn', 'listen', 'memory'])
    expect(p.daily.tasks[0].wordIds).toHaveLength(5)
    expect(p.daily.usedMs).toBe(1234)
    expect(ensureDaily(p, themes, false, morning)).toBe(p)
  })
  it('同一单词反复标记只计一次，未指定主题的局数不能冒充任务', () => {
    let p = daily()
    const id = p.daily.tasks[0].wordIds![0]
    p = applyDailyEvent(p, { kind: 'learn', wordId: id })
    expect(applyDailyEvent(p, { kind: 'learn', wordId: id })).toBe(p)
    expect(applyDailyEvent(p, { kind: 'listen', themeId: 'fruits' })).toBe(p)
    expect(p.daily.tasks[0].count).toBe(1)
  })
  it('三个任务完成后只发一次 10 星，刷新或重复结算不重发', () => {
    let p = daily()
    for (const wordId of p.daily.tasks[0].wordIds!) p = applyDailyEvent(p, { kind: 'learn', wordId })
    p = applyDailyEvent(p, { kind: 'listen', themeId: 'animals' })
    expect(awardDailyBonus(p).stars).toBe(0)
    p = applyDailyEvent(p, { kind: 'memory', themeId: 'animals' })
    p = awardDailyBonus(p)
    expect(p.stars).toBe(10)
    expect(p.daily.done).toHaveLength(3)
    expect(awardDailyBonus(p)).toBe(p)
    expect(awardDailyBonus(JSON.parse(JSON.stringify(p))).stars).toBe(10)
  })
  it('有错词时改为复习，不足 5 个不会生成无法完成的目标', () => {
    const initial = emptyProgress()
    initial.wordStats.cat = { seen: 2, correct: 1, wrong: 1, lastSeen: 0 }
    const p = ensureDaily(initial, themes, false, morning)
    expect(p.daily.tasks[2]).toMatchObject({ kind: 'review', wordIds: ['cat'], target: 1 })
    const next = applyDailyEvent(p, { kind: 'review', wordId: 'cat' })
    expect(next.daily.done).toEqual(['review'])
  })
  it('全部学过后仍能完成当天任务，不要求重复获得新词星星', () => {
    const initial = emptyProgress()
    for (const t of themes) initial.themes[t.id] = { learned: t.words.map((w) => w.id), best: { memory: 8 }, completed: true }
    initial.badges = themes.map((t) => t.id)
    const p = ensureDaily(initial, themes, false, morning)
    expect(p.daily.tasks[0].kind).toBe('review')
    expect(p.daily.tasks[0].target).toBe(5)
  })
  it('跨天换任务、清空当天奖励与加时，但保留总星星和词库', () => {
    const p = daily()
    p.stars = 100; p.daily.usedMs = 120000; p.daily.bonusMs = 600000; p.daily.rewarded = true
    const next = ensureDaily(p, themes, false, new Date(2026, 8, 9, 1))
    expect(next.daily).toMatchObject({ date: '2026-09-09', usedMs: 0, bonusMs: 0, rewarded: false, done: [] })
    expect(next.stars).toBe(100)
  })
})
describe('前台时长', () => {
  it('按时间差累计，延迟的 tick 不丢时间', () => {
    const start = morning.getTime()
    expect(accrueUsage(daily(), start, start + 12500, themes, false).daily.usedMs).toBe(12500)
  })
  it('跨午夜只统计新一天的部分，时钟后退不扣除已用时长', () => {
    const start = new Date(2026, 8, 8, 23, 59, 55).getTime()
    const end = new Date(2026, 8, 9, 0, 0, 7).getTime()
    const p = accrueUsage(daily(), start, end, themes, false)
    expect(p.daily.usedMs).toBe(7000)
    expect(accrueUsage(p, end, end - 1000, themes, false).daily.usedMs).toBe(7000)
  })
  it('到点休息，家长加 10 分钟后可继续，关闭限制始终不阻止', () => {
    const p = daily()
    p.daily.usedMs = 20 * 60000
    expect(dailyLimitReached(p, 20)).toBe(true)
    expect(dailyLimitReached(p, 0)).toBe(false)
    p.daily.bonusMs = 10 * 60000
    expect(dailyLimitReached(p, 20)).toBe(false)
    p.daily.usedMs = 30 * 60000
    expect(dailyLimitReached(p, 20)).toBe(true)
  })
})
