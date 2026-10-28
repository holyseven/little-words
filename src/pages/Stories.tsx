import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { animatedStories, getAnimatedStory, type AnimatedStory } from '../content/stories'
import { getWord } from '../content'
import { playClip, preloadClips, stopClip } from '../audio/clips'
import { characterClipId } from '../audio/characterVoices'
import { createStoryPlayback, type StoryPlaybackState } from '../logic/storyPlayback'
import { useApp } from '../store/AppContext'
import { useAudioUnlocked } from '../hooks/useAudioUnlocked'
import { usePageVisible } from '../hooks/useGameLoop'
import { navigate } from '../router'
import { BackButton } from '../components/BackButton'
import { BigButton } from '../components/BigButton'
import { StoryStage } from '../components/StoryStage'
import { NotFound } from './NotFound'
import './Stories.css'

const storySpeeds = [
  { rate: 0.7, zh: '慢速', en: 'Slow' },
  { rate: 0.85, zh: '慢一点', en: 'Gentle' },
  { rate: 1, zh: '原速', en: 'Normal' },
]

export function Stories() {
  const { settings } = useApp()
  const text = (zh: string, en: string) => settings.showZh ? zh : en
  return <main className="page page-enter stories">
    <header className="page-header"><BackButton to="/" /><h1>{text('动画小剧场', 'Little Theater')}</h1></header>
    <div className="page__body stories__body">
      <section className="stories__welcome">
        <span className="stories__eyebrow" lang="en">MOMO’S LITTLE THEATER</span>
        <h2>{text('小故事，大声说。', 'Little stories. Little conversations.')}</h2>
        <p>{text('跟着 Momo 看一看、听一听，喜欢的那一句，再听一次。', 'Watch with Momo, listen, and hear your favorite line again.')}</p>
        <span className="stories__badge">{text(`${animatedStories.length} 段原创故事 · 角色配音`, `${animatedStories.length} original stories · Character voices`)}</span>
      </section>
      <div className="stories__grid">{animatedStories.map((story) => <button className={`story-card story-card--${story.id}`} key={story.id} onClick={() => navigate(`/stories/${story.id}`)}>
        <div className="story-card__picture"><StoryStage storyId={story.id} lineIndex={0} speaking={false} running={false} label={settings.showZh ? story.zh : story.title} /><span className="story-card__play" aria-hidden="true">▶</span></div>
        <div className="story-card__text"><small lang="en">UNIT {story.unitId.slice(-1)} / {story.themeId.replace('-', ' ').toUpperCase()}</small><h2>{settings.showZh ? story.zh : story.title}</h2>{settings.showZh && <span lang="en">{story.title}</span>}<p>{settings.showZh ? story.summary : story.summaryEn}</p><div className="story-card__words" lang="en">{story.learning.wordIds.map((id) => <span key={id}>{getWord(story.themeId, id)?.text}</span>)}</div><b>{text('看小故事', 'Watch story')} <span aria-hidden="true">→</span></b></div>
      </button>)}</div>
      <p className="stories__note">{text('围绕课本主题创作的小故事，和学校的原版动画分开收好。', 'Original little stories inspired by your textbook themes.')}</p>
    </div>
  </main>
}

export function StoryPlayer({ storyId, from }: { storyId: string; from?: 'course' | 'theme' }) {
  const story = getAnimatedStory(storyId)
  return story ? <Player story={story} from={from} /> : <NotFound />
}

