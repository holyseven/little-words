import { describe, expect, it } from 'vitest'
import { getWord } from '../src/content'
import { courseUnits } from '../src/content/curriculum'
import { courseWordGarden } from '../src/content/courseWordGardens'
import {
  dialogueSceneForTheme,
  dialogueSceneForUnit,
  dialogueScenes,
  getDialogueScene,
} from '../src/content/dialogues'

describe('简单对话内容', () => {
  it('六个课本单元各有一个可访问场景，单词主题入口指向同一份内容', () => {
    expect(dialogueScenes).toHaveLength(courseUnits.length)
    for (const unit of courseUnits) {
      const scenes = dialogueScenes.filter((scene) => scene.unitId === unit.id)
      expect(scenes, unit.id).toHaveLength(1)
      const scene = scenes[0]!
      expect(dialogueSceneForUnit(unit.id)).toBe(scene)
      expect(getDialogueScene(scene.id)).toBe(scene)
      const garden = courseWordGarden(unit.id)
      if (garden) {
        expect(scene.themeId).toBe(garden.theme.id)
        expect(dialogueSceneForTheme(garden.theme.id)).toBe(scene)
      } else {
        expect(scene.themeId).toBeUndefined()
      }
    }
  })

  it('每场三轮，有完整的中英提问、简短示范回答和回应', () => {
    const sceneIds = new Set<string>()
    const turnIds = new Set<string>()
    for (const scene of dialogueScenes) {
      expect(sceneIds.has(scene.id), `场景 ID 重复：${scene.id}`).toBe(false)
      sceneIds.add(scene.id)
      expect(scene.title.trim()).not.toBe('')
      expect(scene.zh.trim()).not.toBe('')
      expect(scene.emoji.trim()).not.toBe('')
      expect(scene.turns, scene.id).toHaveLength(3)
      for (const turn of scene.turns) {
        expect(turnIds.has(turn.id), `轮次 ID 重复：${turn.id}`).toBe(false)
        turnIds.add(turn.id)
        for (const phrase of [turn.prompt, turn.answer, turn.reply]) {
          expect(phrase.en.trim(), turn.id).not.toBe('')
          expect(phrase.zh.trim(), turn.id).not.toBe('')
        }
        const answerWords = turn.answer.en.match(/[a-z]+/gi) ?? []
        expect(answerWords.length, turn.id).toBeGreaterThan(0)
        expect(answerWords.length, `${turn.id} 回答过长`).toBeLessThanOrEqual(5)
        // 发音检测按完整词对齐；示范回答暂不用缩写，降低一年级开口难度。
        expect(turn.answer.en, turn.id).not.toMatch(/['’]/)
      }
    }
  })

  it('所有配图均来自对应主题的现有词表，不会显示缺失图卡', () => {
    for (const scene of dialogueScenes) {
      for (const turn of scene.turns) {
        if (!turn.wordId) continue
        expect(scene.themeId, turn.id).toBeDefined()
        expect(getWord(scene.themeId!, turn.wordId), `${turn.id} 缺少 ${turn.wordId}`).toBeDefined()
      }
    }
  })

  it('缺少或未知的路由参数不会误入 Hello 场景', () => {
    for (const id of [undefined, '', 'missing']) {
      expect(getDialogueScene(id)).toBeUndefined()
      expect(dialogueSceneForUnit(id)).toBeUndefined()
      expect(dialogueSceneForTheme(id)).toBeUndefined()
    }
    expect(dialogueSceneForTheme('animals')).toBeUndefined()
  })
})
