import { describe, expect, it } from 'vitest'
import {
  RESTAURANT_MENU,
  RESTAURANT_OPTION_COUNT,
  RESTAURANT_ROUND_SIZE,
  buildRestaurantRound,
  checkRestaurantPlate,
  orderSentence,
} from '../src/logic/restaurant'

function seeded(seed: number) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 2 ** 32
  }
}

describe('restaurant menu and requests', () => {
  it('uses countable whole foods with explicit singular and plural forms', () => {
    expect(RESTAURANT_MENU.map(({ id, singular, plural }) => [id, singular, plural]))
      .toEqual([
        ['apple', 'apple', 'apples'],
        ['banana', 'banana', 'bananas'],
        ['orange', 'orange', 'oranges'],
        ['pear', 'pear', 'pears'],
        ['peach', 'peach', 'peaches'],
        ['lemon', 'lemon', 'lemons'],
        ['strawberry', 'strawberry', 'strawberries'],
        ['cookie', 'cookie', 'cookies'],
        ['egg', 'egg', 'eggs'],
      ])
    expect(RESTAURANT_MENU.every((item) => item.emoji && item.zh)).toBe(true)
    for (const id of ['rice', 'milk', 'bread', 'cheese', 'juice', 'grapes', 'watermelon', 'pizza', 'cherry']) {
      expect(RESTAURANT_MENU.some((item) => item.id === id)).toBe(false)
    }
  })

  it('says one item in the singular and two or three in the plural', () => {
    for (const item of RESTAURANT_MENU) {
      expect(orderSentence(item, 1)).toBe(`One ${item.singular}, please!`)
      expect(orderSentence(item, 2)).toBe(`Two ${item.plural}, please!`)
      expect(orderSentence(item, 3)).toBe(`Three ${item.plural}, please!`)
    }
  })
})

describe('buildRestaurantRound', () => {
  it('starts with two apples and uses six distinct foods in quantities from one to three', () => {
    const orders = buildRestaurantRound(seeded(7))
    expect(orders).toHaveLength(RESTAURANT_ROUND_SIZE)
    expect(orders[0]).toMatchObject({
      food: { id: 'apple' }, quantity: 2, sentence: 'Two apples, please!',
    })
    expect(new Set(orders.map((order) => order.food.id)).size).toBe(RESTAURANT_ROUND_SIZE)
    for (const order of orders) {
      expect([1, 2, 3]).toContain(order.quantity)
      expect(order.sentence).toBe(orderSentence(order.food, order.quantity))
    }
  })

  it('includes exactly one target and two different menu distractors per order', () => {
    for (const order of buildRestaurantRound(seeded(19))) {
      const ids = order.options.map((option) => option.id)
      expect(ids).toHaveLength(RESTAURANT_OPTION_COUNT)
      expect(new Set(ids).size).toBe(RESTAURANT_OPTION_COUNT)
      expect(ids.filter((id) => id === order.food.id)).toHaveLength(1)
      expect(ids.every((id) => RESTAURANT_MENU.some((item) => item.id === id))).toBe(true)
    }
  })

  it('shuffles the target position, including the introductory apple order', () => {
    const positions = new Set<number>()
    const laterQuantities = new Set<number>()
    for (let seed = 1; seed <= 30; seed++) {
      const orders = buildRestaurantRound(seeded(seed))
      positions.add(orders[0].options.findIndex((item) => item.id === 'apple'))
      orders.slice(1).forEach((order) => laterQuantities.add(order.quantity))
    }
    expect([...positions].sort()).toEqual([0, 1, 2])
    expect([...laterQuantities].sort()).toEqual([1, 2, 3])
  })

  it('is reproducible and leaves the menu intact', () => {
    const before = JSON.stringify(RESTAURANT_MENU)
    expect(buildRestaurantRound(seeded(23))).toEqual(buildRestaurantRound(seeded(23)))
    expect(JSON.stringify(RESTAURANT_MENU)).toBe(before)
  })
})

describe('checkRestaurantPlate', () => {
  const order = buildRestaurantRound(seeded(1))[0]

  it('accepts exactly the requested two apples', () => {
    expect(checkRestaurantPlate(order, ['apple', 'apple'])).toBe('correct')
  })

  it('does not accept an empty, incomplete, or oversized plate', () => {
    expect(checkRestaurantPlate(order, [])).toBe('empty')
    expect(checkRestaurantPlate(order, ['apple'])).toBe('too-few')
    expect(checkRestaurantPlate(order, ['apple', 'apple', 'apple'])).toBe('too-many')
  })

  it('requires the food and the quantity to match together', () => {
    expect(checkRestaurantPlate(order, ['banana', 'banana'])).toBe('wrong-food')
    expect(checkRestaurantPlate(order, ['apple', 'banana'])).toBe('wrong-food')
    expect(checkRestaurantPlate(order, ['apple', 'apple', 'banana'])).toBe('wrong-food')
    expect(checkRestaurantPlate(order, ['unknown', 'unknown'])).toBe('wrong-food')
  })

  it('does not change the order or plate while checking', () => {
    const plate = Object.freeze(['apple', 'apple'])
    const before = JSON.stringify(order)
    checkRestaurantPlate(order, plate)
    expect(plate).toEqual(['apple', 'apple'])
    expect(JSON.stringify(order)).toBe(before)
  })
})
