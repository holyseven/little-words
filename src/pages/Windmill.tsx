import { useEffect, useRef, useState } from 'react'
import { windmillChapters, windmillQuestions, windmillSources } from '../content/windmill'
import { createMediaPlayback } from '../audio/mediaPlayback'
import { stopClip } from '../audio/clips'
import { applyMediaRate } from '../audio/mediaRate'
import { useAudioUnlocked } from '../hooks/useAudioUnlocked'
import { useGameLoop, usePageVisible } from '../hooks/useGameLoop'
import { useApp } from '../store/AppContext'
import { BackButton } from '../components/BackButton'
import { BigButton } from '../components/BigButton'
import { WindmillStage } from '../components/WindmillStage'
import './Windmill.css'

type Voice = 'zh' | 'en' | 'off'
type VoiceStatus = 'idle' | 'loading' | 'playing' | 'done' | 'unavailable'
type Wind = 0 | 1 | 2

const voices: { id: Voice; zh: string; en: string }[] = [
  { id: 'zh', zh: '中文旁白', en: 'Chinese' },
  { id: 'en', zh: '英文旁白', en: 'English' },
  { id: 'off', zh: '只看字幕', en: 'No voice' },
]
const winds: { id: Wind; zh: string; en: string }[] = [
  { id: 0, zh: '无风', en: 'No wind' },
  { id: 1, zh: '微风', en: 'Gentle' },
  { id: 2, zh: '大一点风', en: 'Stronger' },
]

