/** Normalize case and punctuation while retaining real lexical word boundaries. */
export function speechWords(value: string): string[] {
  return value.trim().toLowerCase().replace(/[^a-z']+/g, ' ').trim().split(' ').filter(Boolean)
}

/** Keep spelling equivalence narrow: the textbook's schoolbag may be decoded
 * as school bag. Other compound words are not joined or split automatically. */
export function normalizedSpeechTokens(value: string): string[] {
  return speechWords(value)
    .flatMap((token) => token === 'schoolbag' ? ['school', 'bag'] : [token])
}

export interface SpeechMatchRange {
  start: number
  /** Exclusive end in the original recognition word array. */
  end: number
}

/** Match consecutive complete word entries, retaining their score ownership.
 * In particular, `bag` cannot borrow the second half of a `schoolbag` entry. */
export function speechMatchRanges(words: readonly string[] | string, expected: string): SpeechMatchRange[] {
  const target = normalizedSpeechTokens(expected)
  if (!target.length) return []
  const parts = (typeof words === 'string' ? speechWords(words) : words).map(normalizedSpeechTokens)
  const matches: SpeechMatchRange[] = []

  for (let start = 0; start < parts.length; start += 1) {
    let offset = 0
    for (let end = start; end < parts.length; end += 1) {
      const tokens = parts[end]!
      if (!tokens.length || offset + tokens.length > target.length
        || tokens.some((token, index) => token !== target[offset + index])) break
      offset += tokens.length
      if (offset === target.length) {
        matches.push({ start, end: end + 1 })
        break
      }
    }
  }
  return matches
}

/** The small Vosk model knows school and bag separately. Use that spelling
 * in both live capture and the online-service fallback grammar. */
export function voskVocabulary(expected: string, candidates: readonly string[] = []): string[] {
  const phrases = [expected, ...candidates].map((word) => normalizedSpeechTokens(word).join(' ')).filter(Boolean)
  return [...new Set([...phrases, '[unk]'])]
}
