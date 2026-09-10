/**
 * WAV 读写与后处理（供 gen-audio.mjs 使用）
 *
 * `say` 输出的 WAV 有两个问题需要处理：
 *  1. 尾部有 27–50ms 静音 —— 不裁的话点击反馈会发木
 *  2. 各条峰值不一致（0.55–0.78）—— 不归一化的话音量忽大忽小
 *
 * 只处理 16-bit 单声道 PCM，这是 `say --data-format=LEI16@22050` 的输出格式。
 */

/** 解析 WAV，返回 Float32 采样（-1..1）与采样率 */
export function decodeWav(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('不是有效的 WAV 文件')
  }

  let off = 12
  let sampleRate = 0
  let channels = 0
  let bits = 0
  let dataOff = 0
  let dataLen = 0

  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4)
    const size = buf.readUInt32LE(off + 4)

    if (id === 'fmt ') {
      channels = buf.readUInt16LE(off + 10)
      sampleRate = buf.readUInt32LE(off + 12)
      bits = buf.readUInt16LE(off + 22)
    } else if (id === 'data') {
      dataOff = off + 8
      dataLen = Math.min(size, buf.length - dataOff)
      break
    }

    // chunk 按偶数字节对齐
    off += 8 + size + (size % 2)
  }

  if (!dataOff) throw new Error('WAV 缺少 data chunk')
  if (bits !== 16) throw new Error(`只支持 16-bit，实际 ${bits}-bit`)
  if (channels !== 1) throw new Error(`只支持单声道，实际 ${channels} 声道`)

  const n = Math.floor(dataLen / 2)
  const samples = new Float32Array(n)
  for (let i = 0; i < n; i++) samples[i] = buf.readInt16LE(dataOff + i * 2) / 32768

  return { samples, sampleRate }
}

/** 打包成 WAV Buffer */
export function encodeWav(samples, sampleRate) {
  const dataLen = samples.length * 2
  const buf = Buffer.alloc(44 + dataLen)

  buf.write('RIFF', 0, 'ascii')
  buf.writeUInt32LE(36 + dataLen, 4)
  buf.write('WAVE', 8, 'ascii')

  buf.write('fmt ', 12, 'ascii')
  buf.writeUInt32LE(16, 16) // fmt chunk 长度
  buf.writeUInt16LE(1, 20) // PCM
  buf.writeUInt16LE(1, 22) // 单声道
  buf.writeUInt32LE(sampleRate, 24)
  buf.writeUInt32LE(sampleRate * 2, 28) // byte rate
  buf.writeUInt16LE(2, 32) // block align
  buf.writeUInt16LE(16, 34) // bits

  buf.write('data', 36, 'ascii')
  buf.writeUInt32LE(dataLen, 40)

  for (let i = 0; i < samples.length; i++) {
    // 硬限幅后转 16-bit，避免归一化后的舍入溢出
    const v = Math.max(-1, Math.min(1, samples[i]))
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2)
  }

  return buf
}
