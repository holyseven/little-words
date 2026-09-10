import { describe, expect, it } from 'vitest'

import {
  awardStickers,
  firstAvailableTheme,
  isThemeComplete,
  reconcileRewards,
  stationState,
  stickersEarnedFor,
  GAME_PASS_RATIO,
} from '../src/logic/rewards'
import { STARS_PER_STICKER, STICKER_POOL } from '../src/content/stickers'
import { emptyProgress, emptyThemeProgress, type Progress } from '../src/store/progress'
import type { Theme } from '../src/content/types'

const theme = (id: string, order: number, wordCount = 3): Theme => ({
  id,
  title: id,
  zh: id,
  emoji: '🐾',
  tint: '--tint-animals',
  order,
  words: Array.from({ length: wordCount }, (_, i) => ({
    id: `${id}-w${i}`,
    text: `w${i}`,
    emoji: '🐱',
    zh: '词',
    sentence: 'This is a word.',
  })),
})

const themes = [theme('a', 1), theme('b', 2), theme('c', 3)]

/** 固定序列的随机源 */
function seq(values: number[]) {
  let i = 0
  return () => values[i++ % values.length]!
}

describe('贴纸池（SPEC 7.8）', () => {
  it('池里有 40 个不重复的 emoji', () => {
    expect(STICKER_POOL.length).toBe(40)
    expect(new Set(STICKER_POOL).size).toBe(40)
  })
})

describe('stickersEarnedFor', () => {
  it('每 10 颗星换 1 张', () => {
    expect(stickersEarnedFor(0)).toBe(0)
    expect(stickersEarnedFor(9)).toBe(0)
    expect(stickersEarnedFor(10)).toBe(1)
    expect(stickersEarnedFor(29)).toBe(2)
    expect(stickersEarnedFor(100)).toBe(10)
  })

  it('池空后不再增加', () => {
    expect(stickersEarnedFor(STARS_PER_STICKER * 40)).toBe(40)
    expect(stickersEarnedFor(STARS_PER_STICKER * 100)).toBe(40)
  })
})

describe('awardStickers', () => {
  it('够 10 星发一张', () => {
    const { gained, stickers } = awardStickers(10, [], seq([0]))
    expect(gained.length).toBe(1)
    expect(stickers.length).toBe(1)
    expect(STICKER_POOL).toContain(gained[0])
  })

  it('不到 10 星不发', () => {
    const { gained } = awardStickers(9, [])
    expect(gained).toEqual([])
  })

  it('已有的不重复发', () => {
    const owned = [STICKER_POOL[0]!]
    const { gained } = awardStickers(20, owned, seq([0]))
    expect(gained.length).toBe(1)
    expect(gained[0]).not.toBe(owned[0])
  })

  it('一次补发多张（比如导入了旧存档）', () => {
    const { gained, stickers } = awardStickers(50, [], seq([0, 0, 0, 0, 0]))
    expect(gained.length).toBe(5)
    expect(new Set(gained).size).toBe(5)
    expect(stickers.length).toBe(5)
  })

  it('池空后不再发，也不报错', () => {
    const all = [...STICKER_POOL]
    const { gained, stickers } = awardStickers(9999, all)
    expect(gained).toEqual([])
    expect(stickers.length).toBe(40)
  })

  it('拿满整池时每张都不重复', () => {
    const { stickers } = awardStickers(STARS_PER_STICKER * 40, [])
    expect(stickers.length).toBe(40)
    expect(new Set(stickers).size).toBe(40)
  })

  it('星星倒退时不回收贴纸', () => {
    const owned = [STICKER_POOL[0]!, STICKER_POOL[1]!]
    const { gained, stickers } = awardStickers(5, owned)
    expect(gained).toEqual([])
    expect(stickers).toEqual(owned)
  })
})

describe('isThemeComplete（SPEC 7.2）', () => {
  const t = theme('a', 1, 3)

  it('单词没学完不算完成', () => {
    const tp = { ...emptyThemeProgress(), learned: ['a-w0'], best: { listen: 8 } }
    expect(isThemeComplete(t, tp)).toBe(false)
  })

  it('学完但没游戏成绩不算完成', () => {
    const tp = { ...emptyThemeProgress(), learned: ['a-w0', 'a-w1', 'a-w2'] }
    expect(isThemeComplete(t, tp)).toBe(false)
  })

  it('学完 + 正确率 ≥ 80% 才算完成', () => {
    const learned = ['a-w0', 'a-w1', 'a-w2']
    // 8 题里对 6 题 = 75%，不够
    expect(isThemeComplete(t, { ...emptyThemeProgress(), learned, best: { listen: 6 } })).toBe(false)
    // 对 7 题 = 87.5%，够
    expect(isThemeComplete(t, { ...emptyThemeProgress(), learned, best: { listen: 7 } })).toBe(true)
  })

  it('任意一个游戏达标即可', () => {
    const learned = ['a-w0', 'a-w1', 'a-w2']
    expect(isThemeComplete(t, { ...emptyThemeProgress(), learned, best: { memory: 8 } })).toBe(true)
    expect(isThemeComplete(t, { ...emptyThemeProgress(), learned, best: { bubble: 8 } })).toBe(true)
  })

  it('手机完整配完 6 对也可解锁；泡泡必须至少首次答对 8/10', () => {
    const learned = ['a-w0', 'a-w1', 'a-w2']
    expect(isThemeComplete(t, { ...emptyThemeProgress(), learned, best: { memory: 6 } })).toBe(true)
    expect(isThemeComplete(t, { ...emptyThemeProgress(), learned, best: { bubble: 7 } })).toBe(false)
    expect(isThemeComplete(t, { ...emptyThemeProgress(), learned, best: { bubble: 8 } })).toBe(true)
  })

  it('门槛正好是 80%', () => {
    const learned = ['a-w0', 'a-w1', 'a-w2']
    // 10 题里对 8 题正好 80%
    expect(
      isThemeComplete(t, { ...emptyThemeProgress(), learned, best: { listen: 8 } }, 10),
    ).toBe(true)
    expect(GAME_PASS_RATIO).toBe(0.8)
  })
})

