import { describe, expect, it } from 'vitest'
import { parseRoute } from '../src/router'

describe('parseRoute', () => {
  it('空路径与 / 都是首页', () => {
    expect(parseRoute('/')).toEqual({ name: 'home' })
    expect(parseRoute('')).toEqual({ name: 'home' })
  })

  it('主题页', () => {
    expect(parseRoute('/theme/animals')).toEqual({ name: 'theme', themeId: 'animals' })
  })

  it('单词卡页', () => {
    expect(parseRoute('/theme/animals/learn')).toEqual({ name: 'learn', themeId: 'animals' })
  })

  it('游戏入口', () => {
    expect(parseRoute('/theme/animals/game/listen')).toEqual({
      name: 'game',
      themeId: 'animals',
      game: 'listen',
    })
    expect(parseRoute('/theme/animals/game/memory')).toMatchObject({ game: 'memory' })
    expect(parseRoute('/theme/animals/game/bubble')).toMatchObject({ game: 'bubble' })
    expect(parseRoute('/theme/animals/game/speak')).toMatchObject({ game: 'speak' })
    expect(parseRoute('/theme/food/game/restaurant')).toMatchObject({ game: 'restaurant' })
    expect(parseRoute('/theme/animals/game/train?from=games')).toEqual({ name: 'game', themeId: 'animals', game: 'train', fromGames: true })
    expect(parseRoute('/theme/fruits/game/treasure?from=games')).toEqual({ name: 'game', themeId: 'fruits', game: 'treasure', fromGames: true })
  })

  it('游戏乐园与选中游戏查询串', () => {
    expect(parseRoute('/games')).toEqual({ name: 'games' })
    expect(parseRoute('/games?game=train')).toEqual({ name: 'games', game: 'train' })
    expect(parseRoute('/games?game=treasure')).toEqual({ name: 'games', game: 'treasure' })
    expect(parseRoute('/games?game=unknown')).toEqual({ name: 'games' })
  })

  it('未知游戏名落到 notfound', () => {
    expect(parseRoute('/theme/animals/game/xxx').name).toBe('notfound')
  })

  it('其余固定页', () => {
    expect(parseRoute('/stickers')).toEqual({ name: 'stickers' })
    expect(parseRoute('/daily')).toEqual({ name: 'daily' })
    expect(parseRoute('/parent')).toEqual({ name: 'parent' })
  })

  it('查询串被忽略', () => {
    expect(parseRoute('/theme/animals?from=home')).toEqual({ name: 'theme', themeId: 'animals' })
  })

  it('未知路径落到 notfound', () => {
    expect(parseRoute('/nope')).toEqual({ name: 'notfound', path: '/nope' })
  })
})
