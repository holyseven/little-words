import { describe, expect, it } from 'vitest'
import { readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

import manifest from '../src/content/audioManifest.json'
import { themes } from '../src/content'
import { phrases, themeCompletePhrases } from '../src/content/phrases'
import treasurePrompts from '../src/content/treasurePrompts.json'

const audioDir = join(process.cwd(), 'public', 'audio')

/** 必须与 scripts/gen-audio.mjs 和 src/audio/clips.ts 里的规则一致 */
function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
}

const clips = manifest.clips as Record<string, { hash: string; text: string; durationMs: number }>

describe('预生成音频（人声）', () => {
  it('用的是 Premium 或 Enhanced 档语音', () => {
    expect(manifest.voice).toMatch(/\((Premium|Enhanced)\)/)
  })

  it('每个单词都有单词音频和例句音频', () => {
    for (const theme of themes) {
      for (const word of theme.words) {
        expect(clips[`w/${word.id}`], `缺少单词音频 w/${word.id}`).toBeDefined()
        expect(clips[`s/${word.id}`], `缺少例句音频 s/${word.id}`).toBeDefined()
      }
    }
  })

  it('每句角色台词都有音频', () => {
    for (const list of Object.values(phrases)) {
      for (const p of list) {
        expect(clips[`p/${slug(p.en)}`], `缺少台词音频 "${p.en}"`).toBeDefined()
      }
    }
  })

  it('英语寻宝的每条完整提示都有离线音频', () => {
    for (const theme of themes) {
      for (const word of theme.words) {
        const text = (treasurePrompts as Record<string, string>)[word.id]
        expect(text, `缺少寻宝提示文案 ${word.id}`).toBeDefined()
        const clip = clips[`p/${slug(text)}`]
        expect(clip, `缺少寻宝提示音频 "${text}"`).toBeDefined()
        expect(clip!.text).toBe(text)
      }
    }
  })

  it('每个主题的完成台词都有音频', () => {
    for (const theme of themes) {
      const p = themeCompletePhrases[theme.id]
      expect(p, `主题 ${theme.id} 缺少完成台词`).toBeDefined()
      expect(clips[`p/${slug(p!.en)}`], `缺少完成台词音频 "${p!.en}"`).toBeDefined()
    }
  })

  it('清单里的文本与词表一致（改了文案要重新生成音频）', () => {
    for (const theme of themes) {
      for (const word of theme.words) {
        expect(clips[`w/${word.id}`]!.text).toBe(word.text)
        expect(clips[`s/${word.id}`]!.text).toBe(word.sentence)
      }
    }
  })

  it('清单里的每个片段都有对应的 m4a 文件', () => {
    for (const key of Object.keys(clips)) {
      const file = join(audioDir, `${key}.m4a`)
      expect(existsSync(file), `文件不存在: ${key}.m4a`).toBe(true)
      expect(statSync(file).size, `文件为空: ${key}.m4a`).toBeGreaterThan(500)
    }
  })

  it('没有清单之外的孤儿音频文件', () => {
    for (const sub of ['w', 's', 'p']) {
      const dir = join(audioDir, sub)
      if (!existsSync(dir)) continue
      for (const f of readdirSync(dir)) {
        const key = `${sub}/${f.replace(/\.m4a$/, '')}`
        expect(clips[key], `孤儿文件: ${sub}/${f}`).toBeDefined()
      }
    }
  })

  it('时长在合理范围内（异常值说明渲染出了问题）', () => {
    for (const [key, meta] of Object.entries(clips)) {
      // 下限只用来抓「渲染失败/被截断」。真实的短单音节词很短：
      // "egg" 在 110 wpm 下天然只有 150ms，不是 bug。
      expect(meta.durationMs, `${key} 时长过短`).toBeGreaterThan(120)
      expect(meta.durationMs, `${key} 时长过长`).toBeLessThan(6000)
    }
  })

  it('台词 slug 规则无冲突（不同台词不会映射到同一文件）', () => {
    const seen = new Map<string, string>()
    for (const list of Object.values(phrases)) {
      for (const p of list) {
        const s = slug(p.en)
        const prev = seen.get(s)
        if (prev && prev !== p.en) {
          throw new Error(`slug 冲突: "${prev}" 与 "${p.en}" 都是 "${s}"`)
        }
        seen.set(s, p.en)
      }
    }
  })
})
