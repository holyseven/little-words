import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Home } from '../src/pages/Home'
import { themes } from '../src/content'
import { emptyProgress } from '../src/store/progress'

const state = vi.hoisted(() => ({ progress: {} as ReturnType<typeof emptyProgress>, showZh: true, unlockAll: false }))
vi.mock('../src/store/AppContext', () => ({ useApp: () => ({ progress: state.progress, settings: { showZh: state.showZh, unlockAll: state.unlockAll }, authorizeParent: vi.fn() }) }))
vi.mock('../src/hooks/useSfx', () => ({ useSfx: () => ({ tap: vi.fn() }) }))
vi.mock('../src/hooks/useAudioUnlocked', () => ({ useAudioUnlocked: () => ({ unlocked: true, unlock: vi.fn() }) }))
vi.mock('../src/components/Mascot/Mascot', () => ({ Mascot: () => null }))
vi.mock('../src/components/ParentGate', () => ({ ParentGate: () => null }))
vi.mock('../src/pages/Course', () => ({ CourseHome: () => <p>Course home</p> }))

function render(section: 'course' | 'words' = 'words') {
  vi.stubGlobal('sessionStorage', { getItem: () => section })
  return renderToStaticMarkup(<Home />)
}

afterEach(() => {
  vi.unstubAllGlobals()
  state.showZh = true
  state.unlockAll = false
})

describe('首页主题卡片', () => {
  it('所有主题分在两区且各出现一次，不再绘制地图路径', () => {
    state.progress = emptyProgress()
    const html = render()
    expect(html).toContain('跟课本一起学')
    expect(html).toContain('更多主题')
    for (const theme of themes) {
      expect(html.split(`<strong>${theme.title}</strong>`).length - 1, theme.id).toBe(1)
    }
    expect(html).not.toContain('map__path')
    expect(html).not.toContain('station__disc')
  })

  it('课本主题直接可进，更多主题保留前一关解锁状态并展示完成与学习进度', () => {
    state.progress = emptyProgress()
    state.progress.badges = ['animals']
    state.progress.themes.animals = { learned: ['cat', 'dog'], best: {}, completed: true }
    const html = render()
    const cards = html.match(/<button[^>]*class="word-gardens__card[^>]*>[\s\S]*?<\/button>/g) ?? []
    const card = (title: string) => cards.find((value) => value.includes(`<strong>${title}</strong>`)) ?? ''
    expect(cards).toHaveLength(themes.length)
    for (const title of ['Numbers', 'Colors', 'Family', 'My Classroom', 'School Things', 'Fruits']) {
      expect(card(title), title).not.toContain('aria-disabled="true"')
    }
    expect(card('Animals')).toContain('已学 2/10')
    expect(card('Animals')).toContain('✓ 已完成')
    expect(card('Vehicles')).toContain('aria-disabled="true"')
    expect(card('Vehicles')).toContain('完成数字后解锁')
    state.unlockAll = true
    expect(render()).not.toContain('aria-disabled="true"')
  })

  it('课本和单词两个入口都能看到小对话，中文关闭时使用英文引导', () => {
    state.progress = emptyProgress()
    expect(render('course')).toContain('开口小对话')
    expect(render('words')).toContain('开口小对话')
    state.showZh = false
    const html = render('words')
    expect(html).toContain('Little conversations')
    expect(html).toContain('More themes')
    expect(html).not.toContain('已学')
  })
})
