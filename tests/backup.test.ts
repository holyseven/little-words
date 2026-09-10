import { describe, expect, it } from 'vitest'
import { createBackup, parseBackup } from '../src/logic/backup'
import { emptyProgress } from '../src/store/progress'
import { defaultSettings } from '../src/store/settings'
import { ensureDaily } from '../src/logic/daily'
import { themes } from '../src/content'

const backup = () => createBackup(ensureDaily(emptyProgress(), themes, false), { ...defaultSettings, parentPin: '1234', persisted: true })
describe('进度备份', () => {
  it('可往返保存新存档，PIN 和持久化权限不导出', () => {
    const exported = backup()
    const result = parseBackup(JSON.stringify(exported))
    expect(result.progress).toEqual(exported.progress)
    expect(result.settings).not.toHaveProperty('parentPin')
    expect(exported.settings).not.toHaveProperty('persisted')
  })
  it('兼容原始 version 1 进度对象和空 daily.tasks', () => {
    expect(parseBackup(JSON.stringify(emptyProgress())).progress).toMatchObject(emptyProgress())
  })
  it.each(['not json', 'null', '[]', '{"version":2}', '{"version":1,"stars":-1}'])('拒绝损坏或不兼容的数据 %s', (text) => {
    expect(() => parseBackup(text)).toThrow()
  })
  it('拒绝负数、未知词、重复贴纸、越界成绩和不合法设置', () => {
    const mutations = [
      (b: any) => { b.progress.stars = -1 },
      (b: any) => { b.progress.wordStats.unknown = { seen: 1, correct: 0, wrong: 0, lastSeen: 0 } },
      (b: any) => { b.progress.stickers = ['🦄', '🦄'] },
      (b: any) => { b.progress.themes.animals = { learned: [], best: { bubble: 11 }, completed: false } },
      (b: any) => { b.settings.rate = 10 },
      (b: any) => { b.settings.dailyLimitMin = -10 },
      (b: any) => { b.progress.daily.date = '2026-02-31' },
      (b: any) => { b.progress.daily.tasks[0].completedWordIds = ['cat', 'cat'] },
    ]
    for (const mutate of mutations) { const value = backup(); mutate(value); expect(() => parseBackup(JSON.stringify(value))).toThrow() }
  })
  it('拒绝通过对象键污染原型', () => {
    const value = backup()
    value.progress.themes = JSON.parse('{"__proto__":{"polluted":true}}')
    expect(() => parseBackup(JSON.stringify(value))).toThrow()
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })
})
