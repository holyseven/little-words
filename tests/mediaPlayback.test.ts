import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMediaPlayback } from '../src/audio/mediaPlayback'
import { preparePlaybackSession } from '../src/audio/session'

vi.mock('../src/audio/session', () => ({ preparePlaybackSession: vi.fn() }))
let ready: () => void

beforeEach(() => {
  vi.mocked(preparePlaybackSession).mockReset().mockImplementation(() => new Promise<void>((resolve) => { ready = resolve }))
})

describe('课程播放等待音频通道恢复', () => {
  it('通道恢复完成后才播放', async () => {
    const playback = createMediaPlayback()
    const media = { play: vi.fn(async () => {}) }
    const playing = playback.play(media, () => true)
    expect(media.play).not.toHaveBeenCalled()
    ready()
    await playing
    expect(media.play).toHaveBeenCalledOnce()
  })

  it('导航、后台或取消不能让迟到的播放复活', async () => {
    const playback = createMediaPlayback()
    const media = { play: vi.fn(async () => {}) }
    const playing = playback.play(media, () => true)
    playback.cancel()
    ready()
    await playing
    expect(media.play).not.toHaveBeenCalled()
    const hidden = playback.play(media, () => false)
    ready()
    await hidden
    expect(media.play).not.toHaveBeenCalled()
  })

  it('等待期间再点播放会取消，新一轮可正常开始', async () => {
    const playback = createMediaPlayback()
    const media = { play: vi.fn(async () => {}) }
    const first = playback.play(media, () => true)
    const firstReady = ready
    await playback.play(media, () => true)
    const second = playback.play(media, () => true)
    firstReady()
    await first
    expect(media.play).not.toHaveBeenCalled()
    ready()
    await second
    expect(media.play).toHaveBeenCalledOnce()
  })
})
