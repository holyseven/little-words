import { useEffect, useRef, useState } from 'react'
import { BackButton } from '../components/BackButton'
import { BigButton } from '../components/BigButton'
import { StarCounter } from '../components/StarCounter'
import { courseURL, formatDuration, getCourseAsset, getCourseUnit, type CourseAsset } from '../content/curriculum'
import { useApp } from '../store/AppContext'
import { repeatFeedback, analyzeRepeat, type RepeatAnalysis } from '../logic/repeat'
import { navigate } from '../router'
import { NotFound } from './NotFound'
import './Course.css'

export function CourseRepeat({ assetId }: { assetId: string }) {
  const asset = getCourseAsset(assetId)
  return asset ? <Repeat asset={asset} /> : <NotFound />
}

function Repeat({ asset }: { asset: CourseAsset }) {
  const { settings, progress } = useApp()
  const unit = getCourseUnit(asset.unitId ?? undefined)
  const reference = useRef<HTMLAudioElement | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const chunks = useRef<Blob[]>([])
  const [recording, setRecording] = useState(false)
  const [recordingURL, setRecordingURL] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<RepeatAnalysis | null>(null)
  const [error, setError] = useState('')

  useEffect(() => () => {
    stream.current?.getTracks().forEach((track) => track.stop())
    if (recorder.current?.state === 'recording') recorder.current.stop()
    if (recordingURL) URL.revokeObjectURL(recordingURL)
  }, [recordingURL])

  const playReference = () => {
    reference.current?.pause()
    if (reference.current) { reference.current.currentTime = 0; void reference.current.play() }
  }
  const stopRecording = () => { if (recorder.current?.state === 'recording') recorder.current.stop() }
  const scoreRecording = async (blob: Blob) => {
    try {
      const context = new AudioContext()
      const decoded = await context.decodeAudioData(await blob.arrayBuffer())
      const result = analyzeRepeat(decoded.getChannelData(0), decoded.sampleRate, asset.duration)
      await context.close()
      setAnalysis(result)
    } catch { setError(settings.showZh ? '录音已保存，但暂时无法分析。可以直接回放。' : 'The recording is saved, but could not be analyzed.') }
  }
  const startRecording = async () => {
    setError(''); setAnalysis(null)
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { setError(settings.showZh ? '此设备暂不支持录音，请用 iPad Safari 或较新的浏览器。' : 'Recording is unavailable on this device.'); return }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true })
      const preferred = 'audio/mp4;codecs=mp4a.40.2'
      const mime = MediaRecorder.isTypeSupported(preferred) ? preferred : MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : ''
      recorder.current = new MediaRecorder(stream.current, mime ? { mimeType: mime } : undefined)
      chunks.current = []
      recorder.current.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data) }
      recorder.current.onstop = () => {
        const r = recorder.current
        stream.current?.getTracks().forEach((track) => track.stop()); stream.current = null
        if (!r || !chunks.current.length) { setRecording(false); return }
        const blob = new Blob(chunks.current, { type: r.mimeType || 'audio/mp4' })
        const url = URL.createObjectURL(blob)
        setRecordingURL((previous) => { if (previous) URL.revokeObjectURL(previous); return url })
        setRecording(false)
        void scoreRecording(blob)
      }
      recorder.current.start(); setRecording(true)
    } catch { setError(settings.showZh ? '需要允许麦克风，才能开始跟读。' : 'Microphone access is needed to repeat this line.') }
  }
  const back = '/course/play/' + asset.id
  return <main className="page page-enter course-page course-repeat"><header className="page-header"><BackButton to={back} /><h1>{settings.showZh ? '跟读练习' : 'Repeat practice'}</h1><div className="page-header__spacer" /><StarCounter stars={progress.stars} /></header>
    <div className="page__body course-content"><div className="course-player-title"><p>{unit?.title} {asset.pageLabel}</p><h2>{settings.showZh ? asset.title : asset.titleEn}</h2></div>
      <audio ref={reference} src={courseURL(asset.file)} preload="metadata" />
      <section className="repeat-step"><span className="repeat-step__number">1</span><div><h2>{settings.showZh ? '先听标准音频' : 'Listen first'}</h2><p>{settings.showZh ? '听清楚以后，再轮到你说。' : 'Listen carefully, then it is your turn.'}</p></div><BigButton onClick={playReference}>{settings.showZh ? '▶ 听一遍' : '▶ Listen'}</BigButton></section>
      <section className="repeat-step"><span className="repeat-step__number">2</span><div><h2>{settings.showZh ? '轮到你跟读' : 'Your turn'}</h2><p>{recording ? (settings.showZh ? '正在听，请说完整一段。' : 'Listening… say the whole line.') : (settings.showZh ? '点击麦克风后开始说话。' : 'Tap the microphone and speak.')}</p></div><BigButton variant="primary" icon={recording ? '■' : '🎙️'} onClick={recording ? stopRecording : startRecording}>{recording ? (settings.showZh ? '结束录音' : 'Stop') : (settings.showZh ? '开始录音' : 'Record')}</BigButton></section>
      {recordingURL && <section className="repeat-result"><h2>{settings.showZh ? '3 · 听听自己的声音' : '3 · Hear yourself'}</h2><audio controls src={recordingURL} /><BigButton onClick={startRecording}>{settings.showZh ? '再录一次' : 'Record again'}</BigButton>{analysis && <div className="repeat-feedback" aria-live="polite"><div className="repeat-stars" aria-label={analysis.score + ' / 3'}>{'★'.repeat(analysis.score)}{'☆'.repeat(3 - analysis.score)}</div><p>{repeatFeedback(analysis, settings.showZh)}</p><small>{settings.showZh ? '连续发声 ' + (analysis.voicedRatio * 100).toFixed(0) + '% · ' + formatDuration(analysis.duration) : (analysis.voicedRatio * 100).toFixed(0) + '% voiced · ' + formatDuration(analysis.duration)}</small></div>}</section>}
      {error && <div className="course-error" role="alert"><p>{error}</p></div>}
      <p className="course-status">{settings.showZh ? '练习反馈只看声音是否录到、时长和连续程度，不把它当成“标准发音”判定。录音只在本页保留，离开后会清除。' : 'This practice check looks at recording, timing and continuity. It is not a pronunciation verdict. The recording is kept on this page only.'}</p>
      <BigButton icon="📖" onClick={() => navigate(back)}>{settings.showZh ? '回到课文' : 'Back to lesson'}</BigButton>
    </div></main>
}
