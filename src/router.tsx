/**
 * 极简 hash 路由（SPEC 2 / 6）
 *
 * 用 hash 而非 history，是为了 GitHub Pages 刷新不 404；
 * 自己实现（不引 react-router）以减少体积和离线依赖。
 * standalone 模式下没有浏览器返回按钮，但系统边缘滑动手势会触发 popstate/hashchange，
 * 这里同时监听两者。
 */

import { useCallback, useEffect, useState } from 'react'
import { isParkGameId, type ParkGameId } from './content/games'

export type Route =
  | { name: 'home' }
  | { name: 'games'; game?: ParkGameId }
  | { name: 'theme'; themeId: string }
  | { name: 'learn'; themeId: string; wordId?: string }
  | { name: 'word-repeat'; themeId: string; wordId: string }
  | { name: 'game'; themeId: string; game: 'listen' | 'memory' | 'bubble' | ParkGameId; fromGames?: true }
  | { name: 'stickers' }
  | { name: 'daily' }
  | { name: 'parent' }
  | { name: 'course-unit'; unitId: string }
  | { name: 'course-player'; assetId: string }
  | { name: 'course-repeat'; assetId: string }
  | { name: 'course-extras' }
  | { name: 'notfound'; path: string }

function currentHash(): string {
  // location.hash 形如 '#/theme/animals'
  const h = window.location.hash.replace(/^#/, '')
  return h || '/'
}

export function parseRoute(path: string): Route {
  const parts = path.split('?')[0]!.split('/').filter(Boolean)

  if (parts.length === 0) return { name: 'home' }
  if (parts[0] === 'games' && parts.length === 1) {
    const game = new URLSearchParams(path.split('?')[1]).get('game')
    return isParkGameId(game) ? { name: 'games', game } : { name: 'games' }
  }

  if (parts[0] === 'stickers') return { name: 'stickers' }
  if (parts[0] === 'daily') return { name: 'daily' }
  if (parts[0] === 'parent') return { name: 'parent' }
  if (parts[0] === 'course') {
    if (parts[1] === 'unit' && parts.length === 3) return { name: 'course-unit', unitId: parts[2]! }
    if (parts[1] === 'play' && parts.length === 3) return { name: 'course-player', assetId: parts[2]! }
    if (parts[1] === 'repeat' && parts.length === 3) return { name: 'course-repeat', assetId: parts[2]! }
    if (parts[1] === 'extras' && parts.length === 2) return { name: 'course-extras' }
    return { name: 'notfound', path }
  }

  if (parts[0] === 'theme' && parts[1]) {
    const themeId = parts[1]
    if (parts.length === 2) return { name: 'theme', themeId }
    if (parts[2] === 'learn') {
      const wordId = new URLSearchParams(path.split('?')[1]).get('word')
      return wordId ? { name: 'learn', themeId, wordId } : { name: 'learn', themeId }
    }
    if (parts[2] === 'repeat' && parts.length === 3) {
      const wordId = new URLSearchParams(path.split('?')[1]).get('word')
      if (wordId) return { name: 'word-repeat', themeId, wordId }
    }
    if (parts[2] === 'game' && parts[3]) {
      const game = parts[3]
      if (game === 'listen' || game === 'memory' || game === 'bubble' || isParkGameId(game)) {
        return { name: 'game', themeId, game, ...(new URLSearchParams(path.split('?')[1]).get('from') === 'games' ? { fromGames: true as const } : {}) }
      }
    }
  }

  return { name: 'notfound', path }
}

/** 跳转（压入历史，可被系统返回手势退回） */
export function navigate(path: string): void {
  const target = path.startsWith('/') ? path : `/${path}`
  if (currentHash() === target) return
  window.location.hash = `#${target}`
}

/** 返回上一页；没有历史可退时回首页（standalone 冷启动直达子页的情况） */
export function goBack(): void {
  if (window.history.length > 1) {
    window.history.back()
  } else {
    navigate('/')
  }
}

export function useRoute(): Route {
  const [path, setPath] = useState(currentHash)

  useEffect(() => {
    const onChange = () => setPath(currentHash())
    window.addEventListener('hashchange', onChange)
    // 系统返回手势在部分 iOS 版本只发 popstate
    window.addEventListener('popstate', onChange)
    return () => {
      window.removeEventListener('hashchange', onChange)
      window.removeEventListener('popstate', onChange)
    }
  }, [])

  return parseRoute(path)
}

/** 稳定的 navigate 引用，方便传进 memo 组件 */
export function useNavigate(): (path: string) => void {
  return useCallback(navigate, [])
}