function Player({ story, from }: { story: AnimatedStory; from?: 'course' | 'theme' }) {
  const { settings, updateSettings, reward } = useApp()
  const visible = usePageVisible()
  const { unlock } = useAudioUnlocked()
  const [state, setState] = useState<StoryPlaybackState>({ index: 0, status: 'idle', speaking: false })
  const [take, setTake] = useState(0)
  const rateRef = useRef(settings.storyRate)
  rateRef.current = settings.storyRate
  const playback = useRef<ReturnType<typeof createStoryPlayback> | null>(null)
  const pausedByPage = !visible || !!reward
  const line = story.lines[state.index]
  const practiceLine = story.lines.find((item) => item.id === story.learning.practiceLineId)!
  const ended = state.status === 'ended'
  const running = state.status === 'playing' && !pausedByPage
  const text = (zh: string, en: string) => settings.showZh ? zh : en
  const back = from === 'course' ? `/course/unit/${story.unitId}` : from === 'theme' ? `/theme/${story.themeId}` : '/stories'

  useEffect(() => {
    let active = true
    const controller: ReturnType<typeof createStoryPlayback> = createStoryPlayback({
      lineCount: story.lines.length,
      playLine: (index, onEnd) => {
        const phrase = story.lines[index]
        if (document.hidden) return Promise.reject(new Error('Page hidden'))
        return playClip(characterClipId(phrase.speaker, phrase.en), { playbackRate: rateRef.current, fallbackText: phrase.en, onEnd, onCancel: () => controller.pause() })
      },
      stop: stopClip,
      onChange: (next) => { if (active) setState(next) },
    })
    playback.current = controller
    // Safari can freeze before React effects run, including between lines.
    const pause = () => controller.pause()
    const visibility = () => { if (document.hidden) pause() }
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('pagehide', pause)
    return () => {
      active = false
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('pagehide', pause)
      controller.dispose()
      if (playback.current === controller) playback.current = null
    }
  }, [story])

  useEffect(() => { if (pausedByPage) playback.current?.pause() }, [pausedByPage])

  const prepare = () => {
    unlock()
    preloadClips(story.lines.map((item) => characterClipId(item.speaker, item.en)))
  }
  const play = () => {
    if (pausedByPage) return
    if (running) { playback.current?.pause(); return }
    prepare()
    setTake((value) => value + 1)
    playback.current?.play()
  }
  const seek = (index: number) => {
    if (pausedByPage) return
    prepare()
    setTake((value) => value + 1)
    playback.current?.seek(index, true)
  }
  const replay = () => {
    if (pausedByPage) return
    prepare()
    setTake((value) => value + 1)
    playback.current?.replay()
  }
  const changeSpeed = (rate: number) => {
    if (pausedByPage || rate === rateRef.current) return
    // Set the current request's rate before restarting; updating context is batched by React.
    rateRef.current = rate
    updateSettings({ storyRate: rate })
    if (running) {
      prepare()
      setTake((value) => value + 1)
      playback.current?.replay()
    }
  }
  const playLabel = running ? text('暂停', 'Pause') : ended ? text('再看一遍', 'Watch again') : state.status === 'paused' ? text('继续播放', 'Continue') : text('播放故事', 'Play story')

  return <main className="page page-enter story-player" style={{ '--story-tick': `${1 / settings.storyRate}s` } as CSSProperties}>
    <header className="page-header"><BackButton to={back} /><h1>{settings.showZh ? story.zh : story.title}</h1><div className="page-header__spacer" /><span className="story-player__unit">Unit {story.unitId.slice(-1)}</span></header>
    <div className="page__body story-player__body">
      <div className="story-player__heading"><span className="stories__eyebrow" lang="en">{story.title}</span><span>{text('原创小剧场', 'An original little story')}</span></div>
      <div className="story-speed" role="group" aria-label={text('动画播放速度', 'Story playback speed')}>
        <span>{text('播放速度', 'Speed')}</span>
        <div>{storySpeeds.map((speed) => <button key={speed.rate} type="button" aria-pressed={settings.storyRate === speed.rate} disabled={pausedByPage} onClick={() => changeSpeed(speed.rate)}><b>{text(speed.zh, speed.en)}</b><span>{speed.rate}×</span></button>)}</div>
      </div>
      <section className="story-screen" aria-label={text('动画与字幕', 'Story and subtitles')}>
        <StoryStage key={take} storyId={story.id} lineIndex={state.index} speaking={state.speaking && running} running={running} complete={ended} rate={settings.storyRate} label={settings.showZh ? story.zh : story.title} />
        <div className={`story-subtitles${line.speaker === 'child' ? ' story-subtitles--child' : ''}`} aria-live="polite" aria-atomic="true">
          <span className="story-subtitles__speaker">{ended ? text('故事看完啦', 'The End') : line.speaker === 'momo' ? 'Momo' : text('小朋友', 'Little friend')}<i className={state.speaking && running ? 'is-speaking' : ''} aria-hidden="true"><b /><b /><b /></i></span>
          <p lang="en">{line.en}</p>{settings.showZh && <span className="story-subtitles__zh">{line.zh}</span>}
        </div>
      </section>
      <div className="story-player__progress" aria-label={text(`第 ${state.index + 1} 句，共 ${story.lines.length} 句`, `Line ${state.index + 1} of ${story.lines.length}`)}><div aria-hidden="true">{story.lines.map((item, index) => <span key={item.id} className={index === state.index ? 'is-current' : index < state.index ? 'is-past' : ''} />)}</div><span>{ended ? '✓' : `${state.index + 1} / ${story.lines.length}`}</span></div>
      <div className="story-player__controls">
        <BigButton icon="←" disabled={pausedByPage || state.index === 0} onClick={() => seek(state.index - 1)}>{text('上一句', 'Previous')}</BigButton>
        <BigButton variant="primary" icon={running ? '❚❚' : '▶'} disabled={pausedByPage} onClick={play}>{playLabel}</BigButton>
        <BigButton icon="→" disabled={pausedByPage || state.index === story.lines.length - 1} onClick={() => seek(state.index + 1)}>{text('下一句', 'Next')}</BigButton>
      </div>
      <div className="story-player__secondary"><button onClick={replay} disabled={pausedByPage}>{text('↻ 重听这句', '↻ Hear this line again')}</button><span>{text(state.status === 'paused' ? '继续时，会从这一句开头再听。' : '看一看，也可以跟着说一说。', state.status === 'paused' ? 'Continue replays this line from the beginning.' : 'Watch, listen, and say it with Momo.')}</span></div>
      <nav className="story-chapters" aria-label={text('选择故事片段', 'Choose a chapter')}>{story.chapters.map((chapter, index) => <button key={chapter.en} aria-current={line.chapter === index ? 'step' : undefined} onClick={() => seek(index * 3)} disabled={pausedByPage}><span aria-hidden="true">0{index + 1}</span><b>{settings.showZh ? chapter.zh : chapter.en}</b></button>)}</nav>
      <section className="story-learning" aria-labelledby="story-learning-title">
        <h2 id="story-learning-title">{text('在故事里学会说', 'Words to use from this story')}</h2>
        <div className="story-learning__words">{story.learning.wordIds.map((id) => {
          const word = getWord(story.themeId, id)!
          return <span key={id}><b lang="en">{word.text}</b>{settings.showZh && <small>{word.zh}</small>}</span>
        })}</div>
        <p className="story-learning__pattern"><strong lang="en">{story.learning.pattern.en}</strong>{settings.showZh && <span>{story.learning.pattern.zh}</span>}</p>
        <p className="story-learning__try"><span>{text('看完试着说一句', 'After watching, try saying')}</span><b lang="en">{practiceLine.en}</b>{settings.showZh && <small>{practiceLine.zh}</small>}</p>
      </section>
      {ended && <section className="story-player__end"><h2>{text('现在，轮到你和 Momo 聊啦！', 'Now you can chat with Momo!')}</h2><BigButton icon="💬" onClick={() => navigate(`/dialogues/${story.id}${from ? `?from=${from}` : ''}`)}>{text('开口练一练', 'Try the conversation')}</BigButton><BigButton onClick={() => navigate('/stories')}>{text('选另一个故事', 'Choose another story')}</BigButton></section>}
      <details className="story-transcript"><summary>{text('看看故事里说了什么', 'Read and replay the lines')}</summary><div>{story.lines.map((item, index) => <button key={item.id} aria-current={state.index === index ? 'true' : undefined} disabled={pausedByPage} onClick={() => seek(index)}><small>{item.speaker === 'momo' ? 'Momo' : text('小朋友', 'Little friend')} <span aria-hidden="true">🔊</span></small><b lang="en">{item.en}</b>{settings.showZh && <span>{item.zh}</span>}</button>)}</div></details>
    </div>
  </main>
}
