import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { loadVoskModel } from '../logic/vosk'
import type { Recognizer } from '../logic/vosk'
import { clearConfetti } from './Confetti'

type State = 'idle' | 'loading' | 'requesting' | 'listening' | 'recognizing' | 'matched' | 'unmatched' | 'error'
export interface InlineWordRepeatHandle { cancel: () => void }
interface Props { word: string; showZh: boolean; onBeforeStart: () => void; onSuccess?: () => void }
interface Session {
  audio: AudioContext | null
  stream: MediaStream | null
  source: MediaStreamAudioSourceNode | null
  processor: ScriptProcessorNode | null
  sink: GainNode | null
  recognizer: Recognizer | null
  frame: number | null
  timer: ReturnType<typeof setTimeout> | null
  soundMs: number
  finalText: string
  finishing: boolean
  sampleRate: number
  resultWaiter: { resolve: () => void; timer: ReturnType<typeof setTimeout> } | null
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

function release(session: Session) {
  if (session.frame !== null) cancelAnimationFrame(session.frame)
  if (session.timer !== null) clearTimeout(session.timer)
  if (session.resultWaiter !== null) {
    clearTimeout(session.resultWaiter.timer)
    session.resultWaiter.resolve()
    session.resultWaiter = null
  }
  session.source?.disconnect()
  session.processor?.disconnect()
  session.sink?.disconnect()
  session.processor && (session.processor.onaudioprocess = null)
  session.recognizer?.remove()
  session.stream?.getTracks().forEach((track) => track.stop())
  if (session.audio && session.audio.state !== 'closed') void session.audio.close().catch(() => {})
}

/** 这里只检测声响，不识别单词，也不把信号强弱换算成发音分数。 */
export const InlineWordRepeat = forwardRef<InlineWordRepeatHandle, Props>(function InlineWordRepeat({ word, showZh, onBeforeStart, onSuccess }, ref) {
  const session = useRef<Session | null>(null)
  const [state, setState] = useState<State>('idle')
  const [error, setError] = useState('')
  const [level, setLevel] = useState(0)
  const [successMessage, setSuccessMessage] = useState(0)
  const statusId = 'word-repeat-status'

  const dispose = useCallback(() => {
    const current = session.current
    session.current = null
    if (current) release(current)
  }, [])
  const cancel = useCallback(() => {
    dispose()
    setState('idle')
    setLevel(0)
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
    if (current.recognizer && current.soundMs >= 120) {
      setState('recognizing')
      // 短单词需要清晰的语音边界；补静音只送入模型内存，不保存孩子的声音。
      current.recognizer.acceptWaveformFloat(new Float32Array(Math.floor(current.sampleRate * 0.35)), current.sampleRate)
      current.recognizer.retrieveFinalResult()
      // Vosk 在 Worker 中异步计算最终结果。低性能设备上 450ms 不够，
      // 过早销毁识别器会把本来识别成功的单词误判为空结果。
      await new Promise<void>((resolve) => {
        current.resultWaiter = {
          resolve,
          timer: setTimeout(resolve, 1800),
        }
      })
    }
    if (session.current !== current) return
    const expected = word.trim().toLowerCase()
    const recognized = current.finalText.trim().toLowerCase().replace(/[^a-z']+/g, ' ').trim()
    const matched = current.soundMs >= 120 && recognized.split(' ').some((token) => token === expected)
    const heard = current.soundMs >= 120
    dispose()
    setLevel(0)
    setState(matched ? 'matched' : heard ? 'unmatched' : 'error')
    if (matched) setSuccessMessage(Math.floor(Math.random() * SUCCESS_MESSAGES.length))
    if (!heard) setError(showZh ? '没有检测到清晰的声音，请靠近麦克风再试一次。' : 'No clear voice was detected. Move closer to the microphone and try again.')
    if (matched) onSuccess?.()
  }

  const start = async () => {
    if (session.current) return
    onBeforeStart()
    setError('')
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setState('error')
      setError(showZh ? '请用 HTTPS，或在这台 Mac 上用 localhost 打开后重试。' : 'Open using HTTPS or localhost on this Mac to use the microphone.')
      return
    }
    const current: Session = { audio: null, stream: null, source: null, processor: null, sink: null, recognizer: null, frame: null, timer: null, soundMs: 0, finalText: '', finishing: false, sampleRate: 16000, resultWaiter: null }
    session.current = current
    let modelLoaded = false
    // 必须在点击手势还有效时创建并恢复 AudioContext。iOS Safari 在等待
    // 本机模型下载/解压后再调用 resume() 时，可能会把它留在 suspended 状态。
    let resumed: Promise<unknown> = Promise.resolve()
    try {
      current.audio = new AudioContext()
      resumed = current.audio.resume().catch(() => {})
      setState('loading')
      const model = await loadVoskModel()
      modelLoaded = true
      if (session.current !== current) return
      setState('requesting')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      if (session.current !== current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      current.stream = stream
      await resumed
      if (session.current !== current) return
      if (document.hidden || current.audio.state !== 'running') throw new Error('Audio context is not running')
      const node = current.audio.createAnalyser()
      node.fftSize = 1024
      const samples = new Float32Array(node.fftSize)
      current.source = current.audio.createMediaStreamSource(stream)
      current.source.connect(node)
      current.recognizer = new model.KaldiRecognizer(16000, JSON.stringify([word.trim().toLowerCase(), '[unk]']))
      current.sampleRate = 16000
      current.recognizer.acceptWaveformFloat(new Float32Array(Math.floor(16000 * 0.35)), 16000)
      current.recognizer.on('result', (message) => {
        const text = message.result?.text ?? ''
        if (text) current.finalText = text
        if (current.finishing && current.resultWaiter) {
          clearTimeout(current.resultWaiter.timer)
          current.resultWaiter.resolve()
          current.resultWaiter = null
        }
      })
      current.processor = current.audio.createScriptProcessor(4096, 1, 1)
      current.sink = current.audio.createGain()
      current.sink.gain.value = 0
      current.processor.onaudioprocess = (event) => {
        if (session.current !== current || !current.recognizer || !current.audio) return
        const samples16k = resampleTo16k(event.inputBuffer.getChannelData(0), current.audio.sampleRate)
        current.recognizer.acceptWaveformFloat(samples16k, 16000)
      }
      current.source.connect(current.processor)
      current.processor.connect(current.sink)
      current.sink.connect(current.audio.destination)
      for (const track of stream.getTracks()) track.addEventListener('ended', () => {
        if (session.current !== current) return
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
        if (rms >= 0.006) { current.soundMs += elapsed; lastSound = now }
        if (now - lastDisplay >= 80) {
          setLevel(Math.min(100, Math.round(rms * 1200)))
          lastDisplay = now
        }
        if (current.soundMs >= 120 && now - lastSound >= 850) { void finish(current); return }
        current.frame = requestAnimationFrame(monitor)
      }
      setState('listening')
      current.timer = setTimeout(() => { void finish(current) }, 5000)
      current.frame = requestAnimationFrame(monitor)
    } catch (cause) {
      if (session.current !== current) return
      dispose()
      const denied = cause instanceof DOMException && (cause.name === 'NotAllowedError' || cause.name === 'SecurityError')
      setState('error')
      setError(!modelLoaded
        ? (showZh ? '离线语音模型加载失败，请联网打开一次后再试。' : 'The offline speech model could not load. Connect once and try again.')
        : (showZh
          ? (denied ? '请允许浏览器使用麦克风，再试一次。' : '麦克风暂时无法使用，请检查设备后重试。')
          : (denied ? 'Please allow microphone access and try again.' : 'The microphone is unavailable. Check the device and try again.')))
    }
  }

  const listening = state === 'listening'
  const text = (zh: string, en: string) => showZh ? zh : en
  const message = state === 'requesting' ? text('正在打开麦克风…首次使用请允许权限。', 'Opening the microphone… please allow access on first use.')
    : listening ? text('正在听，说完会自动结束。', 'Listening. This will finish automatically.')
      : state === 'recognizing' ? text('正在判断这个单词…', 'Checking the word…')
          : state === 'matched' ? text(SUCCESS_MESSAGES[successMessage].zh, SUCCESS_MESSAGES[successMessage].en)
          : state === 'unmatched' ? text('这次没有识别到目标单词，再试一次。', 'The target word was not recognized. Try again.')
          : state === 'error' ? error : text('首次跟读会加载约 39MB 的本机模型，之后可离线使用。', 'The first repeat loads a ~39MB local model; later repeats work offline.')

  return <>
    <button type="button" className={`btn btn--soft ${listening ? 'btn--listening' : ''}`} disabled={state === 'loading' || state === 'requesting' || state === 'recognizing'}
      aria-describedby={statusId} onClick={listening ? () => { if (session.current) void finish(session.current) } : start}>
      <span className="emoji" aria-hidden="true">{listening ? '■' : '🎙️'}</span>
      <span>{state === 'loading' ? text('正在加载模型…', 'Loading model…') : state === 'requesting' ? text('正在打开…', 'Opening…') : state === 'recognizing' ? text('正在判断…', 'Checking…') : listening ? text('正在听…', 'Listening…') : text('跟读这个词', 'Repeat this word')}</span>
    </button>
    <div className="learn__repeat-status" id={statusId} role="status">
      {listening && <span className="learn__repeat-level" aria-hidden="true"><span style={{ width: `${level}%` }} /></span>}
      {state === 'matched' && <span className="learn__repeat-celebration" aria-hidden="true">{SUCCESS_MESSAGES[successMessage].emoji}</span>}
      {message}
    </div>
  </>
})
