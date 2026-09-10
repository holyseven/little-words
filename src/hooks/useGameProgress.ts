import { useCallback } from 'react'
import { useApp } from '../store/AppContext'
import { flushProgress, getThemeProgress } from '../store/progress'

export function useGameProgress(themeId: string) {
  const { updateProgress, addStars, checkThemeComplete, recordDaily } = useApp()
  const recordWord = useCallback((wordId: string, result?: 'correct' | 'wrong') => {
    updateProgress((p) => {
      const before = p.wordStats[wordId] ?? { seen: 0, correct: 0, wrong: 0, lastSeen: 0 }
      return { ...p, wordStats: { ...p.wordStats, [wordId]: {
        seen: before.seen + 1,
        correct: before.correct + (result === 'correct' ? 1 : 0),
        wrong: before.wrong + (result === 'wrong' ? 1 : 0),
        lastSeen: Date.now(),
      } } }
    })
    if (result === 'correct') recordDaily({ kind: 'review', wordId })
  }, [updateProgress, recordDaily])

  const finishRound = useCallback((game: 'memory' | 'bubble', score: number) => {
    // 调用方先同步锁定局末；只有完成整局才写 best 和 +5 奖励。
    updateProgress((p) => {
      const tp = getThemeProgress(p, themeId)
      return { ...p, themes: { ...p.themes, [themeId]: {
        ...tp, best: { ...tp.best, [game]: Math.max(tp.best[game] ?? 0, score) },
      } } }
    })
    addStars(5)
    checkThemeComplete(themeId)
    if (game === 'memory') recordDaily({ kind: 'memory', themeId })
    void flushProgress()
  }, [themeId, updateProgress, addStars, checkThemeComplete, recordDaily])
  return { recordWord, finishRound }
}
