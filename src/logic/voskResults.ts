import type { RepeatRecognitionEvidence, RepeatRecognitionWord } from './repeat'

type FinalEvidence = Pick<RepeatRecognitionEvidence, 'finalText' | 'finalWords'>

/** Each Vosk endpoint contains only the new segment, not the entire utterance. */
export function mergeVoskFinal(
  previous: FinalEvidence,
  text: string,
  words: RepeatRecognitionWord[],
  sentencePractice: boolean,
): FinalEvidence {
  const trimmed = text.trim()
  if (!trimmed) return previous
  return {
    finalText: sentencePractice && previous.finalText ? `${previous.finalText} ${trimmed}` : trimmed,
    finalWords: sentencePractice ? [...previous.finalWords, ...words] : words,
  }
}

export interface VoskResultWaiter {
  done: Promise<void>
  onFinalResult: (hasText: boolean) => void
  onPartialResult: () => void
  cancel: () => void
}

/** Vosk does not distinguish endpoint results from the final flush response. */
export function createVoskResultWaiter(sentencePractice: boolean): VoskResultWaiter {
  let resolve: () => void = () => {}
  const done = new Promise<void>((complete) => { resolve = complete })
  let settled = false
  let sawFinal = false
  let settleTimer: ReturnType<typeof setTimeout> | null = null
  const complete = () => {
    if (settled) return
    settled = true
    clearTimeout(timeout)
    if (settleTimer !== null) clearTimeout(settleTimer)
    resolve()
  }
  const timeout = setTimeout(complete, 3200)
  const waitForQuiet = () => {
    if (settled || !sawFinal) return
    if (settleTimer !== null) clearTimeout(settleTimer)
    settleTimer = setTimeout(complete, 240)
  }
  return {
    done,
    onFinalResult(hasText) {
      if (!sentencePractice) {
        if (hasText) complete()
        return
      }
      // Empty flush results are meaningful too, after an earlier endpoint.
      sawFinal = true
      waitForQuiet()
    },
    onPartialResult() { if (sentencePractice) waitForQuiet() },
    cancel: complete,
  }
}
