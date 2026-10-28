import { statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { characterClipId } from '../src/audio/characterVoices'
import { getTheme, getWord } from '../src/content'
import manifest from '../src/content/audioManifest.json'
import { getCourseUnit } from '../src/content/curriculum'
import { courseWordGarden } from '../src/content/courseWordGardens'
import { getDialogueScene } from '../src/content/dialogues'
import scripts from '../src/content/storyScripts.json'
import {
  animatedStories,
  animatedStoryForTheme,
  animatedStoryForUnit,
  getAnimatedStory,
} from '../src/content/stories'

describe('原创配音动画内容', () => {
  it('故事均可从正确的单元和单词主题访问，ID 不冲突', () => {
    expect(animatedStories.map(({ id, unitId, themeId }) => [id, unitId, themeId])).toEqual([
      ['numbers', 'g1t1-u2', 'numbers'],
      ['family', 'g1t1-u3', 'family'],
      ['classroom', 'g1t1-u4', 'classroom'],
      ['school-things', 'g1t1-u5', 'school-things'],
      ['colors', 'g1t1-u6', 'colors'],
    ])
    expect(new Set(animatedStories.map((item) => item.id)).size).toBe(animatedStories.length)
    const lineIds = animatedStories.flatMap((item) => item.lines.map((line) => line.id))
    expect(new Set(lineIds).size).toBe(lineIds.length)
    for (const item of animatedStories) {
      expect(getCourseUnit(item.unitId), item.id).toBeDefined()
      expect(getTheme(item.themeId), item.id).toBeDefined()
      expect(getAnimatedStory(item.id)).toBe(item)
      expect(animatedStoryForUnit(item.unitId)).toBe(item)
      expect(animatedStoryForTheme(item.themeId)).toBe(item)
    }
  })

  it('每段动画有三章，字幕完整，逐章保持双方说话人的顺序', () => {
    for (const item of animatedStories) {
      const dialogue = getDialogueScene(item.id)!
      expect(item.chapters, item.id).toHaveLength(3)
      expect(item.lines, item.id).toHaveLength(9)
      for (const [chapter, heading] of item.chapters.entries()) {
        expect(heading.en.trim(), item.id).not.toBe('')
        expect(heading.zh.trim(), item.id).not.toBe('')
        const lines = item.lines.filter((line) => line.chapter === chapter)
        expect(lines.map((line) => line.speaker), `${item.id}/${chapter}`).toEqual(['momo', 'child', 'momo'])
        for (const line of lines) {
          expect(line.en.trim(), line.id).not.toBe('')
          expect(line.zh.trim(), line.id).not.toBe('')
        }
        // The first stories share dialogue scripts; the new episodes have their own action-led scripts.
        if (!scripts.some((script) => script.id === item.id)) {
          const turn = dialogue.turns[chapter]!
          expect(lines.map(({ en, zh }) => ({ en, zh })), `${item.id}/${chapter}`).toEqual([
            turn.prompt, turn.answer, turn.reply,
          ])
        }
      }
      expect(item.lines.map((line) => line.chapter), item.id).toEqual([0, 0, 0, 1, 1, 1, 2, 2, 2])
    }
  })

  it('新故事聚焦已核对的数字和教室词汇，故事结束有可继续练习的对话', () => {
    expect(getAnimatedStory('numbers')!.learning.wordIds).toEqual(['num-one', 'num-two', 'num-three'])
    expect(getAnimatedStory('classroom')!.learning.wordIds).toEqual(['door', 'window', 'chair'])
    for (const item of animatedStories) expect(getDialogueScene(item.id), item.id).toBeDefined()
    for (const script of scripts) {
      expect(getAnimatedStory(script.id)!.lines).toEqual(script.lines)
      expect(courseWordGarden(script.unitId)?.theme.id, script.id).toBe(script.themeId)
      for (const id of script.learning.wordIds) {
        expect(getWord(script.themeId, id)?.extension, id).not.toBe(true)
      }
    }
  })

  it('每句使用现有的完整配音文件，音频文本与字幕完全一致', () => {
    const clips = manifest.clips as Record<string, { text: string; durationMs: number }>
    for (const item of animatedStories) {
      for (const line of item.lines) {
        const key = characterClipId(line.speaker, line.en)
        expect(clips[key]?.text, `${item.id}/${line.id}`).toBe(line.en)
        expect(clips[key]?.durationMs, `${key} 音频时长异常`).toBeGreaterThan(120)
        const file = join(process.cwd(), 'public', 'audio', `${key}.m4a`)
        expect(statSync(file).size, `${line.id} 配音文件为空`).toBeGreaterThan(500)
      }
    }
  })

  it('每段学习目标来自真实词表，输出句确实由故事里的小朋友说过', () => {
    for (const story of animatedStories) {
      expect(story.learning.wordIds.length, story.id).toBeGreaterThanOrEqual(2)
      expect(story.learning.wordIds.length, story.id).toBeLessThanOrEqual(4)
      expect(new Set(story.learning.wordIds).size).toBe(story.learning.wordIds.length)
      for (const id of story.learning.wordIds) {
        const word = getWord(story.themeId, id)
        expect(word, `${story.id}/${id}`).toBeDefined()
        expect(story.lines.some((line) => line.en.toLowerCase().includes(word!.text.toLowerCase())), `${id} 没有在故事里出现`).toBe(true)
      }
      const practice = story.lines.find((line) => line.id === story.learning.practiceLineId)
      expect(practice?.speaker, story.id).toBe('child')
      expect(practice?.en.trim(), story.id).not.toBe('')
      expect(story.learning.pattern.en.trim(), story.id).not.toBe('')
      expect(story.learning.pattern.zh.trim(), story.id).not.toBe('')
    }
  })

  it('做客的 Momo 不用家人的称呼来招呼小朋友的长辈', () => {
    const family = getAnimatedStory('family')!
    for (const line of family.lines.filter((item) => item.speaker === 'momo')) {
      expect(line.en, line.id).not.toMatch(/\b(?:hello|hi|good\s+(?:morning|afternoon|evening))[,!\s]+(?:mum|mom|dad|grandma|grandpa)\b/i)
      expect(line.zh, line.id).not.toMatch(/(?:妈妈|爸爸|奶奶|外婆|爷爷|外公)[，,！!\s]*你好/)
    }
    const introductions = family.lines.filter((item) => item.speaker === 'child')
    expect(introductions[0].en).toContain('my mum')
    expect(introductions[1].en).toContain('my dad')
  })

  it('缺失路由或尚未提供动画的主题，不会错误打开某个故事', () => {
    for (const id of [undefined, '', 'missing']) {
      expect(getAnimatedStory(id)).toBeUndefined()
      expect(animatedStoryForUnit(id)).toBeUndefined()
      expect(animatedStoryForTheme(id)).toBeUndefined()
    }
    expect(animatedStoryForUnit('g1t1-u1')).toBeUndefined()
    expect(animatedStoryForTheme('animals')).toBeUndefined()
  })
})
