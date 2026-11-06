/**
 * Generate the paper-pinwheel lesson's offline Mandarin / English narration.
 *
 * Kokoro ONNX generates speech locally; macOS `afconvert` encodes offline AAC.
 * Generation has no cloud requests, API keys, or runtime downloads. The text
 * comes directly from windmill.ts so narration and subtitles stay in sync.
 *
 * Setup:
 *   python3 -m venv .windmill-tts.local/venv
 *   .windmill-tts.local/venv/bin/python -m pip install -r scripts/requirements-windmill-audio.txt
 * Place kokoro-v1.1-zh.fp16.onnx and voices-v1.1-zh.bin in .windmill-tts.local/models.
 * This local cache is ignored by Git and is not bundled in the web app.
 * Free model files from the kokoro-onnx project's model-files-v1.1 release:
 *   https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/kokoro-v1.1-zh.fp16.onnx
 *   https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/voices-v1.1-zh.bin
 * Run:
 *   WINDMILL_TTS_PYTHON=.windmill-tts.local/venv/bin/python WINDMILL_TTS_MODEL_DIR=.windmill-tts.local/models node scripts/gen-windmill-audio.mjs [--force]
 * Voice overrides: --voice-zh "zf_001" --voice-en "af_maple"
 * Cached clips are reused when text, voice and rendering settings match.
 */

import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import ts from 'typescript'

import { fade, normalize, trimSilence } from './lib/audio-post.mjs'
import { decodeWav, encodeWav } from './lib/wav.mjs'

const run = promisify(execFile)
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outputDir = join(root, 'public', 'audio')
const manifestPath = join(root, 'src', 'content', 'windmillAudio.json')
const sourcePath = join(root, 'src', 'content', 'windmill.ts')
const SAMPLE_RATE = 24000
const AAC_BITRATE = 64000
const RENDER_VERSION = 2
const languages = ['zh', 'en']
const profiles = {
  zh: { provider: 'kokoro-onnx', model: 'kokoro-v1.1-zh.fp16', voice: 'zf_001', language: 'cmn', speed: .85 },
  en: { provider: 'kokoro-onnx', model: 'kokoro-v1.1-zh.fp16', voice: 'af_maple', language: 'en-us', speed: .67 },
}
const args = process.argv.slice(2)
const force = args.includes('--force')

function option(name) {
  const index = args.indexOf(name)
  if (index < 0) return undefined
  const value = args[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`${name} needs a voice name.`)
  return value
}

function selectVoices() {
  return Object.fromEntries(languages.map((language) => {
    const profile = profiles[language]
    const voice = option(`--voice-${language}`) ?? profile.voice
    const voiceLanguage = language === 'zh' ? /^z[fm]_\d+$/ : /^a[fm]_[a-z0-9_]+$/
    if (!voiceLanguage.test(voice)) throw new Error(`Voice ${voice} does not match the ${language} narration language.`)
    return [language, { ...profile, voice }]
  }))
}

async function loadChapters() {
  const source = await readFile(sourcePath, 'utf8')
  // This content module has no dependencies; strip its TypeScript interfaces.
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  })
  const { windmillChapters } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
  if (!Array.isArray(windmillChapters) || !windmillChapters.length) throw new Error('The lesson has no chapters.')
  const ids = new Set()
  for (const chapter of windmillChapters) {
    if (!/^[a-z][a-z0-9-]*$/.test(chapter.id) || ids.has(chapter.id)) throw new Error('Invalid or duplicate chapter ID.')
    ids.add(chapter.id)
    for (const language of languages) {
      if (typeof chapter[language] !== 'string' || !chapter[language].trim()) throw new Error(`Missing ${language} text for ${chapter.id}.`)
    }
  }
  return windmillChapters
}

function hashOf(text, profile) {
  return createHash('sha256').update(JSON.stringify({
    text, ...profile, sampleRate: SAMPLE_RATE, aacBitrate: AAC_BITRATE, renderVersion: RENDER_VERSION,
  })).digest('hex').slice(0, 16)
}

