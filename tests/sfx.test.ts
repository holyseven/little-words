import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

/**
 * 音效是 Web Audio 合成的，node 里没有 AudioContext，所以这里用最小假实现
 * 验证「每个音效都真的建了振荡器/噪声节点、增益不超上限、包络有软起音软释音」。
 * 目的不是听感，而是防止参数写错导致爆音或静默。
 */

const MAX_GAIN = 0.4

interface Ramp {
  value: number
  time: number
}

class FakeParam {
  ramps: Ramp[] = []
  value = 0
  setValueAtTime(v: number, t: number) {
    this.ramps.push({ value: v, time: t })
    return this
  }
  exponentialRampToValueAtTime(v: number, t: number) {
    this.ramps.push({ value: v, time: t })
    return this
  }
  linearRampToValueAtTime(v: number, t: number) {
    this.ramps.push({ value: v, time: t })
    return this
  }
}

class FakeNode {
  connect(next: unknown) {
    return next
  }
  disconnect() {}
}

class FakeOsc extends FakeNode {
  type = 'sine'
  frequency = new FakeParam()
  started: number | null = null
  stopped: number | null = null
  start(t = 0) {
    this.started = t
  }
  stop(t = 0) {
    this.stopped = t
  }
}

class FakeGain extends FakeNode {
  gain = new FakeParam()
}

class FakeBufferSource extends FakeNode {
  buffer: unknown = null
  started: number | null = null
  stopped: number | null = null
  start(t = 0) {
    this.started = t
  }
  stop(t = 0) {
    this.stopped = t
  }
}

class FakeFilter extends FakeNode {
  type = 'bandpass'
  frequency = { value: 0 }
  Q = { value: 0 }
}

class FakeCtx {
  state = 'running'
  currentTime = 0
  sampleRate = 48000
  oscillators: FakeOsc[] = []
  gains: FakeGain[] = []
  sources: FakeBufferSource[] = []
  filters: FakeFilter[] = []

  createOscillator() {
    const o = new FakeOsc()
    this.oscillators.push(o)
    return o
  }
  createGain() {
    const g = new FakeGain()
    this.gains.push(g)
    return g
  }
  createBufferSource() {
    const s = new FakeBufferSource()
    this.sources.push(s)
    return s
  }
  createBiquadFilter() {
    const f = new FakeFilter()
    this.filters.push(f)
    return f
  }
  createBuffer(_ch: number, len: number) {
    return { getChannelData: () => new Float32Array(len), length: len }
  }
  resume() {
    return Promise.resolve()
  }
  get destination() {
    return new FakeNode()
  }
}

let ctx: FakeCtx

vi.mock('../src/audio/audioUnlock', () => ({
  getAudioContext: () => ctx,
  isAudioUnlocked: () => true,
}))

const ALL_NAMES = ['tap', 'correct', 'wrong', 'celebrate', 'pop', 'flip', 'sticker'] as const

