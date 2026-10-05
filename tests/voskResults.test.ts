import { afterEach, describe, expect, it, vi } from 'vitest'
import { decideRepeat, type RepeatRecognitionWord } from '../src/logic/repeat'
import { createVoskResultWaiter, mergeVoskFinal } from '../src/logic/voskResults'

const emptyFinal = () => ({ finalText: '', finalWords: [] as RepeatRecognitionWord[] })
const words = (text: string, conf = 0.9) => text.split(' ').map((word) => ({ word, conf }))

describe('Vosk sentence endpoints', () => {
  it('recognizes a sentence across a pause without losing earlier word evidence', () => {
    const first = mergeVoskFinal(emptyFinal(), 'this is', words('this is'), true)
    const second = mergeVoskFinal(first, 'my mum', words('my mum'), true)
    expect(decideRepeat({ ...first, partialText: '', soundMs: 700 }, 'this is my mum').matched).toBe(false)
    expect(decideRepeat({ ...second, partialText: '', soundMs: 1200 }, 'this is my mum')).toMatchObject({ matched: true, uncertain: false })
    expect(mergeVoskFinal(second, '', [], true)).toEqual(second)
    expect(first.finalWords.map((word) => word.word)).toEqual(['this', 'is'])
  })

  it('keeps word order and weak confidence instead of accepting a bag of words', () => {
    const first = mergeVoskFinal(emptyFinal(), 'my mum', words('my mum'), true)
    const reversed = mergeVoskFinal(first, 'this is', words('this is'), true)
    expect(decideRepeat({ ...reversed, partialText: '', soundMs: 1200 }, 'this is my mum').matched).toBe(false)
    const weak = mergeVoskFinal(
      mergeVoskFinal(emptyFinal(), 'this is', words('this is'), true),
      'my mum', words('my mum', 0.3), true,
    )
    expect(decideRepeat({ ...weak, partialText: '', soundMs: 1200 }, 'this is my mum')).toMatchObject({ matched: true, uncertain: true, confidence: 0.3 })
  })

  it('keeps the existing replacement behavior for word practice', () => {
    const first = mergeVoskFinal(emptyFinal(), 'cat', words('cat'), false)
    const second = mergeVoskFinal(first, 'dog', words('dog'), false)
    expect(second).toEqual({ finalText: 'dog', finalWords: words('dog') })
  })
})

describe('Vosk final result waiting', () => {
  afterEach(() => { vi.useRealTimers() })

  it('waits for later sentence endpoints and an empty flush instead of using the first result', async () => {
    vi.useFakeTimers()
    const waiter = createVoskResultWaiter(true)
    const complete = vi.fn()
    void waiter.done.then(complete)
    waiter.onFinalResult(true)
    await vi.advanceTimersByTimeAsync(180)
    waiter.onPartialResult()
    await vi.advanceTimersByTimeAsync(180)
    expect(complete).not.toHaveBeenCalled()
    waiter.onFinalResult(true)
    await vi.advanceTimersByTimeAsync(180)
    waiter.onFinalResult(false)
    await vi.advanceTimersByTimeAsync(239)
    expect(complete).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(complete).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('still returns on the first nonempty final for word practice', async () => {
    vi.useFakeTimers()
    const waiter = createVoskResultWaiter(false)
    const complete = vi.fn()
    void waiter.done.then(complete)
    waiter.onFinalResult(false)
    await vi.advanceTimersByTimeAsync(500)
    expect(complete).not.toHaveBeenCalled()
    waiter.onFinalResult(true)
    await waiter.done
    expect(complete).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cancels a settling sentence without leaving timers or hanging the caller', async () => {
    vi.useFakeTimers()
    const waiter = createVoskResultWaiter(true)
    const complete = vi.fn()
    void waiter.done.then(complete)
    waiter.onFinalResult(true)
    await vi.advanceTimersByTimeAsync(100)
    waiter.cancel()
    await waiter.done
    waiter.onFinalResult(true)
    waiter.onPartialResult()
    expect(complete).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('uses a bounded timeout if the worker never answers', async () => {
    vi.useFakeTimers()
    const waiter = createVoskResultWaiter(true)
    const complete = vi.fn()
    void waiter.done.then(complete)
    await vi.advanceTimersByTimeAsync(3200)
    expect(complete).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })
})
