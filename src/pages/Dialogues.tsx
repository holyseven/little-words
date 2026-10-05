import { useEffect, useRef, useState } from 'react'
import { BackButton } from '../components/BackButton'
import { BigButton } from '../components/BigButton'
import { StarCounter } from '../components/StarCounter'
import { Momo } from '../components/Mascot/Momo'
import { InlineWordRepeat, type InlineWordRepeatHandle } from '../components/InlineWordRepeat'
import { burstSmall, clearConfetti } from '../components/Confetti'
import { themes } from '../content'
import { dialogueScenes, getDialogueScene } from '../content/dialogues'
import { getCourseUnit } from '../content/curriculum'
import { phraseId } from '../audio/clips'
import { WordArt } from '../content/svg/WordArt'
import { advanceDialogue, initialDialogueState, type DialogueAction, type DialogueResponse } from '../logic/dialogue'
import { useApp } from '../store/AppContext'
import { navigate } from '../router'
import { useVoice } from '../hooks/useVoice'
import { useAudioUnlocked } from '../hooks/useAudioUnlocked'
import { usePageVisible } from '../hooks/useGameLoop'
import { useSfx } from '../hooks/useSfx'
import { NotFound } from './NotFound'
import './Dialogues.css'

export function Dialogues() {
  const { settings, progress } = useApp()
  const text = (zh: string, en: string) => settings.showZh ? zh : en
  return <main className="page page-enter dialogues">
    <header className="page-header"><BackButton to="/" /><h1>{text('开口小对话', 'Little chats')}</h1><div className="page-header__spacer" /><StarCounter stars={progress.stars} /></header>
    <div className="page__body dialogues__body">
      <section className="dialogues__welcome"><Momo /><div><p className="dialogues__eyebrow">LET’S TALK!</p><h2>{text('和 Momo 聊一聊', 'Have a chat with Momo')}</h2><p>{text('每次三轮，先听一句，再说一句。不会说时，点一下听示范。', 'Three little turns. Listen, then answer. Tap the example whenever you need it.')}</p></div></section>
      <div className="dialogues__grid" aria-label={text('选择对话场景', 'Choose a conversation')}>
        {dialogueScenes.map((scene) => <button className="dialogues__scene" key={scene.id} onClick={() => navigate(`/dialogues/${scene.id}`)}>
          <span className="emoji" aria-hidden="true">{scene.emoji}</span><span><small>Unit {getCourseUnit(scene.unitId)?.number} · {text('3 轮小对话', '3 short turns')}</small><strong>{text(scene.zh, scene.title)}</strong>{settings.showZh && <span lang="en">{scene.title}</span>}<small lang="en">{scene.turns[0].prompt.en}</small></span><span aria-hidden="true">→</span>
        </button>)}
      </div>
    </div>
  </main>
}

