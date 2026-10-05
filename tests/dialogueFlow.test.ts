import { describe, it, expect } from 'vitest'
import { advanceDialogue, initialDialogueState } from '../src/logic/dialogue'

describe('三轮对话流程', () => {
  it('没有回应不能跳过，手动练习和识别回应分别保留', () => {
    let state = advanceDialogue(initialDialogueState, { type: 'start' }, 3)
    expect(advanceDialogue(state, { type: 'next', index: 0 }, 3)).toBe(state)
    state = advanceDialogue(state, { type: 'answer', index: 0, mode: 'self' }, 3)
    expect(state.responses).toEqual(['self'])
    expect(advanceDialogue(state, { type: 'answer', index: 0, mode: 'spoken' }, 3)).toBe(state)
    state = advanceDialogue(state, { type: 'next', index: 0 }, 3)
    expect(state.index).toBe(1)
    expect(advanceDialogue(state, { type: 'answer', index: 0, mode: 'spoken' }, 3)).toBe(state)
    state = advanceDialogue(state, { type: 'answer', index: 1, mode: 'spoken' }, 3)
    expect(state.responses).toEqual(['self', 'spoken'])
  })

  it('完整三轮后结束，再练一遍清空本轮状态', () => {
    let state = advanceDialogue(initialDialogueState, { type: 'start' }, 3)
    for (let index = 0; index < 3; index++) {
      state = advanceDialogue(state, { type: 'answer', index, mode: 'self' }, 3)
      state = advanceDialogue(state, { type: 'next', index }, 3)
    }
    expect(state.phase).toBe('done')
    expect(state.responses).toHaveLength(3)
    expect(advanceDialogue(state, { type: 'next', index: 2 }, 3)).toBe(state)
    expect(advanceDialogue(state, { type: 'restart' }, 3)).toEqual({ phase: 'answering', index: 0, responses: [] })
  })

  it('空场景无法开始', () => {
    expect(advanceDialogue(initialDialogueState, { type: 'start' }, 0)).toBe(initialDialogueState)
  })
})
