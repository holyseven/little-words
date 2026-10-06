/**
 * Safari changes its system audio category when microphone capture starts.
 * Own that category for the full getUserMedia/track lifetime, then request the
 * normal playback category before speaking again. This is best effort: older
 * browsers expose no Audio Session API, and the API reports no route-ready
 * event. It must not replace or close the gesture-unlocked playback context.
 */

type SessionType = 'playback' | 'play-and-record'
interface BrowserAudioSession { type: string }
const leaseBrand: unique symbol = Symbol('microphone audio session')

export interface MicrophoneSessionLease {
  readonly [leaseBrand]: true
}

interface LeaseState {
  requestSettled: boolean
  ended: boolean
  releasing: Promise<void> | null
}

const leases = new Set<MicrophoneSessionLease>()
const states = new WeakMap<MicrophoneSessionLease, LeaseState>()
let playbackTurn: Promise<void> | null = null

function setSessionType(type: SessionType): boolean {
  try {
    if (typeof navigator === 'undefined') return false
    const audioSession = (navigator as Navigator & { audioSession?: BrowserAudioSession }).audioSession
    if (!audioSession || audioSession.type === type) return false
    audioSession.type = type
    return audioSession.type === type
  } catch {
    // A missing/partial implementation must never prevent playback or capture.
    return false
  }
}

/**
 * Call immediately before getUserMedia, after any model loading has finished.
 * The lease also covers an outstanding permission request: cancelling a UI
 * cannot cancel getUserMedia, which may deliver a live stream later.
 */
export function beginMicrophoneSession(): MicrophoneSessionLease {
  const lease: MicrophoneSessionLease = { [leaseBrand]: true }
  leases.add(lease)
  states.set(lease, { requestSettled: false, ended: false, releasing: null })
  setSessionType('play-and-record')
  return lease
}

function releaseIfFinished(lease: MicrophoneSessionLease, state: LeaseState): void {
  if (!state.ended || !state.requestSettled || !leases.delete(lease)) return
  if (leases.size === 0) void preparePlaybackSession()
}

/**
 * Mark getUserMedia resolved/rejected. If it resolved after cancellation, stop
 * the returned tracks before calling this; they still hold the input category.
 */
export function settleMicrophoneRequest(lease: MicrophoneSessionLease): void {
  const state = states.get(lease)
  if (!state || state.requestSettled) return
  state.requestSettled = true
  releaseIfFinished(lease, state)
}

/**
 * Tracks have stopped but their capture context may still be closing. Playback
 * callers can wait for that close without changing every cancel() call into an
 * async API. The caller still ends the lease when cleanup finishes. A rejected
 * close must not make normal playback reject or leave this wait permanently.
 */
export function markMicrophoneReleasing(lease: MicrophoneSessionLease, cleanup: Promise<unknown>): void {
  const state = states.get(lease)
  if (!state || state.ended || !leases.has(lease)) return
  const releasing = cleanup.catch(() => undefined).then(() => {
    if (state.releasing === releasing) state.releasing = null
  })
  state.releasing = releasing
}

/**
 * Call once the stream tracks and capture context have been released. Safe to
 * call on cancellation before permission resolves: restoration then waits for
 * settleMicrophoneRequest. An old lease never restores over a newer capture.
 */
export function endMicrophoneSession(lease: MicrophoneSessionLease): void {
  const state = states.get(lease)
  if (!state || state.ended) return
  state.ended = true
  // Drop this closing wait before release triggers another playback check.
  state.releasing = null
  releaseIfFinished(lease, state)
}

/**
 * Request the playback category synchronously (including in a user gesture).
 * Following a category change, yield one event-loop turn for the platform to
 * process the stopped capture before starting sound. Repeated playback calls
 * share that turn and do not flip categories. Active capture keeps its category.
 */
export function preparePlaybackSession(): Promise<void> {
  const releasing = [...leases]
    .map((lease) => states.get(lease)?.releasing)
    .filter((closing): closing is Promise<void> => Boolean(closing))
  if (releasing.length > 0) {
    // A new microphone may begin while an older context closes. Recheck leases
    // after the close, so that older cleanup cannot change the new category.
    return Promise.all(releasing).then(() => preparePlaybackSession())
  }
  if (leases.size > 0) return Promise.resolve()
  const changed = setSessionType('playback')
  if (playbackTurn) return playbackTurn
  if (!changed) return Promise.resolve()

  const turn = new Promise<void>((resolve) => {
    setTimeout(resolve, 0)
  })
  playbackTurn = turn
  void turn.then(() => {
    if (playbackTurn === turn) playbackTurn = null
  })
  return turn
}
