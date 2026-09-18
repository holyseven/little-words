/**
 * 预生成人声音频（替代运行时 TTS 朗读单词/例句/角色台词）
 *
 * 为什么不用运行时 speechSynthesis：
 *  - iOS Safari 的 Web Speech API 只暴露预装的 compact 档语音，用户下载的
 *    Enhanced/Premium 语音拿不到（Apple 开发者论坛 thread/723503 官方确认）。
 *    compact 档就是「词典腔」，且该行为在 iOS 15–18 间反复变动，不可依赖。
 *  - 不同设备装的语音不同，发音会不一致；有的设备甚至只有 Eloquence
 *    （1980 年代共振峰合成），比词典腔更机械。
 *  - 听力是这个 App 的核心价值，发音质量不能交给设备决定。
 *
 * 所以改为构建期用 macOS 的 Premium 档语音渲染，产物提交进仓库。
 * 运行时只播放音频文件，仍然完全离线；TTS 保留为兜底（见 src/audio/clips.ts）。
 *
 * 依赖 macOS 的 `say` 和 `afconvert`，只在需要重新生成音频时运行，
 * 不在 CI / 常规 build 里跑（音频是提交进仓库的资源）。
 *
 * 用法：
 *   npm run audio            # 只生成缺失/变更的片段
 *   npm run audio -- --force # 全部重新生成
 *   npm run audio -- --voice "Zoe (Premium)"
 */

import { execFile } from 'node:child_process'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { tmpdir } from 'node:os'

import { decodeWav, encodeWav } from './lib/wav.mjs'
import { trimSilence, normalize, fade } from './lib/audio-post.mjs'

const run = promisify(execFile)

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const themesDir = join(root, 'src', 'content', 'themes')
/** m4a 放 public/：原样拷贝进 dist，由 Service Worker 预缓存 */
const outDir = join(root, 'public', 'audio')
/** 清单放 src/：需要被 import 进包，运行时才能同步知道有哪些片段 */
const manifestPath = join(root, 'src', 'content', 'audioManifest.json')

/**
 * 语音优先级。第一个已安装的会被采用。
 *
 * Evan (Enhanced) 排第一是听感选择——试听后觉得它的发音最接近母语者，
 * 比 Ava (Premium) 更自然。档位（Premium > Enhanced > compact）只保证
 * 技术质量下限，不代表听感排序，所以这里按实际试听结果排。
 *
 * compact 档不列入：音质是「词典腔」，达不到听力启蒙的要求。
 */
const PREFERRED_VOICES = [
  'Evan (Enhanced)',
  'Ava (Premium)',
  'Zoe (Premium)',
  'Evan (Premium)',
  'Nathan (Premium)',
  'Ava (Enhanced)',
  'Zoe (Enhanced)',
  'Allison (Enhanced)',
  'Samantha (Enhanced)',
]

/**
 * say 的语速（wpm）。
 * 单词放慢到 110：孩子第一次听一个新词需要时间分辨音节。
 * 例句保持接近自然语速，否则听起来会变成机器人念字。
 */
const RATE_WORD = 110
const RATE_SENTENCE = 165

/** 22050 Hz 是这些语音的原生采样率，再高只是重采样（已用频谱验证过） */
const SAMPLE_RATE = 22050
const AAC_BITRATE = 48000

const args = process.argv.slice(2)
const force = args.includes('--force')
const voiceArg = args.indexOf('--voice')
const voiceOverride = voiceArg >= 0 ? args[voiceArg + 1] : undefined

/* -------------------------------------------------------------------------- */
/* 语音选择                                                                    */
/* -------------------------------------------------------------------------- */

async function listVoices() {
  const { stdout } = await run('say', ['-v', '?'])
  return stdout
    .split('\n')
    .map((line) => {
      // 格式：'Ava (Premium)       en_US    # Hello! My name is Ava.'
      const m = /^(.+?)\s{2,}([a-z]{2}_[A-Z]{2})\s/.exec(line)
      return m ? { name: m[1].trim(), lang: m[2] } : null
    })
    .filter(Boolean)
}

async function pickVoice() {
  const voices = await listVoices()

  if (voiceOverride) {
    if (!voices.some((v) => v.name === voiceOverride)) {
      throw new Error(`找不到语音 "${voiceOverride}"。可用：\n  ${voices.map((v) => v.name).join('\n  ')}`)
    }
    return voiceOverride
  }

  for (const want of PREFERRED_VOICES) {
    if (voices.some((v) => v.name === want)) return want
  }

  const enUS = voices.filter((v) => v.lang === 'en_US').map((v) => v.name)
  throw new Error(
    '未找到 Premium / Enhanced 档英文语音。\n' +
      '请在「系统设置 → 辅助功能 → 朗读内容 → 系统语音 → 管理语音」中\n' +
      '下载英语（美国）里标有 Premium 的语音（推荐 Ava）。\n\n' +
      `当前可用的 en_US 语音：\n  ${enUS.join('\n  ')}`,
  )
}

/* -------------------------------------------------------------------------- */
/* 待生成的片段清单                                                            */
/* -------------------------------------------------------------------------- */

/**
 * 收集所有需要音频的文本。
 * id 用作文件名，必须是文件系统安全的；文本参与哈希，改了文案会自动重新生成。
 */
