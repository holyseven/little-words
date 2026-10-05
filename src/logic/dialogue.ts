export type DialogueResponse = 'spoken' | 'self'
export interface DialogueState {
  phase: 'intro' | 'answering' | 'replied' | 'done'
  index: number
  responses: DialogueResponse[]
}
export type DialogueAction =
  | { type: 'start' | 'restart' }
  | { type: 'answer'; index: number; mode: DialogueResponse }
  | { type: 'next'; index: number }

export const initialDialogueState: DialogueState = { phase: 'intro', index: 0, responses: [] }

/** One response per turn. Late recognition callbacks cannot answer a later turn. */
export function advanceDialogue(state: DialogueState, action: DialogueAction, turnCount: number): DialogueState {
  if (turnCount < 1) return state
  if (action.type === 'restart') return { phase: 'answering', index: 0, responses: [] }
  if (action.type === 'start') return state.phase === 'intro' ? { ...state, phase: 'answering' } : state
  if (action.type === 'answer') {
    if (state.phase !== 'answering' || action.index !== state.index) return state
    return { ...state, phase: 'replied', responses: [...state.responses, action.mode] }
  }
  if (action.type === 'next' && state.phase === 'replied' && action.index === state.index) {
    return state.index + 1 === turnCount
      ? { ...state, phase: 'done' }
      : { ...state, phase: 'answering', index: state.index + 1 }
  }
  return state
}
