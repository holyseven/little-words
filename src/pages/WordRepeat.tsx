import { useEffect, useRef, useState } from 'react'
import { BackButton } from '../components/BackButton'
import { BigButton } from '../components/BigButton'
import { StarCounter } from '../components/StarCounter'
import { getTheme } from '../content'
import type { Word } from '../content/types'
import { clipId, playClip, stopClip } from '../audio/clips'
import { useApp } from '../store/AppContext'
import { analyzeLive, repeatFeedback, type RepeatAnalysis } from '../logic/repeat'
import { navigate } from '../router'
import { NotFound } from './NotFound'
import './Course.css'

export function WordRepeat({ themeId, wordId }: { themeId: string; wordId: string }) {
  const word = getTheme(themeId)?.words.find((item) => item.id === wordId)
  return word ? <Repeat word={word} themeId={themeId} /> : <NotFound />
}

function Repeat({ word, themeId }: { word: Word; themeId: string }) {
  const { settings, progress } = useApp()
  const input = useRef<MediaStream | null>(null)
  const context = useRef<AudioContext | null>(null)
  const analyser = useRef<AnalyserNode | null>(null)
  const frame = useRef<number | null>(null)
  const started = useRef(0)
  const totalFrames = useRef(0)
  const voicedFrames = useRef(0)
  const rmsSum = useRef(0)
  const [listening, setListening] = useState(false)
  const [analysis, setAnalysis] = useState<RepeatAnalysis | null>(null)
  const [error, setError] = useState('')
  const [referenceDuration, setReferenceDuration] = useState(1.2)
  const reference = useRef<HTMLAudioElement | null>(null)
  const audioURL = import.meta.env.BASE_URL + 'audio/w/' + word.id + '.m4a'

  useEffect(() => () => stop(), [])
  const stop = () => {
    if (!listening) return
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
    input.current?.getTracks().forEach((track) => track.stop()); input.current = null
    void context.current?.close(); context.current = null; analyser.current = null
    const duration = Math.max(0, (Date.now() - started.current) / 1000)
    const result = analyzeLive(duration, rmsSum.current / Math.max(1, totalFrames.current), voicedFrames.current / Math.max(1, totalFrames.current), referenceDuration)
    setAnalysis(result); setListening(false)
  }
  const monitor = () => {
    const node = analyser.current
    if (!node) return
    const data = new Uint8Array(node.fftSize)
    node.getByteTimeDomainData(data)
    let sum = 0
    for (const value of data) { const sample = (value - 128) / 128; sum += sample * sample }
    const rms = Math.sqrt(sum / data.length)
    totalFrames.current += 1; rmsSum.current += rms
    if (rms >= 0.035) voicedFrames.current += 1
    frame.current = requestAnimationFrame(monitor)
  }
  const start = async () => {
    setError(''); setAnalysis(null)
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { setError(settings.showZh ? '麦克风需要 HTTPS；Mac 本机请用 localhost 打开。' : 'Microphone access needs HTTPS. On Mac, use localhost.'); return }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      input.current = media
      const audio = new AudioContext(); context.current = audio
      const node = audio.createAnalyser(); node.fftSize = 1024; analyser.current = node
      audio.createMediaStreamSource(media).connect(node)
      started.current = Date.now(); totalFrames.current = 0; voicedFrames.current = 0; rmsSum.current = 0
      setListening(true); requestAnimationFrame(monitor)
    } catch (cause) {
      const denied = cause instanceof DOMException && (cause.name === 'NotAllowedError' || cause.name === 'SecurityError')
      setError(settings.showZh ? (denied ? '请在浏览器地址栏允许麦克风权限，再试一次。' : '暂时无法打开麦克风，请检查设备设置。') : 'Please allow microphone access and try again.')
    }
  }
  const playReference = () => { stopClip(); void playClip(clipId('w', word.id), { fallbackText: word.text }) }
  return <main className="page page-enter course-page course-repeat"><header className="page-header"><BackButton to={'/theme/' + themeId + '/learn?word=' + encodeURIComponent(word.id)} /><h1>{settings.showZh ? '单词跟读' : 'Word repeat'}</h1><div className="page-header__spacer" /><StarCounter stars={progress.stars} /></header>
    <div className="page__body course-content"><div className="course-player-title"><p>{settings.showZh ? '先听，再说' : 'Listen, then speak'}</p><h2>{word.text}</h2>{settings.showZh && <p>{word.zh}</p>}</div>
      <audio ref={reference} src={audioURL} preload="metadata" onLoadedMetadata={(event) => setReferenceDuration(event.currentTarget.duration || 1.2)} />
      <section className="repeat-step"><span className="repeat-step__number">1</span><div><h2>{settings.showZh ? '听标准发音' : 'Listen'}</h2><p>{settings.showZh ? '先听清这个单词。' : 'Listen to the word first.'}</p></div><BigButton onClick={playReference}>{settings.showZh ? '▶ 听一遍' : '▶ Listen'}</BigButton></section>
      <section className="repeat-step"><span className="repeat-step__number">2</span><div><h2>{settings.showZh ? '现在跟读' : 'Your turn'}</h2><p>{listening ? (settings.showZh ? '正在听你说，完成后点击结束。' : 'Listening… tap Stop when done.') : (settings.showZh ? '只在练习期间使用麦克风，不保存录音。' : 'The microphone is used only while practicing.')}</p></div><BigButton variant="primary" icon={listening ? '■' : '🎙️'} onClick={listening ? stop : start}>{listening ? (settings.showZh ? '结束跟读' : 'Stop') : (settings.showZh ? '开始跟读' : 'Start')}</BigButton></section>
      {analysis && <section className="repeat-feedback" aria-live="polite"><div className="repeat-stars" aria-label={analysis.score + ' / 3'}>{'★'.repeat(analysis.score)}{'☆'.repeat(3 - analysis.score)}</div><p>{repeatFeedback(analysis, settings.showZh)}</p></section>}
      {error && <div className="course-error" role="alert"><p>{error}</p></div>}
      <p className="course-status">{settings.showZh ? '这次只检查有没有清楚地说出单词，不做“标准发音”判定。结束后会立刻关闭麦克风并丢弃声音数据。' : 'This checks whether you made a clear attempt, not perfect pronunciation. The microphone closes and audio data is discarded when you stop.'}</p>
      <BigButton icon="📖" onClick={() => navigate('/theme/' + themeId + '/learn?word=' + encodeURIComponent(word.id))}>{settings.showZh ? '回到单词卡' : 'Back to word'}</BigButton>
    </div></main>
}