/** A paced, bilingual lesson. The clock waits for both the reading time and voice. */
export function Windmill() {
  const { reward } = useApp()
  const visible = usePageVisible()
  const { unlock } = useAudioUnlocked()
  const screen = useRef<HTMLElement | null>(null)
  const transport = useRef<HTMLDivElement | null>(null)
  const audio = useRef<HTMLAudioElement | null>(null)
  const playback = useRef(createMediaPlayback())
  const narrationRequest = useRef(0)
  const narrationWanted = useRef(false)
  const narrationTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const voiceRef = useRef<Voice>('zh')
  const voiceDone = useRef(false)
  const elapsedRef = useRef(0)
  const stepping = useRef(false)
  const [chapterIndex, setChapterIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [experiment, setExperiment] = useState(false)
  const [experimentWind, setExperimentWind] = useState<Wind>(1)
  const [voice, setVoice] = useState<Voice>('zh')
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [revision, setRevision] = useState(0)
  const [ended, setEnded] = useState(false)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const blocked = !visible || !!reward
  const blockedRef = useRef(blocked)
  blockedRef.current = blocked
  const running = playing && !blocked
  const chapter = windmillChapters[chapterIndex]
  const defaultWind: Wind = chapterIndex === 3 || (chapterIndex === 0 && elapsed < 1800) ? 0 : 1
  const wind = experiment ? experimentWind : defaultWind

  const clearNarrationTimer = () => {
    if (narrationTimer.current !== null) clearTimeout(narrationTimer.current)
    narrationTimer.current = null
  }
  const pauseNarration = () => {
    narrationRequest.current++
    narrationWanted.current = false
    clearNarrationTimer()
    playback.current.cancel()
    audio.current?.pause()
  }
  const loadNarration = (index: number, mode: Voice) => {
    pauseNarration()
    const el = audio.current!
    voiceDone.current = mode === 'off'
    setVoiceStatus(mode === 'off' ? 'done' : 'idle')
    if (mode === 'off') el.removeAttribute('src')
    else el.src = `${import.meta.env.BASE_URL}audio/windmill-${windmillChapters[index].id}-${mode}.m4a`
    el.load()
    // The offline recordings already have a pace suited to young listeners.
    applyMediaRate(el, 1)
  }
  const startNarration = () => {
    const el = audio.current!
    if (voiceRef.current === 'off' || voiceDone.current) return
    const request = ++narrationRequest.current
    narrationWanted.current = true
    setVoiceStatus('loading')
    const unavailable = () => {
      if (request !== narrationRequest.current || !narrationWanted.current) return
      pauseNarration()
      voiceDone.current = true
      setVoiceStatus('unavailable')
    }
    // Start from the click handler, preserving Safari's media user activation.
    // The same element remains unlocked for automatic chapter transitions.
    clearNarrationTimer()
    narrationTimer.current = setTimeout(unavailable, 8000)
    stopClip()
    void playback.current.play(el, () => request === narrationRequest.current && narrationWanted.current && !document.hidden && !blockedRef.current).then(() => {
      if (request !== narrationRequest.current || !narrationWanted.current) return
      clearNarrationTimer()
      if (!el.paused && !voiceDone.current) setVoiceStatus('playing')
    }).catch(unavailable)
  }
  const stop = () => {
    pauseNarration()
    setPlaying(false)
    setExperiment(false)
  }

  const resetChapter = (index: number, autoplay: boolean) => {
    const next = Math.max(0, Math.min(windmillChapters.length - 1, index))
    loadNarration(next, voiceRef.current)
    elapsedRef.current = 0
    stepping.current = true
    setElapsed(0)
    setChapterIndex(next)
    setRevision((value) => value + 1)
    setExperiment(false)
    setEnded(false)
    setPlaying(autoplay)
    if (autoplay) startNarration()
  }

  useEffect(() => { stepping.current = false }, [chapterIndex, revision])

  useEffect(() => {
    loadNarration(0, voiceRef.current)
    const pause = () => stop()
    const visibility = () => { if (document.hidden) pause() }
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('pagehide', pause)
    window.addEventListener('hashchange', pause)
    return () => {
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('pagehide', pause)
      window.removeEventListener('hashchange', pause)
      pauseNarration()
    }
  }, [])

  useEffect(() => { if (blocked) stop() }, [blocked])

  useGameLoop(running, (deltaMs) => {
    if (stepping.current) return
    elapsedRef.current += deltaMs
    const currentTime = elapsedRef.current
    if (currentTime - elapsed >= 80) setElapsed(currentTime)
    // A playback stall after the first sound is also allowed to fall back.
    if (!voiceDone.current && currentTime > Math.max(chapter.durationMs * 2.5, 35000)) {
      pauseNarration()
      voiceDone.current = true
      setVoiceStatus('unavailable')
    }
    if (currentTime < chapter.durationMs || !voiceDone.current) return
    stepping.current = true
    if (chapterIndex < windmillChapters.length - 1) resetChapter(chapterIndex + 1, true)
    else {
      setElapsed(chapter.durationMs)
      setPlaying(false)
      setEnded(true)
    }
  })

  const play = () => {
    if (blocked) return
    unlock()
    if (running) { stop(); return }
    if (ended) { resetChapter(0, true); return }
    setExperiment(false)
    setPlaying(true)
    startNarration()
  }
  const seek = (index: number) => {
    if (blocked) return
    unlock()
    resetChapter(index, true)
    requestAnimationFrame(() => transport.current?.scrollIntoView({
      block: 'start',
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    }))
  }
  const changeVoice = (next: Voice) => {
    if (blocked || next === voice) return
    unlock()
    voiceRef.current = next
    resetChapter(chapterIndex, playing)
    setVoice(next)
  }
  const tryWind = (next: Wind) => {
    if (blocked) return
    pauseNarration()
    setPlaying(false)
    setExperimentWind(next)
    setExperiment(true)
    if (!experiment) requestAnimationFrame(() => {
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
      screen.current?.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' })
    })
  }
  const playZh = running ? '暂停' : ended ? '再看一次' : elapsed > 0 || experiment ? '继续讲解' : '播放动画'
  const playEn = running ? 'Pause' : ended ? 'Watch again' : elapsed > 0 || experiment ? 'Continue' : 'Play'
  const status = experiment
    ? ['你来当风！点不同风力，观察它怎么转。', 'Be the wind! Try each setting and watch the wheel.']
    : ended
      ? ['你发现了：风把运动的能量传给风车！', 'You found it: wind passes movement energy to the wheel!']
      : voiceStatus === 'unavailable'
        ? ['声音暂未就绪，仍可观看双语字幕和动画。', 'Voice is unavailable. You can still watch the bilingual animation.']
        : !playing
          ? ['点播放，一起找出风车转动的秘密。', 'Press play and discover what makes a pinwheel spin.']
          : ['边看边听，也可以随时暂停想一想。', 'Watch and listen. Pause whenever you want to think.']

  return <main className="page page-enter windmill-page">
    <header className="page-header"><BackButton to="/stories" /><h1>风车为什么会转？<small lang="en">Why does a pinwheel spin?</small></h1><span className="windmill-age">8 岁 +<small lang="en">SCIENCE</small></span></header>
    <div className="page__body windmill-body">
      <div className="windmill-intro"><span>小小科学家 <span aria-hidden="true">/</span> <span lang="en">LITTLE SCIENTIST</span></span><span>5 个发现 · 约 1 分钟 <span lang="en">5 discoveries · about 1 min</span></span></div>
      <div ref={transport} className="windmill-transport">
        <BigButton disabled={blocked || chapterIndex === 0} onClick={() => seek(chapterIndex - 1)}><b>← 上一章</b><small lang="en">Previous</small></BigButton>
        <BigButton variant="primary" disabled={blocked} onClick={play}><b>{running ? 'Ⅱ' : '▶'} {playZh}</b><small lang="en">{playEn}</small></BigButton>
        <BigButton disabled={blocked || chapterIndex === windmillChapters.length - 1} onClick={() => seek(chapterIndex + 1)}><b>下一章 →</b><small lang="en">Next</small></BigButton>
      </div>
      <section ref={screen} className={`windmill-screen${experiment ? ' is-experimenting' : ''}`} aria-label="风车科普动画 / Pinwheel science animation">
        <WindmillStage chapter={chapterIndex} running={(running || experiment) && !blocked} wind={wind} experiment={experiment} elapsedMs={elapsed} clockRef={elapsedRef} revision={revision} />
        {experiment ? <div className="windmill-observe">
          <div className="windmill-observe__heading"><h2>观察小实验 <small lang="en">Watch & try</small></h2><button type="button" disabled={blocked} onClick={play}>{ended ? '重看讲解' : '继续讲解'}<small lang="en">{ended ? 'Watch lesson' : 'Continue'}</small><span aria-hidden="true">▶</span></button></div>
          <div className="windmill-winds" role="group" aria-label="观察实验风力 / Observation wind strength">{winds.map((item) => <button type="button" key={item.id} disabled={blocked} aria-pressed={experimentWind === item.id} onClick={() => tryWind(item.id)}><span aria-hidden="true">{item.id === 0 ? '·' : item.id === 1 ? '→' : '⇉'}</span><b>{item.zh}</b><small lang="en">{item.en}</small></button>)}</div>
          <p>风停后，会立刻停住吗？<span lang="en">Does the wheel stop as soon as the wind stops?</span></p>
        </div> : <div className="windmill-subtitles" aria-live="polite" aria-atomic="true">
          <span className="windmill-subtitles__chapter">{String(chapterIndex + 1).padStart(2, '0')} / 05 <b>{chapter.titleZh}</b><span lang="en">{chapter.titleEn}</span></span>
          <p lang="zh-CN">{chapter.zh}</p><p lang="en">{chapter.en}</p>
        </div>}
      </section>
      <div className="windmill-status"><p aria-live="polite"><span>{status[0]}</span><small lang="en">{status[1]}</small></p><button type="button" disabled={blocked} onClick={() => seek(0)}>↻ 从头看<small lang="en">Start over</small></button></div>
      <nav className="windmill-chapters" aria-label="选择章节 / Choose a chapter">{windmillChapters.map((item, index) => <button type="button" key={item.id} disabled={blocked} aria-current={index === chapterIndex ? 'step' : undefined} onClick={() => seek(index)}><span>{String(index + 1).padStart(2, '0')}</span><b>{item.titleZh}</b><small lang="en">{item.titleEn}</small><i style={{ width: `${index < chapterIndex || ended ? 100 : index === chapterIndex ? Math.min(100, elapsed / chapter.durationMs * 100) : 0}%` }} /></button>)}</nav>
      <section className={`windmill-lab ${experiment ? 'is-experimenting' : ''}`} aria-labelledby="windmill-lab-title">
        <div><span className="windmill-kicker" lang="en">YOUR TURN</span><h2 id="windmill-lab-title">你来当风 <small lang="en">Be the wind</small></h2><p>换一换风力，看看转动会怎样。<span lang="en">Change the wind. What happens?</span></p></div>
        <div className="windmill-winds" role="group" aria-label="实验风力 / Experiment wind strength">{winds.map((item) => <button type="button" key={item.id} disabled={blocked} aria-pressed={experiment && experimentWind === item.id} onClick={() => tryWind(item.id)}><span aria-hidden="true">{item.id === 0 ? '·' : item.id === 1 ? '→' : '⇉'}</span><b>{item.zh}</b><small lang="en">{item.en}</small></button>)}</div>
        <p className="windmill-lab__note">{experiment ? '讲解已暂停。点「继续讲解」回到动画。' : '点风力按钮，会先暂停讲解。'}<span lang="en">{experiment ? 'Lesson paused. Press Continue to return.' : 'Trying a wind setting pauses the lesson.'}</span></p>
      </section>
      <section className="windmill-voice" aria-labelledby="windmill-voice-title"><div><h2 id="windmill-voice-title">选择旁白 <small lang="en">Narration</small></h2><p>字幕始终中英同屏<span lang="en">Both languages stay on screen.</span></p></div><div role="group" aria-label="旁白语言 / Narration language">{voices.map((item) => <button type="button" key={item.id} disabled={blocked} aria-pressed={voice === item.id} onClick={() => changeVoice(item.id)}><b>{item.zh}</b><small lang="en">{item.en}</small></button>)}</div><p className="windmill-voice__note">切换旁白，会从本章开头重新讲。 <span lang="en">Changing voice replays this chapter.</span></p></section>
      <details className="windmill-learn windmill-quiz"><summary>来挑战 3 个小问题 <small lang="en">Try 3 little questions</small><span aria-hidden="true">＋</span></summary><div className="windmill-quiz__questions">{windmillQuestions.map((question, index) => {
        const answer = answers[question.id]
        const correct = answer === question.correctId
        return <fieldset key={question.id}><legend><span>{index + 1}.</span> {question.zh}<small lang="en">{question.en}</small></legend><div>{question.options.map((option) => <button type="button" key={option.id} aria-pressed={answer === option.id} className={answer === option.id ? correct ? 'is-correct' : 'is-try-again' : ''} onClick={() => setAnswers((previous) => ({ ...previous, [question.id]: option.id }))}><b>{option.zh}</b><small lang="en">{option.en}</small></button>)}</div>{answer && <p aria-live="polite" className={correct ? 'is-correct' : 'is-try-again'}><b>{correct ? '✓ ' : '再想一想。'}{correct ? question.explanationZh : '可以再选一次：想想空气和叶片之间发生了什么。'}</b><span lang="en">{correct ? question.explanationEn : 'Try again. Think about what happens between the air and blades.'}</span></p>}</fieldset>
      })}</div></details>
      <section className="windmill-learn windmill-words"><h2>今天发现的词 <small lang="en">Words we discovered</small></h2><div>{[['wind', '风'], ['air', '空气'], ['blade', '叶片'], ['push', '推力'], ['spin', '旋转'], ['energy', '能量']].map(([en, zh]) => <span key={en}><b lang="en">{en}</b><small>{zh}</small></span>)}</div></section>
      <details className="windmill-learn windmill-home"><summary>家里的小实验 <small lang="en">Try it at home</small><span aria-hidden="true">＋</span></summary><div><h3>用一把纸扇，当一阵小风。<small lang="en">Make a little wind with a paper fan.</small></h3><p>请大人准备一只纸风车。把它放在同一个位置，先慢慢扇，再快一点扇，最后停下来。你看到了什么？<span lang="en">Ask a grown-up for a paper pinwheel. Keep it in one place. Fan slowly, then a little faster, then stop. What do you notice?</span></p><p className="windmill-home__question">猜一猜 → 试一试 → 说发现<small lang="en">Predict → Try → Tell what you found</small></p><p>制作时的尖针和剪刀，交给大人来用。<span lang="en">Let a grown-up handle sharp pins and scissors.</span></p></div></details>
      <details className="windmill-sources"><summary>给大人的科学资料 <small lang="en">Science sources for grown-ups</small></summary><p>这里演示的是纸风车。叶片形状不同，受力方式也会不同。<span lang="en">This lesson shows a paper pinwheel. Different blade shapes interact with air in different ways.</span></p>{windmillSources.map((source) => <a href={source.url} key={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a>)}</details>
      <audio ref={audio} preload="metadata" onEnded={() => { clearNarrationTimer(); voiceDone.current = true; setVoiceStatus('done') }} onError={() => { if (voiceRef.current !== 'off') { pauseNarration(); voiceDone.current = true; setVoiceStatus('unavailable') } }} />
    </div>
  </main>
}
