/**
 * 陪伴角色 Momo 的台词库（SPEC 7.7）。
 * 英文为 TTS 朗读内容，中文为气泡里的小字提示（家长可关）。
 */

export interface Phrase {
  en: string
  zh: string
}

export const phrases = {
  greet: [
    { en: "Hi! Let's learn some words!", zh: '嗨！我们来学单词吧！' },
    { en: 'Hi there!', zh: '你好呀！' },
    { en: "Let's play!", zh: '一起玩吧！' },
    { en: 'Ready to learn?', zh: '准备好了吗？' },
  ],
  correct: [
    { en: 'Great job!', zh: '做得好！' },
    { en: 'You did it!', zh: '你做到了！' },
    { en: 'Awesome!', zh: '太棒了！' },
    { en: 'Yes!', zh: '对啦！' },
  ],
  wrong: [
    { en: 'Try again!', zh: '再试一次！' },
    { en: 'Almost!', zh: '就差一点！' },
    { en: 'Listen once more.', zh: '再听一遍。' },
  ],
  finish: [
    { en: 'You finished!', zh: '你完成啦！' },
    { en: 'Amazing work!', zh: '真厉害！' },
    { en: 'See you tomorrow!', zh: '明天见！' },
  ],
  /** 获得贴纸（SPEC 7.8） */
  sticker: [{ en: 'You got a new sticker!', zh: '你得到一张新贴纸！' }],
  rest: [{ en: 'Time to rest. See you tomorrow!', zh: '该休息啦。明天见！' }],
} satisfies Record<string, Phrase[]>

export type PhraseKind = keyof typeof phrases

/** 随机取一句台词 */
export function pickPhrase(kind: PhraseKind): Phrase {
  const list = phrases[kind]
  return list[Math.floor(Math.random() * list.length)]!
}

/**
 * 完成主题时的专属台词（SPEC 7.2）。
 * 逐条写出来而不是模板拼接，这样 gen-audio.mjs 能扫到并预生成音频。
 */
export const themeCompletePhrases: Record<string, Phrase> = {
  animals: { en: 'You finished Animals! Amazing!', zh: '你完成了动物主题！真厉害！' },
  fruits: { en: 'You finished Fruits! Amazing!', zh: '你完成了水果主题！真厉害！' },
  colors: { en: 'You finished Colors! Amazing!', zh: '你完成了颜色主题！真厉害！' },
  numbers: { en: 'You finished Numbers! Amazing!', zh: '你完成了数字主题！真厉害！' },
  vehicles: { en: 'You finished Vehicles! Amazing!', zh: '你完成了交通工具主题！真厉害！' },
  weather: { en: 'You finished Weather! Amazing!', zh: '你完成了天气主题！真厉害！' },
  body: { en: 'You finished Body! Amazing!', zh: '你完成了身体主题！真厉害！' },
  food: { en: 'You finished Food! Amazing!', zh: '你完成了食物主题！真厉害！' },
}

/** 取主题完成台词；没有专属台词时退回通用的「完成」台词 */
export function themeCompletePhrase(themeId: string): Phrase {
  return themeCompletePhrases[themeId] ?? { en: 'Amazing work!', zh: '真厉害！' }
}