export function DialoguePractice({ sceneId, from }: { sceneId: string; from?: 'course' | 'theme' }) {
  const scene = getDialogueScene(sceneId)
  const { settings, reward } = useApp()
  const { sayPhrase, sayPhrases, speaking, stop, preloadClips } = useVoice()
  const { unlock } = useAudioUnlocked()
  const visible = usePageVisible()
  const paused = !visible || !!reward
  const sfx = useSfx()
  const [state, setState] = useState(initialDialogueState)
  const stateRef = useRef(state)
  const repeat = useRef<InlineWordRepeatHandle>(null)
  const announced = useRef('')
  const autoTimer = useRef<ReturnType<typeof setTimeout>>()
  const celebrated = useRef(false)
  const text = (zh: string, en: string) => settings.showZh ? zh : en
  const turn = scene?.turns[state.index]
  const spokenKey = `${state.index}:${state.phase}`
  const artWord = turn?.wordId ? themes.flatMap((theme) => theme.words).find((word) => word.id === turn.wordId) : undefined

  const transition = (action: DialogueAction) => {
    const next = advanceDialogue(stateRef.current, action, scene?.turns.length ?? 0)
    if (next === stateRef.current) return false
    stateRef.current = next
    setState(next)
    return true
  }

  // Every explicit action cancels pending prompts before starting new audio/input.
  const silence = (cancelInput = true) => {
    clearTimeout(autoTimer.current)
    announced.current = spokenKey
    if (cancelInput) repeat.current?.cancel()
    stop()
  }

  useEffect(() => {
    if (paused) {
      clearTimeout(autoTimer.current)
      announced.current = ''
      repeat.current?.cancel()
      stop()
      return
    }
    if (!turn || (state.phase !== 'answering' && state.phase !== 'replied')) return
    if (announced.current === spokenKey) return
    autoTimer.current = setTimeout(() => {
      if (announced.current === spokenKey || document.hidden) return
      announced.current = spokenKey
      sayPhrase(state.phase === 'answering' ? turn.prompt.en : turn.reply.en)
    }, 300)
    return () => clearTimeout(autoTimer.current)
  }, [paused, turn, state.phase, spokenKey, sayPhrase, stop])

  useEffect(() => () => { clearTimeout(autoTimer.current); clearConfetti() }, [])

  useEffect(() => {
    if (state.phase !== 'done') { celebrated.current = false; return }
    if (paused || celebrated.current) return
    // Wait until the microphone component has cleaned up its own effects.
    const timer = setTimeout(() => { celebrated.current = true; sfx.celebrate(); burstSmall() }, 120)
    return () => clearTimeout(timer)
  }, [state.phase, paused, sfx])

  if (!scene || !turn) return <NotFound />
  const backTo = from === 'course' ? `/course/unit/${scene.unitId}` : from === 'theme' && scene.themeId ? `/theme/${scene.themeId}` : '/dialogues'
  const replyDone = state.phase === 'replied'

  const start = (restart = false) => {
    unlock(); silence(); announced.current = ''
    transition({ type: restart ? 'restart' : 'start' })
    preloadClips(scene.turns.flatMap((item) => [item.prompt, item.answer, item.reply]).map((phrase) => `p/${phraseId(phrase.en)}`))
  }
  const completeTurn = (mode: DialogueResponse) => {
    if (paused || !transition({ type: 'answer', index: state.index, mode })) return
    if (mode === 'self') silence()
    if (mode === 'spoken') sfx.correct()
  }
  const hear = (phrase: string) => { if (!paused) { unlock(); silence(); sayPhrase(phrase) } }
  const next = () => {
    if (paused || speaking) return
    silence()
    transition({ type: 'next', index: state.index })
  }

  return <main className="page page-enter dialogue-practice">
    <header className="page-header"><BackButton to={backTo} /><h1>{text(scene.zh, scene.title)}</h1><div className="page-header__spacer" /><span className="dialogue__count">{state.phase === 'done' ? '✓' : `${state.index + 1} / ${scene.turns.length}`}</span></header>
    <div className="page__body dialogue__body">
      {state.phase === 'intro' ? <section className="dialogue__intro">
        <Momo /><span className="emoji dialogue__scene-icon" aria-hidden="true">{scene.emoji}</span>
        <h2 lang="en">{scene.title}</h2><p>{text('Momo 说一句，你来接一句。', 'Momo speaks, then it is your turn.')}</p>
        <p className="dialogue__hint">{text('点麦克风回答，或和家长说完后点「我说好了」。', 'Use the microphone, or practice with a parent and tap “I said it”.')}</p>
        <BigButton icon="▶" variant="primary" onClick={() => start()} disabled={paused}>{text('开始对话', 'Start chatting')}</BigButton>
      </section> : state.phase === 'done' ? <>
        <section className="dialogue__finish"><span className="emoji" aria-hidden="true">🎉</span><h2>{text('今天也勇敢开口啦！', 'You had a little chat!')}</h2><p>{text(`完成了 ${scene.turns.length} 轮练习，再听一遍吧。`, `${scene.turns.length} turns practiced. Listen again!`)}</p></section>
        <div className="dialogue__actions"><BigButton icon={speaking ? '■' : '🔊'} onClick={() => { unlock(); if (speaking) silence(); else sayPhrases(scene.turns.flatMap((item) => [item.prompt.en, item.answer.en, item.reply.en])) }} disabled={paused}>{text(speaking ? '停止示范' : '听完整示范', speaking ? 'Stop example' : 'Hear the whole example')}</BigButton><BigButton icon="🔁" variant="primary" onClick={() => start(true)} disabled={paused}>{text('再聊一次', 'Chat again')}</BigButton></div>
        <div className="dialogue__review" aria-label={text('对话示范', 'Conversation example')}>{scene.turns.map((item, index) => <section key={item.id}>
          <h3>{text(`第 ${index + 1} 轮`, `Turn ${index + 1}`)}</h3>
          {[{ role: 'Momo', phrase: item.prompt }, { role: text('参考回答', 'Example answer'), phrase: item.answer }, { role: 'Momo', phrase: item.reply }].map(({ role, phrase }, line) => <button key={line} onClick={() => hear(phrase.en)} disabled={paused}><small>{role} · 🔊</small><strong lang="en">{phrase.en}</strong>{settings.showZh && <span>{phrase.zh}</span>}</button>)}
        </section>)}</div>
        <BigButton icon="💬" onClick={() => navigate('/dialogues')}>{text('换个话题', 'Choose another chat')}</BigButton>
      </> : <>
        <div className="dialogue__dots" aria-label={text(`第 ${state.index + 1} 轮，共 ${scene.turns.length} 轮`, `Turn ${state.index + 1} of ${scene.turns.length}`)}>{scene.turns.map((item, index) => <span key={item.id} className={index <= state.index ? 'is-active' : ''} aria-hidden="true">{index < state.index ? '✓' : index + 1}</span>)}</div>
        <section className="dialogue__prompt"><Momo /><div className="dialogue__bubble"><small>Momo</small><h2 lang="en">{turn.prompt.en}</h2>{settings.showZh && <p>{turn.prompt.zh}</p>}<button className="dialogue__listen" onClick={() => hear(turn.prompt.en)} disabled={paused}>{text('🔊 再听问题', '🔊 Hear Momo again')}</button></div>{artWord && <WordArt word={artWord} className="dialogue__art" />}</section>
        <section className="dialogue__answer"><small>{text(replyDone ? '这一轮的参考回答' : '轮到你啦 · 可以这样说', replyDone ? 'Example answer' : 'Your turn · You can say')}</small><h2 lang="en">{turn.answer.en}</h2>{settings.showZh && <p>{turn.answer.zh}</p>}<button className="dialogue__listen" onClick={() => hear(turn.answer.en)} disabled={paused}>{text('🔊 听回答示范', '🔊 Hear the example answer')}</button></section>
        {replyDone && <section className="dialogue__reply" aria-live="polite"><small>Momo</small><h2 lang="en">{turn.reply.en}</h2>{settings.showZh && <p>{turn.reply.zh}</p>}{state.responses[state.index] === 'self' && <small>{text('已完成自主练习', 'Self practice completed')}</small>}</section>}
        <div className={`dialogue__actions${replyDone ? ' is-replied' : ''}`}>
          <InlineWordRepeat key={turn.id} ref={repeat} word={turn.answer.en} candidates={scene.turns.map((item) => item.answer.en)} engine={settings.repeatEngine} showZh={settings.showZh} practiceKind="sentence" hideIdleNotice disabled={paused || speaking || replyDone} buttonText={text('我来回答', 'My turn')} onBeforeStart={() => { unlock(); silence(false) }} onSuccess={() => completeTurn('spoken')} />
          {replyDone ? <BigButton icon={state.index + 1 === scene.turns.length ? '🏁' : '➡️'} variant="primary" disabled={paused || speaking} onClick={next}>{text(state.index + 1 === scene.turns.length ? '完成对话' : '下一轮', state.index + 1 === scene.turns.length ? 'Finish chat' : 'Next turn')}</BigButton> : <BigButton icon="✓" disabled={paused || speaking} onClick={() => completeTurn('self')}>{text('我说好了', 'I said it')}</BigButton>}
        </div>
        {!replyDone && <p className="dialogue__hint">{text('想自己练？说完点「我说好了」，不进行评分。', 'Practicing on your own? Tap “I said it” to continue without a score.')}</p>}
      </>}
    </div>
  </main>
}
