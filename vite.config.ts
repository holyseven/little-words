import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

function buildRevision(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7)
  try {
    return execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch { return 'local' }
}
const revision = buildRevision()

// GitHub Pages 部署到子路径时，构建前设置 BASE_PATH=/<仓库名>/
// 例：BASE_PATH=/little-words/ npm run build
const base = process.env.BASE_PATH ?? '/'
const https = process.env.HTTPS_CERT_FILE && process.env.HTTPS_KEY_FILE
  ? { cert: readFileSync(process.env.HTTPS_CERT_FILE), key: readFileSync(process.env.HTTPS_KEY_FILE) }
  : undefined

/**
 * 本地/自托管预览的 Azure 代理。密钥只从 .env.local / 进程环境读取，
 * 不会进入 Vite 客户端包。GitHub Pages 没有这个代理时，前端会回退 Vosk。
 */
function azurePronunciationProxy(env: Record<string, string>): Plugin {
  const handler = async (req: { method?: string; url?: string; headers: Record<string, string | string[] | undefined>; on: (event: string, listener: (...args: any[]) => void) => void }, res: { statusCode: number; setHeader: (name: string, value: string) => void; end: (body?: string | Uint8Array) => void }, next: () => void) => {
    const path = req.url?.split('?')[0] ?? ''
    if (!(path === '/api/pronunciation' || path.endsWith('/api/pronunciation')) || req.method !== 'POST') { next(); return }
    const key = env.AZURE_SPEECH_KEY
    const region = env.AZURE_SPEECH_REGION
    if (!key || !region) {
      res.statusCode = 503
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Azure pronunciation proxy is not configured' }))
      return
    }
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer | string) => {
      const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      size += value.length
      if (size <= 2 * 1024 * 1024) chunks.push(value)
    })
    req.on('end', async () => {
      if (size > 2 * 1024 * 1024) {
        res.statusCode = 413
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'Audio is too large' }))
        return
      }
      const referenceHeader = req.headers['x-pronunciation-reference']
      const reference = Array.isArray(referenceHeader) ? referenceHeader[0] : referenceHeader
      if (!reference || reference.length > 100) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'Missing pronunciation reference' }))
        return
      }
      const assessment = Buffer.from(JSON.stringify({
        ReferenceText: reference,
        GradingSystem: 'HundredMark',
        Granularity: 'Phoneme',
        Dimension: 'Comprehensive',
        EnableMiscue: 'True',
      })).toString('base64')
      const endpoint = env.AZURE_SPEECH_ENDPOINT?.replace(/\/$/, '')
        ?? `https://${region}.stt.speech.microsoft.com`
      const path = endpoint.includes('.cognitiveservices.azure.com')
        ? '/stt/speech/recognition/conversation/cognitiveservices/v1'
        : '/speech/recognition/conversation/cognitiveservices/v1'
      const url = `${endpoint}${path}?language=en-US&format=detailed`
      try {
        const upstream = await fetch(url, {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': key,
            'Pronunciation-Assessment': assessment,
            'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
            Accept: 'application/json',
          },
          body: Buffer.concat(chunks),
        })
        res.statusCode = upstream.status
        res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'application/json')
        res.end(await upstream.text())
      } catch (error) {
        res.statusCode = 502
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Azure request failed' }))
      }
    })
  }
  return {
    name: 'azure-pronunciation-proxy',
    configureServer(server) { server.middlewares.use(handler as never) },
    configurePreviewServer(server) { server.middlewares.use(handler as never) },
  }
}

export default defineConfig(({ mode }) => {
  const env = { ...process.env as Record<string, string>, ...loadEnv(mode, process.cwd(), '') }
  return {
    base,
    define: { 'import.meta.env.VITE_BUILD_ID': JSON.stringify(revision) },

    plugins: [
    react(),
    {
      name: 'app-build-version',
      transformIndexHtml: () => [{ tag: 'meta', attrs: { name: 'little-words-build', content: revision } }],
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'app-version.json', source: JSON.stringify({ build: revision }) })
      },
    },

    VitePWA({
      // 孩子在用，不弹「有新版本，是否刷新」打扰他们：下次冷启动直接生效
      registerType: 'autoUpdate',
      // 注册逻辑写在 src/main.tsx 里，方便记录 SW 就绪状态给家长页（M4）用
      injectRegister: null,

      // 不设 includeAssets：public/ 下的文件会被拷进 dist，
      // 下面的 globPatterns 已经覆盖，两处都写会让预缓存清单出现重复条目

      manifest: {
        name: 'Little Words',
        short_name: 'Little Words',
        description: '给 5–8 岁孩子的离线英语启蒙小游戏',
        lang: 'en',
        // 相对路径：不管部署在 / 还是 /repo/ 都能正确解析
        start_url: './#/',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#F6F1E7',
        theme_color: '#F6F1E7',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },

      workbox: {
        // 核心资源预缓存保证离线冷启动；课程媒体由家长单独下载。
        // m4a 是预生成的人声片段（scripts/gen-audio.mjs），必须一起缓存。
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,json,woff2,m4a}'],
        // 语音模型约 39MB，首次跟读时再下载，避免首屏安装被拖慢。
        globIgnores: ['course-media/**', 'speech-model/**', 'speech-runtime/**', 'app-version.json'],
        runtimeCaching: [{
          urlPattern: /\/course-media\/[^/]+\.(?:mp3|m4a|mp4)$/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'little-words-course-v1',
            cacheableResponse: { statuses: [200] },
            rangeRequests: true,
          },
        }, {
          urlPattern: /\/speech-model\/model\.tar\.gz$/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'little-words-speech-model-v1',
            cacheableResponse: { statuses: [200] },
            expiration: { maxEntries: 1, maxAgeSeconds: 60 * 60 * 24 * 365 },
          },
        }, {
          urlPattern: /\/speech-runtime\/vosk\.js$/,
          handler: 'CacheFirst',
          options: { cacheName: 'little-words-speech-runtime-v1', cacheableResponse: { statuses: [200] } },
        }],
        // hash 路由下所有导航请求都回退到 index.html
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        // 人声片段有 200+ 个，默认上限（约 2MB/文件）够用，但要放开总数
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },

      devOptions: {
        // 开发时不启用 SW，避免缓存干扰热更新；离线要在 preview / 部署版本上验证
        enabled: false,
      },
    }),
    azurePronunciationProxy(env),
    ],

    server: {
    // 允许 iPad 通过局域网 IP 访问
    host: true,
    ...(https ? { https } : {}),
    },

    preview: {
    host: true,
    ...(https ? { https } : {}),
    },
  }
})
