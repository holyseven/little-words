/**
 * 看图开口：只显示图片，让孩子说出对应的单词。
 * 录音只在内存中送入本机识别器，不保存音频。
 */

import { useEffect, useMemo, useRef, useState } from 'react'

import './PictureSpeak.css'
import { getTheme } from '../../content'
import { WordArt } from '../../content/svg/WordArt'
import { navigate } from '../../router'
import { useApp } from '../../store/AppContext'
import { BigButton } from '../../components/BigButton'
import { GameScreen } from '../../components/GameScreen'
import { InlineWordRepeat, type InlineWordRepeatHandle } from '../../components/InlineWordRepeat'
import { burstCelebrate, burstSmall, clearConfetti } from '../../components/Confetti'
import { useAudioUnlocked } from '../../hooks/useAudioUnlocked'
import { useSfx } from '../../hooks/useSfx'
import { useVoice } from '../../hooks/useVoice'
import { NotFound } from '../NotFound'

interface Props { themeId: string }
type Outcome = 'waiting' | 'correct'

const ROUND_SIZE = 6

export function PictureSpeak({ themeId }: Props) {
  const theme = getTheme(themeId)
  const { settings } = useApp()
  const { unlock } = useAudioUnlocked()
  const sfx = useSfx()
  const { sayWord, stop } = useVoice()
  const repeat = useRef<InlineWordRepeatHandle>(null)
  const [index, setIndex] = useState(0)
  const [outcome, setOutcome] = useState<Outcome>('waiting')

  const words = useMemo(() => theme?.words.slice(0, Math.min(ROUND_SIZE, theme.words.length)) ?? [], [theme])
  const word = words[index]

  useEffect(() => () => { repeat.current?.cancel(); stop(); clearConfetti() }, [stop])

  if (!theme || words.length === 0 || !word) return <NotFound />

  const startListening = () => {
    unlock()
    stop()
    setOutcome('waiting')
  }

  const onSuccess = () => {
    setOutcome('correct')
    const effect = Math.floor(Math.random() * 4)
    if (effect === 0) { sfx.celebrate(); burstSmall() }
    else if (effect === 1) { sfx.sticker(); burstCelebrate() }
    else if (effect === 2) { sfx.correct(); burstSmall() }
    else { sfx.pop(); burstSmall() }
  }

  const next = () => {
    repeat.current?.cancel()
    clearConfetti()
    if (index + 1 >= words.length) {
      sfx.celebrate()
      burstCelebrate()
      setIndex(words.length)
      return
    }
    setIndex((value) => value + 1)
    setOutcome('waiting')
  }

  if (index >= words.length) {
    return (
      <GameScreen themeId={theme.id} label={settings.showZh ? '看图开口 · 完成' : 'Picture Speak · Done'} className="picture-speak">
        <div className="page__body game__center picture-speak__done">
          <span className="emoji game__intro-icon" aria-hidden="true">🎉</span>
          <h1>{settings.showZh ? '完成啦！' : 'You did it!'}</h1>
          <p>{settings.showZh ? `你练习了 ${words.length} 个单词` : `You practiced ${words.length} words`}</p>
          <div className="game__actions">
            <BigButton icon="🔁" onClick={() => { setIndex(0); setOutcome('waiting') }}>{settings.showZh ? '再来一次' : 'Play again'}</BigButton>
            <BigButton variant="primary" icon="🏠" onClick={() => navigate(`/theme/${theme.id}`)}>{settings.showZh ? '回主题' : 'Back to theme'}</BigButton>
          </div>
        </div>
      </GameScreen>
    )
  }

  return (
    <GameScreen themeId={theme.id} label={`${settings.showZh ? '看图开口' : 'Picture Speak'}  ·  ${index + 1}/${words.length}`} className="picture-speak">
      <div className="page__body picture-speak__body">
        <p className="picture-speak__instruction">{settings.showZh ? '小动物躲在蛋里，说出它的名字吧' : 'A little animal is hiding in the egg. Say its name!'}</p>
        <section className={`picture-speak__card ${outcome === 'correct' ? 'is-correct' : ''}`} aria-live="polite">
          <div className={`picture-speak__egg ${outcome === 'correct' ? 'is-hatched' : ''}`}>
            <WordArt word={word} className="picture-speak__art" />
            <span className="picture-speak__shell picture-speak__shell--top" aria-hidden="true" />
            <span className="picture-speak__shell picture-speak__shell--bottom" aria-hidden="true" />
            <span className="picture-speak__crack" aria-hidden="true">⌁</span>
          </div>
          {outcome === 'correct' && (
            <div className="picture-speak__answer">
              <strong>{word.text}</strong>
              {settings.showZh && <span>{word.zh}</span>}
            </div>
          )}
        </section>
        {outcome !== 'correct' && (
          <BigButton variant="soft" icon="🔊" onClick={() => { unlock(); sayWord(word) }}>
            {settings.showZh ? '听提示' : 'Hear a hint'}
          </BigButton>
        )}
        <InlineWordRepeat
          key={word.id}
          ref={repeat}
          word={word.text}
          showZh={settings.showZh}
          onBeforeStart={startListening}
          onSuccess={onSuccess}
          buttonText={settings.showZh ? '说一说' : 'Say it'}
        />
        {outcome === 'correct' && (
          <BigButton variant="primary" icon={index + 1 >= words.length ? '🏆' : '➡️'} onClick={next}>
            {settings.showZh ? (index + 1 >= words.length ? '完成挑战' : '下一个') : (index + 1 >= words.length ? 'Finish' : 'Next')}
          </BigButton>
        )}
      </div>
    </GameScreen>
  )
}
