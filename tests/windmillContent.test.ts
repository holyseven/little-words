import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { windmillChapters, windmillQuestions } from '../src/content/windmill'
import manifest from '../src/content/windmillAudio.json'

const chapterIds = ['air', 'blades', 'axis', 'slowdown', 'energy']
const languages = ['zh', 'en'] as const
const audioDir = join(process.cwd(), 'public', 'audio')
type Clip = (typeof manifest.clips)['air-zh']
const clips = manifest.clips as Record<string, Clip>

function expectBilingual(zh: string, en: string) {
  expect(zh.trim()).toMatch(/\p{Script=Han}/u)
  expect(en.trim()).toMatch(/[a-zA-Z]/)
  expect(en).not.toMatch(/\p{Script=Han}/u)
  expect(zh).not.toBe(en)
}

/** Inspect real MP4 media headers without requiring macOS audio tools in CI. */
function mediaDurationMs(file: Buffer): number {
  function box(type: string, start: number, end: number): { start: number; end: number } {
    for (let offset = start; offset + 8 <= end;) {
      const size = file.readUInt32BE(offset)
      if (size < 8 || offset + size > end) throw new Error(`Invalid MP4 box at ${offset}`)
      if (file.toString('ascii', offset + 4, offset + 8) === type) {
        return { start: offset + 8, end: offset + size }
      }
      offset += size
    }
    throw new Error(`Missing MP4 ${type} box`)
  }
  let parent = { start: 0, end: file.length }
  for (const type of ['moov', 'trak', 'mdia', 'mdhd']) parent = box(type, parent.start, parent.end)
  const version = file[parent.start]
  if (version === 0) {
    const timescale = file.readUInt32BE(parent.start + 12)
    return file.readUInt32BE(parent.start + 16) / timescale * 1000
  }
  if (version === 1) {
    const timescale = file.readUInt32BE(parent.start + 20)
    return Number(file.readBigUInt64BE(parent.start + 24)) / timescale * 1000
  }
  throw new Error(`Unknown MP4 media header version ${version}`)
}

describe('风为什么能吹动纸风车：双语内容与离线旁白', () => {
  it('五章按空气、叶片、转轴、减速和能量传递的顺序完整且编号唯一', () => {
    expect(windmillChapters.map((chapter) => chapter.id)).toEqual(chapterIds)
    expect(new Set(windmillChapters.map((chapter) => chapter.id)).size).toBe(5)
    for (const chapter of windmillChapters) {
      expectBilingual(chapter.titleZh, chapter.titleEn)
      expectBilingual(chapter.zh, chapter.en)
      expect(chapter.durationMs).toBeGreaterThanOrEqual(8000)
      expect(chapter.durationMs).toBeLessThanOrEqual(20000)
    }
  })

  it('每章中英文字幕都有且只有一段对应的完整旁白，实际文案和生成哈希一致', () => {
    expect(Object.keys(clips).sort()).toEqual(chapterIds.flatMap((id) => languages.map((language) => `${id}-${language}`)).sort())
    for (const chapter of windmillChapters) {
      for (const language of languages) {
        const id = `${chapter.id}-${language}`
        const clip = clips[id]
        const profile = manifest.voices[language]
        expect(clip.text, id).toBe(chapter[language])
        expect(clip.src, id).toBe(`/audio/windmill-${id}.m4a`)
        expect(clip.voice, id).toBe(profile.voice)
        expect(clip.provider, id).toBe(profile.provider)
        expect(clip.model, id).toBe(profile.model)
        expect(clip.language, id).toBe(profile.language)
        expect(clip.speed, id).toBe(profile.speed)
        const hash = createHash('sha256').update(JSON.stringify({
          text: chapter[language], ...profile, sampleRate: manifest.sampleRate,
          aacBitrate: manifest.aacBitrate, renderVersion: manifest.version,
        })).digest('hex').slice(0, 16)
        expect(clip.hash, `${id} 文案或声线改变后必须重新配音`).toBe(hash)
      }
    }
  })

  it('中英文使用对应语言的本地神经声线，并保留自然断句和完整生成参数', () => {
    expect(manifest.version).toBe(2)
    expect(manifest.sampleRate).toBe(24000)
    expect(manifest.aacBitrate).toBe(64000)
    expect(manifest.voices.zh.voice).toMatch(/^z[fm]_\d+$/)
    expect(manifest.voices.en.voice).toMatch(/^a[fm]_[a-z0-9_]+$/)
    expect(manifest.voices.zh.language).toBe('cmn')
    expect(manifest.voices.en.language).toBe('en-us')
    expect(manifest.voices.zh.voice).not.toBe(manifest.voices.en.voice)
    for (const profile of Object.values(manifest.voices)) {
      expect(profile.provider).toBe('kokoro-onnx')
      expect(profile.model).toBe('kokoro-v1.1-zh.fp16')
      expect(profile.speed).toBeGreaterThanOrEqual(0.6)
      expect(profile.speed).toBeLessThanOrEqual(1.2)
      expect(profile).not.toHaveProperty('sentencePauseMs')
    }
    for (const clip of Object.values(clips)) expect(clip).not.toHaveProperty('sentencePauseMs')
  })

  it('十个旁白文件实际存在且非空，MP4内的真实时长与清单相符并留足章节阅读时间', () => {
    const expectedFiles = Object.values(clips).map((clip) => clip.src.split('/').pop()).sort()
    const actualFiles = readdirSync(audioDir).filter((name) => name.startsWith('windmill-') && name.endsWith('.m4a')).sort()
    expect(actualFiles).toEqual(expectedFiles)
    for (const chapter of windmillChapters) {
      for (const language of languages) {
        const id = `${chapter.id}-${language}`
        const clip = clips[id]
        const path = join(audioDir, `windmill-${id}.m4a`)
        expect(statSync(path).size, id).toBeGreaterThan(10000)
        const file = readFileSync(path)
        expect(file.toString('ascii', 4, 8), id).toBe('ftyp')
        const actualDuration = mediaDurationMs(file)
        expect(actualDuration, id).toBeGreaterThan(3000)
        expect(actualDuration, id).toBeLessThanOrEqual(chapter.durationMs - 500)
        // AAC includes a short encoder priming/remainder around valid speech.
        expect(Math.abs(actualDuration - clip.durationMs), id).toBeLessThan(100)
        expect(chapter.durationMs - actualDuration, `${id} 需给儿童留出阅读时间`).toBeGreaterThanOrEqual(500)
      }
    }
  })

  it('三道题的问题、选项和解释都有中英双语，每题恰有一个有效且唯一的正确答案', () => {
    expect(windmillQuestions).toHaveLength(3)
    expect(new Set(windmillQuestions.map((question) => question.id)).size).toBe(3)
    expect(windmillQuestions.map((question) => question.correctId)).toEqual(['moving-air', 'turning-push', 'slower'])
    for (const question of windmillQuestions) {
      expectBilingual(question.zh, question.en)
      expectBilingual(question.explanationZh, question.explanationEn)
      expect(question.options).toHaveLength(3)
      expect(new Set(question.options.map((option) => option.id)).size).toBe(3)
      expect(new Set(question.options.map((option) => option.zh)).size).toBe(3)
      expect(new Set(question.options.map((option) => option.en)).size).toBe(3)
      expect(question.options.filter((option) => option.id === question.correctId)).toHaveLength(1)
      for (const option of question.options) expectBilingual(option.zh, option.en)
    }
  })
})
