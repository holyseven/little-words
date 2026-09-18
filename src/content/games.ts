/** 游戏乐园与主题快捷入口共用这一份目录。 */
export const parkGames = [
  { id: 'train', emoji: '🚂', title: 'Word Train', zh: '单词小火车', description: 'Listen, then board in order.', hint: '听清顺序，让乘客上车', tint: 'var(--sky)', themes: [] as string[] },
  { id: 'treasure', emoji: '🔎', title: 'Treasure Hunt', zh: '英语寻宝', description: 'Listen and search the forest.', hint: '听提示，在森林里找宝藏', tint: 'var(--sage)', themes: [] as string[] },
  { id: 'restaurant', emoji: '👾', title: 'Monster Restaurant', zh: '怪兽餐厅', description: 'Listen, count and serve.', hint: '听点餐，数一数，拖食物', tint: 'var(--peach)', themes: ['food'] },
  { id: 'speak', emoji: '🥚', title: 'Picture Speak', zh: '看图开口', description: 'Say the word. Hatch a surprise!', hint: '看图片，说单词，让惊喜破壳', tint: 'var(--lilac)', themes: [] as string[] },
] as const

export type ParkGameId = typeof parkGames[number]['id']
export function isParkGameId(value: string | null | undefined): value is ParkGameId {
  return parkGames.some((game) => game.id === value)
}