beforeEach(() => {
  ctx = new FakeCtx()
  vi.resetModules()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('合成音效（SPEC 10.4）', () => {
  it('SPEC 表格里的 7 个音效都有实现', async () => {
    const sfx = await import('../src/audio/sfx')
    for (const name of ALL_NAMES) {
      expect(() => sfx.playSfx(name), `${name} 播放报错`).not.toThrow()
    }
  })

  it('每个音效都产生了发声节点', async () => {
    const sfx = await import('../src/audio/sfx')
    for (const name of ALL_NAMES) {
      ctx = new FakeCtx()
      sfx.playSfx(name)
      const nodes = ctx.oscillators.length + ctx.sources.length
      expect(nodes, `${name} 没有产生任何发声节点`).toBeGreaterThan(0)
    }
  })

  it('所有增益不超过主增益上限 0.4', async () => {
    const sfx = await import('../src/audio/sfx')
    for (const name of ALL_NAMES) {
      ctx = new FakeCtx()
      sfx.playSfx(name)
      for (const g of ctx.gains) {
        for (const r of g.gain.ramps) {
          expect(r.value, `${name} 增益 ${r.value} 超过 ${MAX_GAIN}`).toBeLessThanOrEqual(MAX_GAIN)
        }
      }
    }
  })

  it('包络有软起音与软释音（不爆音）', async () => {
    const sfx = await import('../src/audio/sfx')
    for (const name of ALL_NAMES) {
      ctx = new FakeCtx()
      sfx.playSfx(name)
      for (const g of ctx.gains) {
        const ramps = g.gain.ramps
        if (ramps.length === 0) continue
        // 起点接近 0（不是从峰值硬切入）
        expect(ramps[0]!.value, `${name} 起音不是从静音开始`).toBeLessThan(0.01)
        // 终点回到接近 0（不是硬切断）
        expect(ramps[ramps.length - 1]!.value, `${name} 释音不是回到静音`).toBeLessThan(0.01)
      }
    }
  })

  it('每个振荡器都调用了 start 和 stop（不会泄漏）', async () => {
    const sfx = await import('../src/audio/sfx')
    for (const name of ALL_NAMES) {
      ctx = new FakeCtx()
      sfx.playSfx(name)
      for (const o of ctx.oscillators) {
        expect(o.started, `${name} 振荡器未 start`).not.toBeNull()
        expect(o.stopped, `${name} 振荡器未 stop`).not.toBeNull()
        expect(o.stopped!).toBeGreaterThan(o.started!)
      }
      for (const s of ctx.sources) {
        expect(s.started, `${name} 噪声源未 start`).not.toBeNull()
        expect(s.stopped, `${name} 噪声源未 stop`).not.toBeNull()
      }
    }
  })

  it('wrong 是最轻柔的音效（SPEC 4.2 零挫败）', async () => {
    const sfx = await import('../src/audio/sfx')

    const peakOf = (name: (typeof ALL_NAMES)[number]) => {
      ctx = new FakeCtx()
      sfx.playSfx(name)
      return Math.max(...ctx.gains.flatMap((g) => g.gain.ramps.map((r) => r.value)))
    }

    const wrong = peakOf('wrong')
    expect(wrong).toBeLessThanOrEqual(0.2)
    expect(wrong).toBeLessThan(peakOf('correct'))
    expect(wrong).toBeLessThan(peakOf('celebrate'))
  })

  it('wrong 是下滑音，correct 是上行琶音', async () => {
    const sfx = await import('../src/audio/sfx')

    ctx = new FakeCtx()
    sfx.playSfx('wrong')
    const wrongFreqs = ctx.oscillators[0]!.frequency.ramps.map((r) => r.value)
    expect(wrongFreqs.length).toBeGreaterThanOrEqual(2)
    expect(wrongFreqs[wrongFreqs.length - 1]!).toBeLessThan(wrongFreqs[0]!)

    ctx = new FakeCtx()
    sfx.playSfx('correct')
    const starts = ctx.oscillators.map((o) => o.frequency.ramps[0]!.value)
    expect(starts.length).toBe(3) // C5 E5 G5
    expect(starts[1]!).toBeGreaterThan(starts[0]!)
    expect(starts[2]!).toBeGreaterThan(starts[1]!)
  })

  it('关闭音效后不再发声', async () => {
    const sfx = await import('../src/audio/sfx')
    sfx.setSfxEnabled(false)
    ctx = new FakeCtx()
    for (const name of ALL_NAMES) sfx.playSfx(name)
    expect(ctx.oscillators.length + ctx.sources.length).toBe(0)
    sfx.setSfxEnabled(true)
  })

  it('音频未解锁时不发声（避免 iOS 静默失败）', async () => {
    vi.doMock('../src/audio/audioUnlock', () => ({
      getAudioContext: () => ctx,
      isAudioUnlocked: () => false,
    }))
    vi.resetModules()
    const sfx = await import('../src/audio/sfx')
    ctx = new FakeCtx()
    for (const name of ALL_NAMES) sfx.playSfx(name)
    expect(ctx.oscillators.length + ctx.sources.length).toBe(0)
    vi.doUnmock('../src/audio/audioUnlock')
  })
})
