import { preparePlaybackSession } from './session'

/** Prevent an audio-route transition from starting a lesson already cancelled. */
export function createMediaPlayback() {
  let generation = 0
  let pending = false
  const cancel = () => { generation++; pending = false }
  return {
    cancel,
    async play(media: Pick<HTMLMediaElement, 'play'>, allowed: () => boolean): Promise<void> {
      if (pending) { cancel(); return }
      const request = ++generation
      pending = true
      try {
        await preparePlaybackSession()
        if (request !== generation || !allowed()) return
        await media.play()
      } catch (error) {
        if (request === generation) throw error
      } finally {
        if (request === generation) pending = false
      }
    },
  }
}
