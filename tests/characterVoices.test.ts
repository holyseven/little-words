import { createHash } from 'node:crypto'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { characterClipId } from '../src/audio/characterVoices'
import { dialogueScenes } from '../src/content/dialogues'
import storyScripts from '../src/content/storyScripts.json'
import manifest from '../src/content/audioManifest.json'
import { characterVoices, type CharacterId } from '../src/content/voiceCast'

interface CharacterClipMeta {
  hash: string
  text: string
  durationMs: number
  voice?: string
}

const clips = manifest.clips as Record<string, CharacterClipMeta>
const audioDir = join(process.cwd(), 'public', 'audio')
const characterLines: { speaker: CharacterId; text: string }[] = dialogueScenes.flatMap((scene) => scene.turns.flatMap((turn) => [
  { speaker: 'momo' as const, text: turn.prompt.en },
  { speaker: 'child' as const, text: turn.answer.en },
  { speaker: 'momo' as const, text: turn.reply.en },
]))
characterLines.push(...storyScripts.flatMap((story) => story.lines.map((line) => ({
  speaker: line.speaker as CharacterId,
  text: line.en,
}))))

function characterAudioFiles(dir: string, prefix = 'v'): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const key = `${prefix}/${entry.name}`
    return entry.isDirectory() ? characterAudioFiles(join(dir, entry.name), key) : [key]
  })
}

describe('固定角色的离线配音', () => {
  it('小朋友采用固定男声，Momo 采用不同女声，声线独立于通用发音', () => {
    expect(characterVoices.child.gender).toBe('male')
    expect(characterVoices.momo.gender).toBe('female')
    expect(characterVoices.child.voice).toBe('Evan (Enhanced)')
    expect(characterVoices.momo.voice).toBe('Ava (Premium)')
    expect(characterVoices.momo.voice).not.toBe(characterVoices.child.voice)
    for (const profile of Object.values(characterVoices)) {
      expect(profile.rate).toBeGreaterThan(0)
      expect(profile.voice).toMatch(/\((Premium|Enhanced)\)/)
    }
  })

  it('同一句话由两个角色说时拥有不同的文件、真实声线和内容哈希', () => {
    const momo = characterClipId('momo', 'Hello!')
    const child = characterClipId('child', 'Hello!')
    expect(momo).toBe('v/momo/hello')
    expect(child).toBe('v/child/hello')
    expect(clips[momo].text).toBe(clips[child].text)
    expect(clips[momo].voice).not.toBe(clips[child].voice)
    expect(clips[momo].hash).not.toBe(clips[child].hash)
  })

  it('六个对话场景与原创动画的每一句均有对应角色的完整离线配音', () => {
    expect(dialogueScenes).toHaveLength(6)
    for (const { speaker, text } of characterLines) {
      const key = characterClipId(speaker, text)
      const meta = clips[key]
      expect(meta, `缺少角色配音 ${key}`).toBeDefined()
      expect(meta.text).toBe(text)
      expect(meta.voice).toBe(characterVoices[speaker].voice)
      const file = join(audioDir, `${key}.m4a`)
      expect(existsSync(file), `缺少角色音频文件 ${key}`).toBe(true)
      expect(statSync(file).size).toBeGreaterThan(500)
    }
  })

  it('缓存哈希包含实际角色声线、语速和文本，变更角色后不会复用旧声音', () => {
    for (const [key, meta] of Object.entries(clips)) {
      if (!key.startsWith('v/')) continue
      const speaker = key.split('/')[1] as CharacterId
      const profile = characterVoices[speaker]
      expect(profile, `未知的配音角色 ${key}`).toBeDefined()
      expect(meta.voice).toBe(profile.voice)
      const expectedHash = createHash('sha256')
        .update(`${profile.voice}|${profile.rate}|${meta.text}`)
        .digest('hex').slice(0, 12)
      expect(meta.hash, `${key} 未按实际声线生成`).toBe(expectedHash)
    }
  })

  it('角色配音按角色和文本去重，清单及磁盘上没有孤儿文件', () => {
    const expected = [...new Set(characterLines.map(({ speaker, text }) => characterClipId(speaker, text)))].sort()
    const actual = Object.keys(clips).filter((key) => key.startsWith('v/')).sort()
    expect(actual).toEqual(expected)
    expect(characterAudioFiles(join(audioDir, 'v')).sort()).toEqual(expected.map((key) => `${key}.m4a`).sort())
  })
})
