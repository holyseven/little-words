import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useRef, useState } from 'react'
import { loadVoskModel } from '../logic/vosk'
import type { Recognizer } from '../logic/vosk'
import { assessAzurePronunciation, concatPcm, type AzurePronunciationResult } from '../logic/azurePronunciation'
import { normalizeSpeechPcm } from '../logic/audioInput'
import { stopMicrophoneCapture, type CaptureResources } from '../audio/capture'
import { beginMicrophoneSession, preparePlaybackSession, settleMicrophoneRequest } from '../audio/session'
import { voskVocabulary } from '../logic/speechTokens'
import { createVoskResultWaiter, mergeVoskFinal, type VoskResultWaiter } from '../logic/voskResults'
import { decideAzureRepeat, decideRepeat, type RepeatRecognitionDecision, type RepeatRecognitionWord } from '../logic/repeat'
import { clearConfetti } from './Confetti'
import './InlineWordRepeat.css'

type State = 'idle' | 'loading' | 'requesting' | 'listening' | 'recognizing' | 'matched' | 'matched-soft' | 'unmatched' | 'error'
export interface InlineWordRepeatHandle { cancel: () => void }
export type RepeatEngine = 'azure' | 'vosk'
interface Props { word: string; candidates?: string[]; showZh: boolean; engine?: RepeatEngine; practiceKind?: 'word' | 'sentence'; disabled?: boolean; hideIdleNotice?: boolean; onBeforeStart: () => void; onSuccess?: () => void; onFailure?: () => void; buttonText?: string }
interface Session extends CaptureResources {
  recognizer: Recognizer | null
  soundMs: number
  finalText: string
  finalWords: RepeatRecognitionWord[]
  partialText: string
  finishing: boolean
  sampleRate: number
  resultWaiter: VoskResultWaiter | null
  pcmChunks: Float32Array[]
  pcmLength: number
  azureController: AbortController | null
}

const SUCCESS_MESSAGES = [
  { emoji: '👏 ✨', zh: 'Perfect！读得很好！', en: 'Perfect! Great job!' },
  { emoji: '🎉 🌟', zh: 'Very good！真厉害！', en: 'Very good! Amazing!' },
  { emoji: '👍 💫', zh: 'Good job！读对啦！', en: 'Good job! You got it!' },
  { emoji: '🌈 🎊', zh: 'Amazing！读得好！', en: 'Amazing! You read it!' },
] as const

// Vosk's small English model is trained for 16 kHz mono PCM. Safari and most
// iPad microphones expose a 44.1/48 kHz AudioContext, so resample each render
// quantum before handing it to the recognizer. Feeding the native rate makes
// short words especially easy to miss on those devices.
function resampleTo16k(input: Float32Array, inputRate: number): Float32Array {
  const targetRate = 16000
  if (inputRate === targetRate) return new Float32Array(input)
  const outputLength = Math.max(1, Math.floor(input.length * targetRate / inputRate))
  const output = new Float32Array(outputLength)
  const ratio = inputRate / targetRate
  for (let i = 0; i < outputLength; i += 1) {
    const position = i * ratio
    const left = Math.floor(position)
    const right = Math.min(left + 1, input.length - 1)
    const fraction = position - left
    output[i] = input[left] * (1 - fraction) + input[right] * fraction
  }
  return output
}

async function recognizePcmWithVosk(current: Session, word: string, candidates: string[] | undefined, sentencePractice: boolean): Promise<RepeatRecognitionDecision> {
  const model = await loadVoskModel()
  if (current.azureController?.signal.aborted) throw new DOMException('Practice cancelled', 'AbortError')
  const vocabulary = voskVocabulary(word, candidates)
  const recognizer = new model.KaldiRecognizer(16000, JSON.stringify(vocabulary))
  current.recognizer = recognizer
  recognizer.setWords(true)
  let final = { finalText: '', finalWords: [] as RepeatRecognitionWord[] }
  let partialText = ''
  recognizer.on('result', (message) => {
    const text = message.result?.text?.trim() ?? ''
    const words = (message.result?.result ?? []).map((item) => ({ word: item.word, conf: item.conf }))
    final = mergeVoskFinal(final, text, words, sentencePractice)
    current.resultWaiter?.onFinalResult(Boolean(text))
  })
  recognizer.on('partialresult', (message) => {
    const text = message.result?.partial ?? ''
    if (text) partialText = text
    current.resultWaiter?.onPartialResult()
  })
  // Install the waiter before queueing audio. A sentence can produce several
  // endpoints; allow the flush to arrive instead of stopping at the first one.
  const waiter = createVoskResultWaiter(sentencePractice)
  current.resultWaiter = waiter
  for (const chunk of current.pcmChunks) recognizer.acceptWaveformFloat(chunk, 16000)
  recognizer.acceptWaveformFloat(new Float32Array(Math.floor(16000 * 0.35)), 16000)
  recognizer.retrieveFinalResult()
  await waiter.done
  if (current.resultWaiter === waiter) current.resultWaiter = null
  if (current.azureController?.signal.aborted) throw new DOMException('Practice cancelled', 'AbortError')
  return decideRepeat({ soundMs: current.soundMs, ...final, partialText }, word)
}

