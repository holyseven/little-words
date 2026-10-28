import { getDialogueScene } from './dialogues'
import type { Phrase } from './phrases'
import scripts from './storyScripts.json'

export type AnimatedStoryId = 'numbers' | 'family' | 'classroom' | 'school-things' | 'colors'

export interface StoryLine {
  id: string
  speaker: 'momo' | 'child'
  en: string
  zh: string
  chapter: 0 | 1 | 2
}

export interface AnimatedStory {
  id: AnimatedStoryId
  title: string
  zh: string
  summary: string
  summaryEn: string
  unitId: string
  themeId: string
  emoji: string
  chapters: { en: string; zh: string }[]
  learning: {
    wordIds: string[]
    pattern: Phrase
    /** A child's existing line to say after watching; not a mastery score. */
    practiceLineId: string
  }
  lines: StoryLine[]
}

/**
 * 首批三段应用原创小剧场沿用已有对话；新剧本单独编写，不是课本原片。
 * 台词按「Momo 提问 → 小朋友回答 → Momo 回应」播放，供画面同步使用。
 */
function story(metadata: Omit<AnimatedStory, 'lines'>): AnimatedStory {
  const dialogue = getDialogueScene(metadata.id)
  if (!dialogue || dialogue.turns.length !== 3) {
    throw new Error(`Missing three-chapter story dialogue: ${metadata.id}`)
  }
  const lines: StoryLine[] = dialogue.turns.flatMap((turn, index) => {
    const chapter = index as StoryLine['chapter']
    return [
      { id: `${turn.id}-prompt`, speaker: 'momo', ...turn.prompt, chapter },
      { id: `${turn.id}-answer`, speaker: 'child', ...turn.answer, chapter },
      { id: `${turn.id}-reply`, speaker: 'momo', ...turn.reply, chapter },
    ] satisfies StoryLine[]
  })
  return { ...metadata, lines }
}

const dialogueStories: AnimatedStory[] = [
  story({
    id: 'family',
    title: 'Momo Visits My Home',
    zh: 'Momo 来做客',
    summary: 'Momo 来到家里，一起介绍妈妈、爸爸和奶奶。',
    summaryEn: "Momo visits a friend's home and meets Mum, Dad and Grandma.",
    unitId: 'g1t1-u3',
    themeId: 'family',
    emoji: '🏡',
    learning: {
      wordIds: ['mum', 'dad', 'grandma'],
      pattern: { en: 'This is my …', zh: '这是我的……' },
      practiceLineId: 'family-mum-answer',
    },
    chapters: [
      { en: 'Meet Mum', zh: '见见妈妈' },
      { en: 'Meet Dad', zh: '见见爸爸' },
      { en: 'Meet Grandma', zh: '见见奶奶' },
    ],
  }),
  story({
    id: 'school-things',
    title: 'Pencil, Please!',
    zh: '铅笔借给你',
    summary: '借一支铅笔，找到一本书，再和 Momo 一起打开铅笔盒。',
    summaryEn: 'Share a pencil, find a book, and open the pencil case with Momo.',
    unitId: 'g1t1-u5',
    themeId: 'school-things',
    emoji: '🎒',
    learning: {
      wordIds: ['pencil', 'book', 'pencil-case'],
      pattern: { en: 'Here you are.', zh: '给你。' },
      practiceLineId: 'school-things-pencil-answer',
    },
    chapters: [
      { en: 'A Pencil, Please', zh: '借一支铅笔' },
      { en: 'Your Book', zh: '找到你的书' },
      { en: 'Open the Pencil Case', zh: '打开铅笔盒' },
    ],
  }),
  story({
    id: 'colors',
    title: 'The Balloon Colors',
    zh: '气球的颜色',
    summary: '和 Momo 一起看看红、蓝、黄气球，说说它们的颜色。',
    summaryEn: 'Look at red, blue and yellow balloons with Momo and name their colors.',
    unitId: 'g1t1-u6',
    themeId: 'colors',
    emoji: '🎈',
    learning: {
      wordIds: ['color-red', 'color-blue', 'color-yellow'],
      pattern: { en: 'It is …', zh: '是……色。' },
      practiceLineId: 'colors-red-answer',
    },
    chapters: [
      { en: 'A Red Balloon', zh: '红气球' },
      { en: 'A Blue Balloon', zh: '蓝气球' },
      { en: 'A Yellow Balloon', zh: '黄气球' },
    ],
  }),
]

/** JSON is shared with the build-time audio generator; content tests verify its schema and curriculum links. */
export const animatedStories: AnimatedStory[] = [
  ...dialogueStories,
  ...(scripts as AnimatedStory[]),
].sort((a, b) => a.unitId.localeCompare(b.unitId))

export function getAnimatedStory(id: string | undefined): AnimatedStory | undefined {
  return animatedStories.find((item) => item.id === id)
}

export function animatedStoryForUnit(unitId: string | undefined): AnimatedStory | undefined {
  return animatedStories.find((item) => item.unitId === unitId)
}

export function animatedStoryForTheme(themeId: string | undefined): AnimatedStory | undefined {
  return animatedStories.find((item) => item.themeId === themeId)
}
