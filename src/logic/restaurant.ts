import type { Word } from '../content/types'
import fruits from '../content/themes/fruits.json'
import food from '../content/themes/food.json'
import { shuffle, type Rng } from './pickWords'

export interface RestaurantFood extends Word {
  singular: string
  plural: string
}

export type RestaurantQuantity = 1 | 2 | 3

export interface RestaurantOrder {
  food: RestaurantFood
  quantity: RestaurantQuantity
  sentence: string
  options: RestaurantFood[]
}

export const RESTAURANT_ROUND_SIZE = 6
export const RESTAURANT_OPTION_COUNT = 3

// Each picture represents one whole item. Exclude drinks, mass nouns and
// pictures of slices or bunches, so the child can count what they deliver.
const menuForms = [
  ['apple', 'apple', 'apples'],
  ['banana', 'banana', 'bananas'],
  ['orange', 'orange', 'oranges'],
  ['pear', 'pear', 'pears'],
  ['peach', 'peach', 'peaches'],
  ['lemon', 'lemon', 'lemons'],
  ['strawberry', 'strawberry', 'strawberries'],
  ['cookie', 'cookie', 'cookies'],
  ['egg', 'egg', 'eggs'],
] as const

const sourceWords: Word[] = [...fruits.words, ...food.words]

export const RESTAURANT_MENU: readonly RestaurantFood[] = menuForms.map(
  ([id, singular, plural]) => {
    const word = sourceWords.find((candidate) => candidate.id === id)
    if (!word) throw new Error(`[restaurant] Missing menu word: ${id}`)
    return { ...word, singular, plural }
  },
)

export function orderSentence(food: RestaurantFood, quantity: RestaurantQuantity): string {
  const number = { 1: 'One', 2: 'Two', 3: 'Three' }[quantity]
  return `${number} ${quantity === 1 ? food.singular : food.plural}, please!`
}

/** Six different foods; the first order introduces the game with two apples. */
export function buildRestaurantRound(rng: Rng = Math.random): RestaurantOrder[] {
  const apple = RESTAURANT_MENU.find((item) => item.id === 'apple')!
  const targets = [
    apple,
    ...shuffle(RESTAURANT_MENU.filter((item) => item.id !== apple.id), rng)
      .slice(0, RESTAURANT_ROUND_SIZE - 1),
  ]

  return targets.map((target, index) => {
    const quantity: RestaurantQuantity = index === 0
      ? 2
      : (Math.floor(rng() * 3) + 1) as RestaurantQuantity
    const distractors = shuffle(
      RESTAURANT_MENU.filter((item) => item.id !== target.id),
      rng,
    ).slice(0, RESTAURANT_OPTION_COUNT - 1)

    return {
      food: target,
      quantity,
      sentence: orderSentence(target, quantity),
      options: shuffle([target, ...distractors], rng),
    }
  })
}

export type RestaurantPlateResult = 'empty' | 'wrong-food' | 'too-few' | 'too-many' | 'correct'

/** Check the whole served plate; extra or incorrect food can never win. */
export function checkRestaurantPlate(
  order: Pick<RestaurantOrder, 'food' | 'quantity'>,
  plate: readonly string[],
): RestaurantPlateResult {
  if (plate.length === 0) return 'empty'
  if (plate.some((id) => id !== order.food.id)) return 'wrong-food'
  if (plate.length < order.quantity) return 'too-few'
  if (plate.length > order.quantity) return 'too-many'
  return 'correct'
}
