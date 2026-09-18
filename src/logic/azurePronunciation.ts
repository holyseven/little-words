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

type JsonRecord = Record<string, unknown>

function record(value: unknown): JsonRecord | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : undefined
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function score(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100 ? value : undefined
}

function fieldScore(item: JsonRecord, field: string): number | undefined {
  const nested = record(item.PronunciationAssessment)
  return score(item[field]) ?? score(nested?.[field])
}

function recognitionSucceeded(payload: JsonRecord): boolean {
  return payload.RecognitionStatus === 'Success' || payload.RecognitionStatus === 0 || payload.RecognitionStatus === '0'
}

function hasPronunciationError(item: JsonRecord): boolean {
  const nested = record(item.PronunciationAssessment)
  const errorType = item.ErrorType ?? nested?.ErrorType
  if (typeof errorType !== 'string') return false
  const normalized = errorType.trim().toLowerCase()
  return normalized === 'omission' || normalized === 'insertion' || normalized === 'mispronunciation'
}

/**
 * Parse Azure's REST response. REST returns assessment values as flat fields
 * while some SDK-shaped responses put the same values under
 * `PronunciationAssessment`; accept both forms without borrowing an overall
 * score when the target word itself has no score.
 */
export function parseAzurePronunciation(payload: unknown, expected: string): AzurePronunciationResult {
  const root = record(payload)
  const best = record(list(root?.NBest)[0])
  const recognizedText = typeof best?.Display === 'string'
    ? best.Display
    : typeof best?.Lexical === 'string'
      ? best.Lexical
      : typeof root?.DisplayText === 'string' ? root.DisplayText : ''
  const expectedTokens = normalizedTokens(expected)
  const words = list(best?.Words).map(record).filter((item): item is JsonRecord => item !== undefined)
  const wordTokens = words.map((item) => normalizedTokens(typeof item.Word === 'string' ? item.Word : ''))
  let matchedWords: JsonRecord[] | undefined
  if (expectedTokens.length > 0) {
    for (let start = 0; start <= wordTokens.length - expectedTokens.length; start += 1) {
      const candidate = wordTokens.slice(start, start + expectedTokens.length)
      if (candidate.length === expectedTokens.length && candidate.every((tokens, index) => tokens.length === 1 && tokens[0] === expectedTokens[index])) {
        matchedWords = words.slice(start, start + expectedTokens.length)
        break
      }
    }
  }

  const statusOk = root !== undefined && recognitionSucceeded(root)
  const aligned = statusOk && matchedWords !== undefined
  const targetHasError = matchedWords?.some(hasPronunciationError) ?? false
  const recognized = aligned && !targetHasError
  const targetScores = matchedWords?.map((item) => fieldScore(item, 'AccuracyScore')) ?? []
  const accuracyScore = targetScores.length > 0 && targetScores.every((value): value is number => value !== undefined)
    ? Math.min(...targetScores)
    : undefined
  const overall = record(best?.PronunciationAssessment)
  const phonemes = (matchedWords ?? []).flatMap((word) => list(word.Phonemes).map(record).filter((item): item is JsonRecord => item !== undefined).map((item) => ({
    phoneme: typeof item.Phoneme === 'string' ? item.Phoneme : '',
    accuracyScore: fieldScore(item, 'AccuracyScore'),
  }))).filter((item) => item.phoneme)

  return {
    recognizedText,
    recognized,
    matched: recognized && accuracyScore !== undefined && accuracyScore >= 60,
    accuracyScore,
    fluencyScore: score(best?.FluencyScore) ?? score(overall?.FluencyScore),
    completenessScore: score(best?.CompletenessScore) ?? score(overall?.CompletenessScore),
    pronunciationScore: score(best?.PronScore) ?? score(overall?.PronScore),
    phonemes,
  }
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
  const payload = await response.json() as unknown
  return parseAzurePronunciation(payload, expected)
}

export function concatPcm(chunks: Float32Array[], length: number): Float32Array {
  const output = new Float32Array(length)
  let offset = 0
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length }
  return output
}
