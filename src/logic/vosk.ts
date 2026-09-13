export interface Recognizer {
  on(event: 'result', listener: (message: { result?: { text?: string } }) => void): void
  acceptWaveformFloat(samples: Float32Array, sampleRate: number): void
  retrieveFinalResult(): void
  remove(): void
}
interface Model { KaldiRecognizer: new (sampleRate: number, grammar?: string) => Recognizer }
interface BrowserVosk { createModel(url: string, logLevel?: number): Promise<Model> }

const modelURL = `${import.meta.env.BASE_URL}speech-model/model.tar.gz`
let modelPromise: Promise<Model> | null = null
let runtimePromise: Promise<BrowserVosk> | null = null

function loadRuntime(): Promise<BrowserVosk> {
  runtimePromise ??= new Promise((resolve, reject) => {
    const existing = (window as Window & { Vosk?: BrowserVosk }).Vosk
    if (existing) { resolve(existing); return }
    const script = document.createElement('script')
    script.src = `${import.meta.env.BASE_URL}speech-runtime/vosk.js`
    script.async = true
    script.onload = () => {
      const runtime = (window as Window & { Vosk?: BrowserVosk }).Vosk
      runtime ? resolve(runtime) : reject(new Error('Vosk runtime did not initialize'))
    }
    script.onerror = () => reject(new Error('Vosk runtime failed to load'))
    document.head.appendChild(script)
  })
  return runtimePromise
}

/** 模型只加载一次，并由 Vosk 自己放进 Worker；不会阻塞首屏。 */
export function loadVoskModel(): Promise<Model> {
  modelPromise ??= loadRuntime().then((runtime) => runtime.createModel(modelURL, -1)).catch((error) => {
    modelPromise = null
    throw error
  })
  return modelPromise
}
