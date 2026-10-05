import scenes from './dialogues.json'
import type { Phrase } from './phrases'

export interface DialogueTurn {
  id: string
  /** Momo 先说，孩子回答，Momo 再自然回应。 */
  prompt: Phrase
  answer: Phrase
  reply: Phrase
  /** 现有单词图卡，帮助孩子理解情境；不要求答案就是这个单词。 */
  wordId?: string
}

export interface DialogueScene {
  id: string
  title: string
  zh: string
  emoji: string
  unitId: string
  themeId?: string
  turns: DialogueTurn[]
}

/** 按一年级六个单元主题编写的应用原创练习，不是课本原句或录音。 */
export const dialogueScenes: DialogueScene[] = scenes

export function getDialogueScene(id: string | undefined): DialogueScene | undefined {
  return dialogueScenes.find((scene) => scene.id === id)
}

export function dialogueSceneForTheme(themeId: string | undefined): DialogueScene | undefined {
  if (!themeId) return undefined
  return dialogueScenes.find((scene) => scene.themeId === themeId)
}

export function dialogueSceneForUnit(unitId: string | undefined): DialogueScene | undefined {
  return dialogueScenes.find((scene) => scene.unitId === unitId)
}