async function collectClips() {
  const clips = []

  // 单词与例句
  const files = (await readdir(themesDir)).filter((f) => f.endsWith('.json'))
  for (const file of files.sort()) {
    const theme = JSON.parse(await readFile(join(themesDir, file), 'utf8'))
    for (const word of theme.words) {
      clips.push({ id: `w/${word.id}`, text: word.text, rate: RATE_WORD })
      clips.push({ id: `s/${word.id}`, text: word.sentence, rate: RATE_SENTENCE })
    }
  }

  // 角色台词：从 phrases.ts 里抽 en 字段，避免两处维护
  const phrasesSrc = await readFile(join(root, 'src', 'content', 'phrases.ts'), 'utf8')
  const seen = new Set()
  for (const m of phrasesSrc.matchAll(/\{\s*en:\s*(['"])(.*?)\1/g)) {
    const text = m[2]
    if (seen.has(text)) continue
    seen.add(text)
    clips.push({ id: `p/${slug(text)}`, text, rate: RATE_SENTENCE })
  }

  // 寻宝提示按完整句子生成，和游戏使用同一份文本，避免运行时 TTS。
  const treasurePrompts = JSON.parse(await readFile(join(root, 'src', 'content', 'treasurePrompts.json'), 'utf8'))
  for (const text of Object.values(treasurePrompts)) {
    if (seen.has(text)) continue
    seen.add(text)
    clips.push({ id: `p/${slug(text)}`, text, rate: RATE_SENTENCE })
  }

  return clips
}

/** 台词转成稳定的文件名：小写、非字母数字变连字符 */
function slug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
}

function hashOf(text, voice, rate) {
  return createHash('sha256').update(`${voice}|${rate}|${text}`).digest('hex').slice(0, 12)
}

/* -------------------------------------------------------------------------- */
/* 渲染单个片段                                                                */
/* -------------------------------------------------------------------------- */

/**
 * say → WAV → 裁静音/归一化/淡入淡出 → AAC(m4a)
 *
 * 中间的 WAV 走临时目录：`say` 只能写文件，不能走管道。
 */
async function renderClip(clip, voice, tmp) {
  const rawPath = join(tmp, 'raw.wav')
  const cleanPath = join(tmp, 'clean.wav')

  await run('say', [
    '-v',
    voice,
    '-r',
    String(clip.rate),
    '--file-format=WAVE',
    `--data-format=LEI16@${SAMPLE_RATE}`,
    '-o',
    rawPath,
    clip.text,
  ])

  const { samples, sampleRate } = decodeWav(await readFile(rawPath))

  let out = trimSilence(samples, sampleRate)
  out = normalize(out)
  out = fade(out, sampleRate)

  await writeFile(cleanPath, encodeWav(out, sampleRate))

  const outPath = join(outDir, `${clip.id}.m4a`)
  await mkdir(dirname(outPath), { recursive: true })
  // aacl = AAC-LC，iOS Safari / 桌面浏览器都能解
  await run('afconvert', ['-f', 'm4af', '-d', 'aacl', '-b', String(AAC_BITRATE), cleanPath, outPath])

  return { durationMs: Math.round((out.length / sampleRate) * 1000) }
}

/* -------------------------------------------------------------------------- */
/* 主流程                                                                      */
/* -------------------------------------------------------------------------- */

async function main() {
  const voice = await pickVoice()
  const clips = await collectClips()

  console.log(`[audio] 语音：${voice}`)
  console.log(`[audio] 片段：${clips.length} 个`)

  await mkdir(outDir, { recursive: true })

  // 旧清单用于增量：文本或语音没变就不重新渲染
  let prev = {}
  if (!force && existsSync(manifestPath)) {
    try {
      prev = JSON.parse(await readFile(manifestPath, 'utf8')).clips ?? {}
    } catch {
      /* 清单坏了就当全新生成 */
    }
  }

  const tmp = join(tmpdir(), `lw-audio-${process.pid}`)
  await mkdir(tmp, { recursive: true })

  const manifest = {}
  let rendered = 0
  let skipped = 0

  try {
    for (const clip of clips) {
      const hash = hashOf(clip.text, voice, clip.rate)
      const outPath = join(outDir, `${clip.id}.m4a`)
      const cached = prev[clip.id]

      if (cached?.hash === hash && existsSync(outPath)) {
        manifest[clip.id] = cached
        skipped++
        continue
      }

      const { durationMs } = await renderClip(clip, voice, tmp)
      manifest[clip.id] = { hash, text: clip.text, durationMs }
      rendered++

      if (rendered % 10 === 0) process.stdout.write(`\r[audio] 已生成 ${rendered} …`)
    }
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }

  // 清掉词表里已删除的词留下的孤儿文件
  const valid = new Set(clips.map((c) => `${c.id}.m4a`))
  let removed = 0
  for (const sub of ['w', 's', 'p']) {
    const dir = join(outDir, sub)
    if (!existsSync(dir)) continue
    for (const f of await readdir(dir)) {
      if (!valid.has(`${sub}/${f}`)) {
        await rm(join(dir, f))
        removed++
      }
    }
  }

  await writeFile(
    manifestPath,
    JSON.stringify({ voice, sampleRate: SAMPLE_RATE, clips: manifest }, null, 2) + '\n',
    'utf8',
  )

  const totalMs = Object.values(manifest).reduce((a, c) => a + c.durationMs, 0)
  console.log(
    `\r[audio] 完成：新生成 ${rendered}，复用 ${skipped}` +
      (removed ? `，清理 ${removed}` : '') +
      `，总时长 ${(totalMs / 1000).toFixed(1)}s`,
  )
}

main().catch((err) => {
  console.error(`\n[audio] 失败：${err.message}`)
  process.exit(1)
})


