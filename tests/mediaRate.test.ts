import { describe, expect, it } from 'vitest'
import { applyMediaRate } from '../src/audio/mediaRate'

describe('pitch-preserving media speed', () => {
  it('enables standard pitch preservation before changing the speed', () => {
    const changes: string[] = []
    let pitch = false
    let rate = 1
    const media = {
      get preservesPitch() { return pitch },
      set preservesPitch(value: boolean) { pitch = value; changes.push(`pitch:${value}`) },
      get playbackRate() { return rate },
      set playbackRate(value: number) { rate = value; changes.push(`rate:${value}`) },
      currentTime: 12,
    }

    applyMediaRate(media, 0.7)

    expect(media.preservesPitch).toBe(true)
    expect(media.playbackRate).toBe(0.7)
    expect(changes).toEqual(['pitch:true', 'rate:0.7'])
    expect(media.currentTime).toBe(12)
  })

  it('enables older WebKit and Mozilla pitch properties when supported', () => {
    const media = { playbackRate: 1, webkitPreservesPitch: false, mozPreservesPitch: false }

    applyMediaRate(media, 0.85)

    expect(media).toEqual({ playbackRate: 0.85, webkitPreservesPitch: true, mozPreservesPitch: true })
    expect('preservesPitch' in media).toBe(false)
  })

  it('does not leave a prefixed property disabled when the standard property also exists', () => {
    const media = { playbackRate: 1, preservesPitch: false, webkitPreservesPitch: false }

    applyMediaRate(media, 0.7)
    applyMediaRate(media, 1)

    expect(media).toEqual({ playbackRate: 1, preservesPitch: true, webkitPreservesPitch: true })
  })

  it('still changes speed on media without a supported pitch property', () => {
    const media = { playbackRate: 1, currentTime: 8 }

    applyMediaRate(media, 0.7)

    expect(media).toEqual({ playbackRate: 0.7, currentTime: 8 })
  })
})