describe('stationState（SPEC 7.1 解锁规则）', () => {
  const withBadges = (badges: string[]): Progress => ({ ...emptyProgress(), badges })

  it('第 1 个主题默认可用', () => {
    expect(stationState(themes, 0, emptyProgress())).toBe('available')
  })

  it('后续主题默认锁定', () => {
    expect(stationState(themes, 1, emptyProgress())).toBe('locked')
    expect(stationState(themes, 2, emptyProgress())).toBe('locked')
  })

  it('完成第 N 个解锁第 N+1 个', () => {
    const p = withBadges(['a'])
    expect(stationState(themes, 0, p)).toBe('completed')
    expect(stationState(themes, 1, p)).toBe('available')
    expect(stationState(themes, 2, p)).toBe('locked')
  })

  it('跳过中间主题不会连带解锁后面的', () => {
    // 只完成了 c（异常存档），b 仍应锁定
    const p = withBadges(['c'])
    expect(stationState(themes, 1, p)).toBe('locked')
  })

  it('unlockAll 时全部可用', () => {
    const p = emptyProgress()
    expect(stationState(themes, 1, p, true)).toBe('available')
    expect(stationState(themes, 2, p, true)).toBe('available')
  })

  it('已完成的主题即使 unlockAll 也显示 completed', () => {
    expect(stationState(themes, 0, withBadges(['a']), true)).toBe('completed')
  })

  it('越界索引返回 locked', () => {
    expect(stationState(themes, 99, emptyProgress())).toBe('locked')
  })
})

describe('firstAvailableTheme', () => {
  it('返回第一个已解锁未完成的主题', () => {
    expect(firstAvailableTheme(themes, emptyProgress())?.id).toBe('a')
    expect(firstAvailableTheme(themes, { ...emptyProgress(), badges: ['a'] })?.id).toBe('b')
  })

  it('全部完成时返回最后一个', () => {
    const p = { ...emptyProgress(), badges: ['a', 'b', 'c'] }
    expect(firstAvailableTheme(themes, p)?.id).toBe('c')
  })
})

describe('reconcileRewards（导入存档/丢写入后的自愈）', () => {
  it('按星星补齐缺失的贴纸', () => {
    // 直接塞一个 200 星、0 贴纸的存档（模拟导入或直改数据库）
    const p = { ...emptyProgress(), stars: 200 }
    const out = reconcileRewards(p, themes)
    expect(out.stickers.length).toBe(20)
    expect(new Set(out.stickers).size).toBe(20)
  })

  it('贴纸已对上时不改动（返回同一对象）', () => {
    const p = { ...emptyProgress(), stars: 5 }
    expect(reconcileRewards(p, themes)).toBe(p)
  })

  it('把已达成条件但缺徽章的主题补上', () => {
    const learned = ['a-w0', 'a-w1', 'a-w2']
    const p: Progress = {
      ...emptyProgress(),
      themes: { a: { learned, best: { listen: 8 }, completed: false } },
    }
    const out = reconcileRewards(p, themes)
    expect(out.badges).toContain('a')
    expect(out.themes['a']!.completed).toBe(true)
  })

  it('没达成条件的主题不发徽章', () => {
    const p: Progress = {
      ...emptyProgress(),
      themes: { a: { learned: ['a-w0'], best: { listen: 8 }, completed: false } },
    }
    expect(reconcileRewards(p, themes).badges).toEqual([])
  })

  it('已有的徽章不重复添加', () => {
    const learned = ['a-w0', 'a-w1', 'a-w2']
    const p: Progress = {
      ...emptyProgress(),
      badges: ['a'],
      themes: { a: { learned, best: { listen: 8 }, completed: true } },
    }
    expect(reconcileRewards(p, themes).badges).toEqual(['a'])
  })

  it('贴纸和徽章能一次性同时补齐', () => {
    const learned = ['a-w0', 'a-w1', 'a-w2']
    const p: Progress = {
      ...emptyProgress(),
      stars: 30,
      themes: { a: { learned, best: { listen: 8 }, completed: false } },
    }
    const out = reconcileRewards(p, themes)
    expect(out.stickers.length).toBe(3)
    expect(out.badges).toContain('a')
  })

  it('幂等：跑两次结果一致', () => {
    const p = { ...emptyProgress(), stars: 45 }
    const once = reconcileRewards(p, themes)
    const twice = reconcileRewards(once, themes)
    expect(twice.stickers.length).toBe(once.stickers.length)
    expect(twice).toBe(once)
  })
})
