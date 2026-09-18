/**
 * Azure Pronunciation Assessment 的轻量 REST 客户端。
 *
 * 默认从网页直接请求 Azure；没有前端 key 时再请求同源的 /api/pronunciation
 * 代理。前端 key 适合本项目的限额试用，代理模式仍可用于本地安全实验。
 * 请求失败时调用方会回退到 Vosk。本文件只保存本次练习的 PCM，不创建录音文件。
 */

export interface AzurePhonemeScore {
  phoneme: string
  accuracyScore?: number
}

export interface AzurePronunciationResult {
  recognizedText: string
  recognized: boolean
  matched: boolean
  accuracyScore?: number
  fluencyScore?: number
  completenessScore?: number
  pronunciationScore?: number
  phonemes: AzurePhonemeScore[]
}

export const AZURE_PROXY_PATH = (import.meta.env.VITE_PRONUNCIATION_PROXY_URL as string | undefined)?.trim()
  || `${import.meta.env.BASE_URL}api/pronunciation`

const directKey = (import.meta.env.VITE_AZURE_SPEECH_KEY as string | undefined)?.trim()
const directRegion = (import.meta.env.VITE_AZURE_SPEECH_REGION as string | undefined)?.trim()
const directEndpoint = (import.meta.env.VITE_AZURE_SPEECH_ENDPOINT as string | undefined)?.trim()

function assessmentHeader(expected: string): string {
  const value = JSON.stringify({
    ReferenceText: expected,
    GradingSystem: 'HundredMark',
    Granularity: 'Phoneme',
    Dimension: 'Comprehensive',
    EnableMiscue: 'True',
  })
  // btoa is available in all target browsers; UTF-8 is not needed because the
  // reference text is an English word.
  return btoa(value)
}

function directAzureUrl(): string | null {
  if (!directKey || !directRegion) return null
  const endpoint = directEndpoint?.replace(/\/$/, '') || `https://${directRegion}.stt.speech.microsoft.com`
  const path = endpoint.includes('.cognitiveservices.azure.com')
    ? '/stt/speech/recognition/conversation/cognitiveservices/v1'
    : '/speech/recognition/conversation/cognitiveservices/v1'
  return `${endpoint}${path}?language=en-US&format=detailed`
}

function normalizedTokens(value: string): string[] {
  return value.trim().toLowerCase().replace(/[^a-z']+/g, ' ').trim().split(' ').filter(Boolean)
}

function pcmToWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const dataLength = samples.length * 2
  const buffer = new ArrayBuffer(44 + dataLength)
  const view = new DataView(buffer)
  const text = (offset: number, value: string) => { for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i)) }
  text(0, 'RIFF')
  view.setUint32(4, 36 + dataLength, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  text(36, 'data')
  view.setUint32(40, dataLength, true)
  for (let i = 0; i < samples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, samples[i] ?? 0))
    view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
  }
  return buffer
}

function number(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/**
 * 直接模式把 Azure key 放在浏览器请求里；没有 key 时才使用项目的同源代理。
 */
export async function assessAzurePronunciation(
  samples: Float32Array,
  expected: string,
  signal?: AbortSignal,
): Promise<AzurePronunciationResult> {
  if (samples.length === 0) throw new Error('No speech samples')
  const directUrl = directAzureUrl()
  const response = await fetch(directUrl ?? AZURE_PROXY_PATH, {
    method: 'POST',
    headers: {
      'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
      Accept: 'application/json',
      ...(directUrl
        ? { 'Ocp-Apim-Subscription-Key': directKey!, 'Pronunciation-Assessment': assessmentHeader(expected) }
        : { 'X-Pronunciation-Reference': expected }),
    },
    body: pcmToWav(samples, 16000),
    signal,
  })
  if (!response.ok) throw new Error(`Azure pronunciation proxy returned ${response.status}`)
  const payload = await response.json() as {
    RecognitionStatus?: string
    NBest?: Array<{
      Display?: string
      Lexical?: string
      PronunciationAssessment?: { AccuracyScore?: number; FluencyScore?: number; CompletenessScore?: number; PronScore?: number }
      Words?: Array<{
        Word?: string
        PronunciationAssessment?: { AccuracyScore?: number; ErrorType?: string }
        Phonemes?: Array<{ Phoneme?: string; PronunciationAssessment?: { AccuracyScore?: number } }>
      }>
    }>
  }
  const best = payload.NBest?.[0]
  const words = best?.Words ?? []
  const recognizedText = best?.Display ?? best?.Lexical ?? ''
  const target = expected.trim().toLowerCase()
  const targetWord = words.find((item) => normalizedTokens(item.Word ?? '').includes(target))
  const recognized = targetWord !== undefined || normalizedTokens(recognizedText).includes(target)
  const overall = best?.PronunciationAssessment
  const wordAssessment = targetWord?.PronunciationAssessment
  const phonemes = (targetWord?.Phonemes ?? []).map((item) => ({
    phoneme: item.Phoneme ?? '',
    accuracyScore: number(item.PronunciationAssessment?.AccuracyScore),
  })).filter((item) => item.phoneme)
  return {
    recognizedText,
    recognized,
    // 45 分作为很宽松的首版下限；低于这个值仍留给 Vosk 再确认，避免把
    // 轻微口音直接判错。最终阈值要用真实儿童样本继续校准。
    matched: recognized && (number(wordAssessment?.AccuracyScore) ?? number(overall?.AccuracyScore) ?? 0) >= 45,
    accuracyScore: number(wordAssessment?.AccuracyScore) ?? number(overall?.AccuracyScore),
    fluencyScore: number(overall?.FluencyScore),
    completenessScore: number(overall?.CompletenessScore),
    pronunciationScore: number(overall?.PronScore),
    phonemes,
  }
}

export function concatPcm(chunks: Float32Array[], length: number): Float32Array {
  const output = new Float32Array(length)
  let offset = 0
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length }
  return output
}
