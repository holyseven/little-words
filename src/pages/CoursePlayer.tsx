import { useCallback, useEffect, useRef, useState } from 'react'
import { courseAssets, courseURL, formatDuration, getCourseAsset, getCourseUnit, unitAssets, type CourseAsset } from '../content/curriculum'
import { useApp } from '../store/AppContext'
import { flushProgress, todayKey, type PlayedRange } from '../store/progress'
import { continuousRange, recordCoursePlayback } from '../logic/courseProgress'
import { stopClip } from '../audio/clips'
import { navigate } from '../router'
import { BackButton } from '../components/BackButton'
import { BigButton } from '../components/BigButton'
import { StarCounter } from '../components/StarCounter'
import { NotFound } from './NotFound'
import './Course.css'

export function CoursePlayer({ assetId }: { assetId: string }) {
  const asset = getCourseAsset(assetId)
  return asset ? <Player key={asset.id} asset={asset} /> : <NotFound />
}

function Player({ asset }: { asset: CourseAsset }) {
  const { settings, progress, updateProgress, reward } = useApp()
  const element = useRef<HTMLMediaElement | null>(null)
  const initialPosition = useRef(progress.curriculum?.media[asset.id]?.position ?? 0)
  const last = useRef<{ time: number; wall: number; date: string } | null>(null)
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(initialPosition.current)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const loaded = useRef(false)
  const label = (zh: string, en: string) => settings.showZh ? zh : en
  const unit = getCourseUnit(asset.unitId ?? undefined)
  const back = unit ? `/course/unit/${unit.id}` : '/course/extras'
  const playlist = (unit ? unitAssets(unit.id) : courseAssets.filter((a) => !a.unitId)).filter((a) => a.kind === asset.kind)
  const index = playlist.findIndex((a) => a.id === asset.id)
  const isVideo = asset.kind === 'animation'
  const mediaProgress = progress.curriculum?.media[asset.id]
  const save = useCallback((range: PlayedRange | null, time: number, ended = false) => {
    if (!loaded.current) return
    updateProgress((p) => recordCoursePlayback(p, asset.id, time, range, Date.now(), ended))
  }, [asset.id, updateProgress])
  const tick = useCallback((force = false) => {
    const el = element.current
    if (!el) return
    setPosition(el.currentTime)
    const now = Date.now(), previous = last.current
    if (previous && !el.seeking && !document.hidden && (force || !el.paused)) {
      if (!force && now - previous.wall < 750) return
      const range = previous.date === todayKey() ? continuousRange(previous.time, el.currentTime, (now - previous.wall) / 1000, el.playbackRate) : null
      if (loaded.current) save(range, el.currentTime, el.ended)
    } else if (force) save(null, el.currentTime, el.ended)
    last.current = el.paused || el.seeking || document.hidden ? null : { time: el.currentTime, wall: now, date: todayKey() }
  }, [save])
  useEffect(() => {
    const el = element.current!
    if (!el.getAttribute('src')) el.src = courseURL(asset.file)
    const pause = () => {
      const previous = last.current
      const range = previous && !el.seeking && !document.hidden && previous.date === todayKey()
        ? continuousRange(previous.time, el.currentTime, (Date.now() - previous.wall) / 1000, el.playbackRate) : null
      save(range, el.currentTime, el.ended)
      el.pause(); last.current = null; void flushProgress()
    }
    const visibility = () => { if (document.hidden) pause() }
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('pagehide', pause)
    // 浏览器 history 返回时先停音，再由 React 完成页面替换。
    window.addEventListener('hashchange', pause)
    const fullscreen = () => { if (el instanceof HTMLVideoElement) el.controls = !!document.fullscreenElement }
    document.addEventListener('fullscreenchange', fullscreen)
    el.addEventListener('webkitendfullscreen', fullscreen)
    return () => {
      pause()
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('pagehide', pause)
      window.removeEventListener('hashchange', pause)
      document.removeEventListener('fullscreenchange', fullscreen)
      el.removeEventListener('webkitendfullscreen', fullscreen)
      loaded.current = false
      el.removeAttribute('src'); el.load()
    }
  }, [save, asset.file])
  useEffect(() => { if (reward) { tick(true); element.current?.pause() } }, [reward, tick])
  useEffect(() => { if (element.current) element.current.playbackRate = settings.courseRate }, [settings.courseRate])
  const play = () => {
    const el = element.current
    if (!el || reward) return
    if (!el.paused) { tick(true); el.pause(); return }
    stopClip(); setError('')
    if (el.ended) { last.current = null; el.currentTime = 0 }
    void el.play().catch(() => setError(settings.showZh ? '暂时无法播放，请联网后再试一次。离线使用前，请家长下载本单元。' : 'Unable to play. Ask a parent to download this lesson.'))
  }
  const seek = (time: number) => {
    const el = element.current
    if (!el || !ready) return
    tick(true); last.current = null
    el.currentTime = Math.max(0, Math.min(asset.duration, time)); setPosition(el.currentTime)
    save(null, el.currentTime)
  }
  const events = {
    onLoadedMetadata: () => {
      const el = element.current!
      loaded.current = true
      setReady(true); setError(''); el.playbackRate = settings.courseRate
      if (initialPosition.current > 0 && initialPosition.current < asset.duration - 0.5) el.currentTime = initialPosition.current
      setPosition(el.currentTime)
    },
    onPlay: () => {
      const el = element.current!
      if (document.hidden || reward) { el.pause(); return }
      stopClip(); setPlaying(true)
      last.current = { time: el.currentTime, wall: Date.now(), date: todayKey() }
      save(null, el.currentTime)
    },
    onPause: () => { tick(true); setPlaying(false); last.current = null; void flushProgress() },
    onTimeUpdate: () => tick(),
    onSeeking: () => { last.current = null },
    onSeeked: () => { const el = element.current!; last.current = el.paused ? null : { time: el.currentTime, wall: Date.now(), date: todayKey() }; setPosition(el.currentTime) },
    onEnded: () => { tick(true); setPlaying(false); last.current = null; void flushProgress() },
    onError: () => { setPlaying(false); last.current = null; setError(label('这份材料暂时打不开。请联网重试，或请家长下载本单元。', 'Unable to open this lesson. Try online or ask a parent to download this unit.')) },
  }
  const fullscreen = () => {
    const video = element.current as HTMLVideoElement & { webkitEnterFullscreen?: () => void }
    if (!video) return
    if (video.webkitEnterFullscreen) { video.webkitEnterFullscreen(); return }
    if (video.requestFullscreen) void video.requestFullscreen().catch(() => setError(label('此浏览器暂不支持全屏，仍可在页面中播放。', 'Fullscreen is unavailable. You can still play here.')))
  }
  return <main className="page page-enter course-page course-player"><header className="page-header"><BackButton to={back} /><h1>{unit ? `Unit ${unit.number}` : label('拓展阅读', 'Extra stories')}</h1><div className="page-header__spacer" /><StarCounter stars={progress.stars} /></header>
    <div className="page__body course-content"><div className="course-player-title"><p>{unit?.title} {asset.pageLabel}</p><h2>{settings.showZh ? asset.title : asset.titleEn}</h2></div>
      {isVideo ? <video ref={(el) => { element.current = el }} className="course-video" src={courseURL(asset.file)} poster={asset.poster ? courseURL(asset.poster) : undefined} playsInline preload="metadata" {...events} /> : <><audio ref={(el) => { element.current = el }} src={courseURL(asset.file)} preload="metadata" {...events} /><button className={`course-audio-art ${playing ? 'is-playing' : ''}`} onClick={play} disabled={!!reward} aria-label={playing ? label('暂停播放', 'Pause audio') : label('播放音频', 'Play audio')}><span className="emoji" aria-hidden="true">{unit?.emoji ?? '📚'}</span><span>{playing ? '❚❚' : '▶'}</span></button></>}
      <div className="course-player-controls"><BigButton variant="primary" disabled={!!reward} onClick={play}>{playing ? label('❚❚ 暂停', '❚❚ Pause') : label('▶ 播放', '▶ Play')}</BigButton><BigButton disabled={!ready || !!reward} onClick={() => { seek(0); if (element.current?.paused) play() }}>{label(isVideo ? '↺ 再看一次' : '↺ 再听一次', '↺ Replay')}</BigButton>{isVideo && <button className="icon-btn" aria-label={label('全屏播放', 'Fullscreen')} onClick={fullscreen} disabled={!ready}>⛶</button>}</div>
      <label className="course-seek"><span>{formatDuration(position)} / {formatDuration(asset.duration)}</span><input aria-label={label('播放位置', 'Playback position')} type="range" min="0" max={asset.duration} step="0.1" value={Math.min(position, asset.duration)} disabled={!ready} onChange={(e) => seek(Number(e.target.value))} /></label>
      <p className="course-status" aria-live="polite">{mediaProgress?.completed ? (settings.showZh ? '🌟 这一段已完成，首次完成的星星已收好。' : '🌟 Completed!') : (settings.showZh ? '听一听，再跟着说。完整学习这一段可以获得一颗星。' : 'Listen, then say it yourself.')}</p>
      {asset.kind !== 'vocabulary-audio' && <BigButton icon="🎙️" onClick={() => navigate(`/course/repeat/${asset.id}`)}>{settings.showZh ? '跟读这一段' : 'Repeat this line'}</BigButton>}
      {error && <div role="alert" className="course-error"><p>{error}</p><BigButton onClick={() => { setError(''); setReady(false); element.current?.load() }}>{label('重试', 'Retry')}</BigButton></div>}
      <div className="course-player-controls"><BigButton disabled={index <= 0} onClick={() => navigate(`/course/play/${playlist[index - 1]!.id}`)}>{label('← 上一段', '← Previous')}</BigButton><BigButton disabled={index >= playlist.length - 1} onClick={() => navigate(`/course/play/${playlist[index + 1]!.id}`)}>{label('下一段 →', 'Next →')}</BigButton></div>
      <BigButton icon="📖" onClick={() => navigate(back)}>{settings.showZh ? '回到课程' : 'Back to lessons'}</BigButton>
    </div>
  </main>
}
