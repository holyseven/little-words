type RateMedia = Pick<HTMLMediaElement, 'playbackRate'> & {
  preservesPitch?: boolean
  webkitPreservesPitch?: boolean
  mozPreservesPitch?: boolean
}

/** Keep the recorded voice's pitch when slowing audio or video, including older Safari. */
export function applyMediaRate(media: RateMedia, rate: number): void {
  if ('preservesPitch' in media) media.preservesPitch = true
  if ('webkitPreservesPitch' in media) media.webkitPreservesPitch = true
  if ('mozPreservesPitch' in media) media.mozPreservesPitch = true
  media.playbackRate = rate
}
