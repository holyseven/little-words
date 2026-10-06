import { endMicrophoneSession, markMicrophoneReleasing, type MicrophoneSessionLease } from './session'

export interface CaptureResources {
  audio: AudioContext | null
  stream: MediaStream | null
  source: MediaStreamAudioSourceNode | null
  processor: ScriptProcessorNode | null
  sink: GainNode | null
  frame: number | null
  timer: ReturnType<typeof setTimeout> | null
  microphoneLease: MicrophoneSessionLease | null
  captureCleanup: Promise<void> | null
}

/** Stop input immediately; retained PCM and recognition resources remain usable. */
export function stopMicrophoneCapture(capture: CaptureResources): Promise<void> {
  if (capture.captureCleanup) return capture.captureCleanup
  if (capture.frame !== null) cancelAnimationFrame(capture.frame)
  if (capture.timer !== null) clearTimeout(capture.timer)
  capture.frame = null
  capture.timer = null
  if (capture.processor) capture.processor.onaudioprocess = null
  for (const node of [capture.source, capture.processor, capture.sink]) {
    try { node?.disconnect() } catch { /* Continue releasing the other resources. */ }
  }
  capture.source = null
  capture.processor = null
  capture.sink = null
  for (const track of capture.stream?.getTracks() ?? []) {
    try { track.stop() } catch { /* A track may already have ended. */ }
  }
  capture.stream = null
  const audio = capture.audio
  const lease = capture.microphoneLease
  capture.audio = null
  capture.microphoneLease = null
  // Tracks stop synchronously. Await capture-context closure before restoring
  // playback, including when recognition completes very quickly offline.
  let closing: Promise<unknown> = Promise.resolve()
  try { if (audio && audio.state !== 'closed') closing = audio.close() } catch { /* already closed */ }
  const closed = closing.catch(() => undefined)
  if (lease) markMicrophoneReleasing(lease, closed)
  const cleanup = closed.then(() => {
    if (lease) endMicrophoneSession(lease)
  })
  capture.captureCleanup = cleanup
  return cleanup
}
