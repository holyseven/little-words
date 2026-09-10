/**
 * 音频后处理：裁静音 + 归一化 + 淡入淡出。
 */

/**
 * 裁掉首尾静音，两端各留一点余量。
 *
 * 阈值取相对峰值的比例而非绝对值：不同单词的峰值差到 0.55–0.78，
 * 用绝对阈值会把轻辅音（f / s / th）的起音削掉。
 */
export function trimSilence(samples, sampleRate, { thresholdRatio = 0.02, padMs = 12 } = {}) {
  let peak = 0
  for (const s of samples) peak = Math.max(peak, Math.abs(s))
  if (peak === 0) return samples

  const thresh = peak * thresholdRatio

  let start = 0
  while (start < samples.length && Math.abs(samples[start]) < thresh) start++

  let end = samples.length - 1
  while (end > start && Math.abs(samples[end]) < thresh) end--

  // 留余量：起音不被切、收尾不突兀
  const pad = Math.round((padMs / 1000) * sampleRate)
  start = Math.max(0, start - pad)
  end = Math.min(samples.length - 1, end + pad)

  return samples.slice(start, end + 1)
}

/**
 * 峰值归一化到 target。
 * 语音片段之间音量要一致，否则孩子会觉得有的词"喊出来"、有的词"含着说"。
 * 留 headroom（0.89 ≈ -1dB）给后续 AAC 编码，避免编码溢出产生咔哒声。
 */
export function normalize(samples, target = 0.89) {
  let peak = 0
  for (const s of samples) peak = Math.max(peak, Math.abs(s))
  if (peak === 0) return samples

  const gain = target / peak
  const out = new Float32Array(samples.length)
  for (let i = 0; i < samples.length; i++) out[i] = samples[i] * gain
  return out
}

/**
 * 首尾加短淡入淡出，消除裁剪处的直流跳变（听起来是"啪"的一声）。
 * 8ms 足够消除爆音，又不会削掉塞音（p / t / k）的爆发。
 */
export function fade(samples, sampleRate, ms = 8) {
  const n = Math.min(Math.round((ms / 1000) * sampleRate), Math.floor(samples.length / 2))
  if (n <= 0) return samples

  const out = Float32Array.from(samples)
  for (let i = 0; i < n; i++) {
    // 余弦渐变比线性更听不出边界
    const w = 0.5 * (1 - Math.cos((Math.PI * i) / n))
    out[i] *= w
    out[out.length - 1 - i] *= w
  }
  return out
}