function release(session: Session) {
  void stopMicrophoneCapture(session)
  if (session.resultWaiter !== null) {
    session.resultWaiter.cancel()
    session.resultWaiter = null
  }
  session.azureController?.abort()
  session.recognizer?.remove()
}

/** 按家长设置选择在线音素评估或本地词级识别；在线结果只在本次反馈中展示。 */
export const InlineWordRepeat = forwardRef<InlineWordRepeatHandle, Props>(function InlineWordRepeat({ word, candidates, showZh, engine = 'azure', practiceKind = 'word', disabled = false, hideIdleNotice = false, onBeforeStart, onSuccess, onFailure, buttonText }, ref) {
  const session = useRef<Session | null>(null)
  const [state, setState] = useState<State>('idle')
  const [error, setError] = useState('')
  const [level, setLevel] = useState(0)
  const [successMessage, setSuccessMessage] = useState(0)
  const [notice, setNotice] = useState('')
  const [assessment, setAssessment] = useState<AzurePronunciationResult | null>(null)
  const statusId = useId()
  const sentencePractice = practiceKind === 'sentence'
  // Children need time to pause between words in a short spoken answer.
  const silenceMs = sentencePractice ? 1400 : 850
  const maxCaptureMs = sentencePractice ? 9000 : 5000

  const dispose = useCallback(() => {
    const current = session.current
    session.current = null
    if (current) release(current)
  }, [])
  const cancel = useCallback(() => {
    dispose()
    setState('idle')
    setLevel(0)
    setNotice('')
    setAssessment(null)
  }, [dispose])
  useImperativeHandle(ref, () => ({ cancel }), [cancel])

  useEffect(() => {
    const visibility = () => { if (document.hidden) cancel() }
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('pagehide', cancel)
    return () => {
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('pagehide', cancel)
      clearConfetti()
      dispose()
    }
  }, [cancel, dispose])

  const finish = async (current: Session) => {
    if (session.current !== current || current.finishing) return
    current.finishing = true
    setState('recognizing')
    // Evaluation uses the retained PCM/recognizer, so it needs no live mic.
    // Restore the output category before model waits and celebration sounds.
    await stopMicrophoneCapture(current)
    await preparePlaybackSession()
    if (session.current !== current) return
    if (engine === 'vosk' && current.recognizer && current.soundMs >= 120) {
      setState('recognizing')
      // 短单词需要清晰的语音边界；补静音只送入模型内存，不保存孩子的声音。
      // 音频块可能需要几秒；先安装 waiter，再发结束消息，避免结果刚好
      // 回来时 waiter 还没有挂上而只能等超时。
      const waiter = createVoskResultWaiter(sentencePractice)
      current.resultWaiter = waiter
      current.recognizer.acceptWaveformFloat(new Float32Array(Math.floor(current.sampleRate * 0.35)), current.sampleRate)
      current.recognizer.retrieveFinalResult()
      await waiter.done
      if (current.resultWaiter === waiter) current.resultWaiter = null
    }
    if (session.current !== current) return
    let decision = decideRepeat({ soundMs: current.soundMs, finalText: current.finalText, finalWords: current.finalWords, partialText: current.partialText }, word)
    if (engine === 'azure' && current.pcmLength > 0 && current.soundMs >= 120) {
      setState('recognizing')
      try {
        current.azureController = new AbortController()
        // iPad Safari sometimes delivers a very quiet first capture when its
        // input processing is warming up. Normalize only quiet clips before
        // Azure/Vosk sees them; this does not save or replay the recording.
        const normalizedPcm = normalizeSpeechPcm(concatPcm(current.pcmChunks, current.pcmLength))
        current.pcmChunks = [normalizedPcm]
        current.pcmLength = normalizedPcm.length
        const assessment = await assessAzurePronunciation(normalizedPcm, word, current.azureController.signal)
        if (session.current !== current) return
        setAssessment(assessment)
        // Azure 只有在返回目标词和有效准确度时才算“在线命中”；没有分数的
        // 异常响应不会被宽松策略误判成成功。
        decision = decideAzureRepeat({
          recognized: assessment.matched,
          accuracyScore: assessment.accuracyScore,
          phonemeScores: assessment.phonemes
            .map((item) => item.accuracyScore)
            .filter((value): value is number => value !== undefined),
        }, current.soundMs)
      } catch {
        if (session.current !== current) return
        setAssessment(null)
        // 在线代理未配置、没有网络或请求超时，都保留原有的本地 Vosk 体验。
        try {
          decision = await recognizePcmWithVosk(current, word, candidates, sentencePractice)
          if (session.current !== current) return
          setNotice(showZh ? '在线评估暂不可用，已用本地模式判断。' : 'Online assessment is unavailable, so local mode was used.')
        } catch {
          if (session.current !== current) return
          setNotice(showZh ? '在线评估暂不可用，请稍后再试。' : 'Online assessment is unavailable. Please try again later.')
        }
      }
    }
    if (session.current !== current) return
    const matched = decision.matched
    const heard = current.soundMs >= 120
    dispose()
    setLevel(0)
    setState(matched ? decision.uncertain ? 'matched-soft' : 'matched' : heard ? 'unmatched' : 'error')
    if (matched) setSuccessMessage(Math.floor(Math.random() * SUCCESS_MESSAGES.length))
    if (!heard) setError(showZh ? '没有检测到清晰的声音，请靠近麦克风再试一次。' : 'No clear voice was detected. Move closer to the microphone and try again.')
    // 中等分数只显示温和提示，避免一次不够清晰的读音直接推进游戏或庆祝。
    if (matched && !decision.uncertain) onSuccess?.()
    else if (!matched && heard) onFailure?.()
  }

  const start = async () => {
    if (disabled || session.current) return
    onBeforeStart()
    setAssessment(null)
    setError('')
    setNotice('')
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setState('error')
      setError(showZh ? '请用 HTTPS，或在这台 Mac 上用 localhost 打开后重试。' : 'Open using HTTPS or localhost on this Mac to use the microphone.')
      return
    }
    const current: Session = { audio: null, stream: null, source: null, processor: null, sink: null, recognizer: null, frame: null, timer: null, soundMs: 0, finalText: '', finalWords: [], partialText: '', finishing: false, sampleRate: 16000, resultWaiter: null, pcmChunks: [], pcmLength: 0, azureController: null, microphoneLease: null, captureCleanup: null }
    session.current = current
    let modelLoaded = false
    // 必须在点击手势还有效时创建并恢复 AudioContext。iOS Safari 在等待
    // 本机模型下载/解压后再调用 resume() 时，可能会把它留在 suspended 状态。
    let resumed: Promise<unknown> = Promise.resolve()
    try {
      current.audio = new AudioContext()
      resumed = current.audio.resume().catch(() => {})
      let model: Awaited<ReturnType<typeof loadVoskModel>> | null = null
      if (engine === 'vosk') {
        setState('loading')
        model = await loadVoskModel()
        modelLoaded = true
      }
      if (session.current !== current) return
      setState('requesting')
      // Do not force Safari's native sample rate; the Web Audio path resamples
      // it to 16 kHz below. Echo/noise suppression can attenuate a child's
      // quiet consonants on iPad. Keep input gain control for quiet voices;
      // it is separate from restoring the speaker's playback category.
      const supported = navigator.mediaDevices.getSupportedConstraints?.()
      const audioConstraints: MediaTrackConstraints = { channelCount: 1 }
      if (!supported || supported.echoCancellation) audioConstraints.echoCancellation = false
      if (!supported || supported.noiseSuppression) audioConstraints.noiseSuppression = false
      if (!supported || supported.autoGainControl) audioConstraints.autoGainControl = true
      const lease = beginMicrophoneSession()
      current.microphoneLease = lease
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints })
        if (session.current !== current) {
          // A cancelled permission request can still resolve with live tracks.
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        current.stream = stream
      } finally {
        settleMicrophoneRequest(lease)
      }
      await resumed
      if (session.current !== current) return
      if (document.hidden || current.audio.state !== 'running') throw new Error('Audio context is not running')
      const node = current.audio.createAnalyser()
      node.fftSize = 1024
      const samples = new Float32Array(node.fftSize)
      current.source = current.audio.createMediaStreamSource(stream)
      current.source.connect(node)
      current.sampleRate = 16000
      if (model) {
        const vocabulary = voskVocabulary(word, candidates)
        current.recognizer = new model.KaldiRecognizer(16000, JSON.stringify(vocabulary))
        current.recognizer.setWords(true)
        current.recognizer.acceptWaveformFloat(new Float32Array(Math.floor(16000 * 0.35)), 16000)
        current.recognizer.on('result', (message) => {
          if (session.current !== current) return
          const text = message.result?.text?.trim() ?? ''
          const words = (message.result?.result ?? []).map((item) => ({ word: item.word, conf: item.conf }))
          Object.assign(current, mergeVoskFinal(current, text, words, sentencePractice))
          current.resultWaiter?.onFinalResult(Boolean(text))
        })
        current.recognizer.on('partialresult', (message) => {
          if (session.current !== current) return
          const text = message.result?.partial ?? ''
          if (text) current.partialText = text
          current.resultWaiter?.onPartialResult()
        })
      }
      current.processor = current.audio.createScriptProcessor(4096, 1, 1)
      current.sink = current.audio.createGain()
      current.sink.gain.value = 0
      current.processor.onaudioprocess = (event) => {
        if (session.current !== current || current.finishing || !current.audio) return
        const samples16k = resampleTo16k(event.inputBuffer.getChannelData(0), current.audio.sampleRate)
        if (engine === 'azure') {
          current.pcmChunks.push(samples16k)
          current.pcmLength += samples16k.length
        }
        current.recognizer?.acceptWaveformFloat(samples16k, 16000)
      }
      current.source.connect(current.processor)
      current.processor.connect(current.sink)
      current.sink.connect(current.audio.destination)
      for (const track of stream.getTracks()) track.addEventListener('ended', () => {
        if (session.current !== current || current.finishing) return
        dispose()
        setLevel(0)
        setState('error')
        setError(showZh ? '麦克风已断开，请重试。' : 'The microphone disconnected. Please try again.')
      })
      let previous = performance.now()
      let lastSound = previous
      let lastDisplay = previous
      const monitor = (now: number) => {
        if (session.current !== current) return
        node.getFloatTimeDomainData(samples)
        let sum = 0
        for (const sample of samples) sum += sample * sample
        const rms = Math.sqrt(sum / samples.length)
        const elapsed = Math.min(100, now - previous)
        previous = now
        // 儿童说话通常比成人轻，降低阈值但仍保留一点环境噪声过滤。
        // Keep a little headroom for iPad's quiet input path while filtering
        // the lowest-level room noise. The captured PCM is normalized later.
        if (rms >= 0.0045) { current.soundMs += elapsed; lastSound = now }
        if (now - lastDisplay >= 80) {
          setLevel(Math.min(100, Math.round(rms * 1200)))
          lastDisplay = now
        }
        if (current.soundMs >= 120 && now - lastSound >= silenceMs) { void finish(current); return }
        current.frame = requestAnimationFrame(monitor)
      }
      setState('listening')
      current.timer = setTimeout(() => { void finish(current) }, maxCaptureMs)
      current.frame = requestAnimationFrame(monitor)
    } catch (cause) {
      if (session.current !== current) return
      dispose()
      const denied = cause instanceof DOMException && (cause.name === 'NotAllowedError' || cause.name === 'SecurityError')
      setState('error')
      setError(engine === 'vosk' && !modelLoaded
        ? (showZh ? '离线语音模型加载失败，请联网打开一次后再试。' : 'The offline speech model could not load. Connect once and try again.')
        : (showZh
          ? (denied ? '请允许浏览器使用麦克风，再试一次。' : '麦克风暂时无法使用，请检查设备后重试。')
          : (denied ? 'Please allow microphone access and try again.' : 'The microphone is unavailable. Check the device and try again.')))
    }
  }

  const listening = state === 'listening'
  const text = (zh: string, en: string) => showZh ? zh : en
  const targetLabel = sentencePractice ? text('这句回答', 'the answer') : text('目标单词', 'the target word')
  const unrecognizedLabel = sentencePractice ? text('未识别这句回答', 'Answer not recognized') : text('未识别目标词', 'Target word not recognized')
  const message = state === 'requesting' ? text('正在打开麦克风…首次使用请允许权限。', 'Opening the microphone… please allow access on first use.')
    : listening ? text('正在听，说完会自动结束。', 'Listening. This will finish automatically.')
      : state === 'recognizing' ? text(engine === 'azure' ? '正在在线判断发音…' : sentencePractice ? '正在判断这句话…' : '正在判断这个单词…', engine === 'azure' ? 'Checking pronunciation online…' : sentencePractice ? 'Checking the sentence…' : 'Checking the word…')
      : state === 'matched' ? text(SUCCESS_MESSAGES[successMessage].zh, SUCCESS_MESSAGES[successMessage].en)
          : state === 'matched-soft' ? text('听到了！再清楚一点就更棒啦！', 'I heard it! A little clearer would be even better!')
          : state === 'unmatched' ? text(`这次没有识别到${targetLabel}，再试一次。`, sentencePractice ? 'The answer was not recognized. Try again.' : 'The target word was not recognized. Try again.')
          : state === 'error' ? error : hideIdleNotice && state === 'idle' ? '' : engine === 'azure'
            ? text('默认使用在线发音评估；网络不可用时会自动切到本地模式。', 'Online pronunciation assessment is on by default; local mode is used when it is unavailable.')
            : text('首次跟读会加载约 39MB 的本机模型，之后可离线使用。', 'The first repeat loads a ~39MB local model; later repeats work offline.')
  const scoreValue = (value: number | undefined) => value === undefined ? null : Number.isInteger(value) ? value.toString() : value.toFixed(1)
  const scoreLabel = (value: number | undefined) => {
    const displayed = scoreValue(value)
    return displayed === null ? null : `${displayed}/100`
  }
  const scoreAssessment = engine === 'azure' ? assessment : null
  const scoreTitle = text('本次在线评分', 'Online score')

  return <>
    <button type="button" className={`btn btn--soft ${listening ? 'btn--listening' : ''}`} disabled={disabled || state === 'loading' || state === 'requesting' || state === 'recognizing'}
      aria-describedby={statusId} onClick={listening ? () => { if (session.current) void finish(session.current) } : start}>
      <span className="emoji" aria-hidden="true">{listening ? '■' : '🎙️'}</span>
      <span>{state === 'loading' ? text('正在加载模型…', 'Loading model…') : state === 'requesting' ? text('正在打开…', 'Opening…') : state === 'recognizing' ? text('正在判断…', 'Checking…') : listening ? sentencePractice ? text('结束并判断', 'Finish & check') : text('正在听…', 'Listening…') : (buttonText ?? (sentencePractice ? text('跟读这句话', 'Repeat this sentence') : text('跟读这个词', 'Repeat this word')))}</span>
    </button>
    <div className="learn__repeat-status" id={statusId} role="status">
      {listening && <span className="learn__repeat-level" aria-hidden="true"><span style={{ width: `${level}%` }} /></span>}
      {state === 'matched' && <span className="learn__repeat-celebration" aria-hidden="true">{SUCCESS_MESSAGES[successMessage].emoji}</span>}
      {notice && <span>{notice} </span>}{message}
      {scoreAssessment && <div className="learn__repeat-score" aria-label={scoreAssessment.recognized ? scoreTitle : unrecognizedLabel}>
        <strong>{scoreAssessment.recognized ? scoreTitle : unrecognizedLabel}</strong>
        {scoreAssessment.recognized && scoreAssessment.pronunciationScore !== undefined && <span>{text('综合', 'Overall')} <b>{scoreLabel(scoreAssessment.pronunciationScore)}</b></span>}
        {scoreAssessment.recognized && scoreAssessment.accuracyScore !== undefined && <span>{text('准确度', 'Accuracy')} <b>{scoreLabel(scoreAssessment.accuracyScore)}</b></span>}
        {scoreAssessment.recognized && scoreAssessment.fluencyScore !== undefined && <span>{text('流畅度', 'Fluency')} <b>{scoreLabel(scoreAssessment.fluencyScore)}</b></span>}
        {scoreAssessment.recognized && scoreAssessment.completenessScore !== undefined && <span>{text('完整度', 'Completeness')} <b>{scoreLabel(scoreAssessment.completenessScore)}</b></span>}
        {scoreAssessment.recognized && scoreAssessment.phonemes.some((item) => item.accuracyScore !== undefined) && <span className="learn__repeat-score-detail">
          {text('音素', 'Phonemes')} {scoreAssessment.phonemes
            .filter((item) => item.accuracyScore !== undefined)
            .map((item) => `${item.phoneme} ${scoreValue(item.accuracyScore)}`)
            .join(' · ')}
        </span>}
      </div>}
    </div>
  </>
})
