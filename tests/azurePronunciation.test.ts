import { afterEach, describe, expect, it, vi } from 'vitest'
import { assessAzurePronunciation, parseAzurePronunciation } from '../src/logic/azurePronunciation'

// Captured Azure REST response for the app's cat audio. Scores in REST responses
// are flat fields, unlike the nested PronunciationAssessment fields in SDK JSON.
const catRestResponse = {
  RecognitionStatus: 'Success',
  Offset: 400000,
  Duration: 2200000,
  DisplayText: 'Cat.',
  SNR: 15.535186,
  NBest: [{
    Confidence: 0.8731458,
    Lexical: 'cat',
    ITN: 'cat',
    MaskedITN: 'cat',
    Display: 'Cat.',
    AccuracyScore: 68,
    FluencyScore: 100,
    CompletenessScore: 100,
    PronScore: 80.8,
    Words: [{
      Word: 'cat',
      Offset: 400000,
      Duration: 2200000,
      Confidence: 0,
      AccuracyScore: 68,
      ErrorType: 'None',
      Syllables: [{
        Syllable: 'kaet', Grapheme: 'cat', Offset: 400000, Duration: 2200000, AccuracyScore: 58,
      }],
      Phonemes: [
        { Phoneme: 'k', Offset: 400000, Duration: 700000, AccuracyScore: 90 },
        { Phoneme: 'ae', Offset: 1200000, Duration: 1100000, AccuracyScore: 52 },
        { Phoneme: 't', Offset: 2400000, Duration: 200000, AccuracyScore: 0 },
      ],
    }],
  }],
}

function flatResponse(words: Array<{ Word: string; AccuracyScore?: unknown; ErrorType?: string }>, display = words.map((word) => word.Word).join(' ')) {
  return {
    RecognitionStatus: 'Success',
    NBest: [{ Display: display, Lexical: display, AccuracyScore: 100, Words: words }],
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Azure pronunciation response parsing', () => {
  it('reads the actual REST response, including word and phoneme scores of zero', () => {
    expect(parseAzurePronunciation(catRestResponse, 'cat')).toMatchObject({
      recognizedText: 'Cat.',
      recognized: true,
      matched: true,
      accuracyScore: 68,
      fluencyScore: 100,
      completenessScore: 100,
      pronunciationScore: 80.8,
      phonemes: [
        { phoneme: 'k', accuracyScore: 90 },
        { phoneme: 'ae', accuracyScore: 52 },
        { phoneme: 't', accuracyScore: 0 },
      ],
    })
  })

  it('continues to support nested SDK assessment scores and SDK success status 0', () => {
    const result = parseAzurePronunciation({
      RecognitionStatus: 0,
      NBest: [{
        Display: 'Cat.',
        PronunciationAssessment: { AccuracyScore: 100, FluencyScore: 98, CompletenessScore: 100, PronScore: 99 },
        Words: [{
          Word: 'cat',
          PronunciationAssessment: { AccuracyScore: 100, ErrorType: 'None' },
          Phonemes: [{ Phoneme: 'k', PronunciationAssessment: { AccuracyScore: 100 } }],
        }],
      }],
    }, 'cat')
    expect(result).toMatchObject({
      recognized: true, matched: true, accuracyScore: 100, fluencyScore: 98,
      completenessScore: 100, pronunciationScore: 99,
      phonemes: [{ phoneme: 'k', accuracyScore: 100 }],
    })
  })

  it.each(['Omission', 'Insertion'])('does not count an aligned target marked %s as spoken', (errorType) => {
    const result = parseAzurePronunciation(flatResponse([
      { Word: 'cat', AccuracyScore: 100, ErrorType: errorType },
    ], '.'), 'cat')
    expect(result.recognized).toBe(false)
    expect(result.matched).toBe(false)
  })

  it.each([
    ['absent', undefined], ['NaN', NaN], ['Infinity', Infinity],
    ['negative Infinity', -Infinity], ['negative', -1], ['over 100', 101], ['string', '100'],
  ])('rejects a %s target score despite a high overall score', (_label, score) => {
    const result = parseAzurePronunciation(flatResponse([
      { Word: 'cat', AccuracyScore: score, ErrorType: 'None' },
    ]), 'cat')
    expect(result.matched).toBe(false)
    expect(result.accuracyScore).toBeUndefined()
  })

  it.each([0, 45, 59.9])('does not pass a valid but low target score of %s', (score) => {
    const result = parseAzurePronunciation(flatResponse([
      { Word: 'cat', AccuracyScore: score, ErrorType: 'Mispronunciation' },
    ]), 'cat')
    expect(result.accuracyScore).toBe(score)
    expect(result.matched).toBe(false)
  })

  it.each([60, 100])('accepts the inclusive valid passing score of %s', (score) => {
    const result = parseAzurePronunciation(flatResponse([
      { Word: 'cat', AccuracyScore: score, ErrorType: 'None' },
    ]), ' CAT! ')
    expect(result.matched).toBe(true)
  })

  it.each(['NoMatch', 'InitialSilenceTimeout', 'Error', 1, undefined])('rejects unsuccessful or missing recognition status %s', (status) => {
    const payload = { ...flatResponse([{ Word: 'cat', AccuracyScore: 100 }]), RecognitionStatus: status }
    const result = parseAzurePronunciation(payload, 'cat')
    expect(result.recognized).toBe(false)
    expect(result.matched).toBe(false)
  })

  it('does not borrow a different word score even if the display text contains the target', () => {
    const result = parseAzurePronunciation(flatResponse([
      { Word: 'cat', ErrorType: 'None' },
      { Word: 'dog', AccuracyScore: 100, ErrorType: 'None' },
    ], 'Cat dog.'), 'cat')
    expect(result.matched).toBe(false)
    expect(result.accuracyScore).toBeUndefined()
  })

  it('does not accept an overall score in place of missing word details', () => {
    const result = parseAzurePronunciation(flatResponse([], 'Cat.'), 'cat')
    expect(result.matched).toBe(false)
    expect(result.accuracyScore).toBeUndefined()
  })

  it('accepts a complete ordered multiword target with scores for every word', () => {
    const result = parseAzurePronunciation(flatResponse([
      { Word: 'ice', AccuracyScore: 90, ErrorType: 'None' },
      { Word: 'cream', AccuracyScore: 90, ErrorType: 'None' },
    ], 'Ice cream.'), 'ice cream')
    expect(result).toMatchObject({ recognized: true, matched: true, accuracyScore: 90 })
  })

  it.each([
    [{ Word: 'ice', AccuracyScore: 100 }],
    [{ Word: 'cream', AccuracyScore: 100 }, { Word: 'ice', AccuracyScore: 100 }],
    [{ Word: 'ice', AccuracyScore: 100 }, { Word: 'cream' }],
    [{ Word: 'ice', AccuracyScore: 100 }, { Word: 'cream', AccuracyScore: 100, ErrorType: 'Omission' }],
  ])('rejects partial, reversed, unscored or omitted multiword targets: %j', (...words) => {
    expect(parseAzurePronunciation(flatResponse(words), 'ice cream').matched).toBe(false)
  })
})

describe('Azure pronunciation request', () => {
  it('uses REST scores in the actual assessment request path', async () => {
    const payload = flatResponse([{ Word: 'cat', AccuracyScore: 100, ErrorType: 'None' }], 'Cat.')
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => payload })
    vi.stubGlobal('fetch', fetchMock)

    const result = await assessAzurePronunciation(new Float32Array([0.2, -0.2, 0]), 'cat')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({ recognized: true, matched: true, accuracyScore: 100 })
  })
})