async function encodeClip(rawPath, filename, temp) {
  const cleanPath = join(temp, `${filename}.clean.wav`)
  const encodedPath = join(temp, filename)
  const { samples, sampleRate } = decodeWav(await readFile(rawPath))
  let peak = 0
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample))
  if (sampleRate !== SAMPLE_RATE || samples.length < SAMPLE_RATE || peak < 0.01) {
    throw new Error(`The local speech model returned empty or invalid audio for ${filename}.`)
  }
  const clean = fade(normalize(trimSilence(samples, sampleRate, { padMs: 24 })), sampleRate)
  await writeFile(cleanPath, encodeWav(clean, sampleRate))
  await run('afconvert', ['-f', 'm4af', '-d', 'aacl', '-b', String(AAC_BITRATE), cleanPath, encodedPath])
  if ((await stat(encodedPath)).size < 1000) throw new Error(`AAC encoding returned an invalid file for ${filename}.`)
  return Math.round(clean.length / sampleRate * 1000)
}

function validateDuration(durationMs, chapter, id) {
  if (!Number.isFinite(durationMs) || durationMs < 3000 || durationMs + 500 > chapter.durationMs) {
    throw new Error(`${id} narration is ${durationMs} ms; it must last at least 3000 ms and leave 500 ms within the ${chapter.durationMs} ms chapter.`)
  }
}

async function synthesizeBatch(requests, temp) {
  if (!requests.length) return
  const modelDir = process.env.WINDMILL_TTS_MODEL_DIR
  if (!modelDir) throw new Error('Set WINDMILL_TTS_MODEL_DIR to the directory containing the Kokoro model and voices files.')
  const requestPath = join(temp, 'speech-requests.json')
  await writeFile(requestPath, JSON.stringify(requests, null, 2) + '\n')
  const { stdout } = await run(process.env.WINDMILL_TTS_PYTHON || 'python3', [
    join(root, 'scripts', 'render-windmill-speech.py'), '--model-dir', modelDir, '--requests', requestPath,
  ], { timeout: 600000, maxBuffer: 4 * 1024 * 1024 })
  if (stdout.trim()) console.log(stdout.trim())
}

async function main() {
  const chapters = await loadChapters()
  const voices = selectVoices()
  let previous = {}
  if (!force) {
    try { previous = JSON.parse(await readFile(manifestPath, 'utf8')).clips ?? {} } catch { /* Generate missing manifest. */ }
  }
  const temp = await mkdtemp(join(tmpdir(), 'windmill-audio-'))
  const clips = {}
  const requests = []
  const pending = []
  let generated = 0
  try {
    for (const chapter of chapters) {
      for (const language of languages) {
        const id = `${chapter.id}-${language}`
        const text = chapter[language]
        const profile = voices[language]
        const hash = hashOf(text, profile)
        const filename = `windmill-${id}.m4a`
        const cached = previous[id]
        const existing = await stat(join(outputDir, filename)).catch(() => null)
        if (cached?.hash === hash && existing?.size > 1000) {
          validateDuration(cached.durationMs, chapter, id)
          await copyFile(join(outputDir, filename), join(temp, filename))
          clips[id] = cached
          console.log(`[windmill audio] Reused ${id}: ${cached.durationMs} ms`)
          continue
        }
        const outputWav = join(temp, `${id}.raw.wav`)
        requests.push({ id, text, ...profile, outputWav })
        pending.push({ id, text, profile, hash, filename, outputWav, chapter })
      }
    }
    // Load the model once for all missing clips; punctuation controls phrasing
    // without the previous extra macOS `slnc` commands.
    await synthesizeBatch(requests, temp)
    for (const { id, text, profile, hash, filename, outputWav, chapter } of pending) {
      const durationMs = await encodeClip(outputWav, filename, temp)
      validateDuration(durationMs, chapter, id)
      clips[id] = { src: `/audio/${filename}`, text, ...profile, durationMs, hash }
      generated++
      console.log(`[windmill audio] Generated ${id}: ${durationMs} ms / ${profile.voice}`)
    }
    const stagedManifest = join(temp, 'windmillAudio.json')
    await writeFile(stagedManifest, JSON.stringify({
      version: RENDER_VERSION, sampleRate: SAMPLE_RATE, aacBitrate: AAC_BITRATE, voices, clips,
    }, null, 2) + '\n')
    // All model, audio and timing checks complete before replacing public files.
    await mkdir(outputDir, { recursive: true })
    for (const clip of Object.values(clips)) {
      const filename = clip.src.split('/').pop()
      await copyFile(join(temp, filename), join(outputDir, filename))
    }
    await copyFile(stagedManifest, manifestPath)
    console.log(`[windmill audio] Complete: ${generated} generated, ${chapters.length * languages.length - generated} reused.`)
  } finally {
    await rm(temp, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(`[windmill audio] ${error.message}`)
  process.exitCode = 1
})
