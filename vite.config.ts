import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'

// GitHub Pages 部署到子路径时，构建前设置 BASE_PATH=/<仓库名>/
// 例：BASE_PATH=/little-words/ npm run build
const base = process.env.BASE_PATH ?? '/'
const https = process.env.HTTPS_CERT_FILE && process.env.HTTPS_KEY_FILE
  ? { cert: readFileSync(process.env.HTTPS_CERT_FILE), key: readFileSync(process.env.HTTPS_KEY_FILE) }
  : undefined

export default defineConfig({
  base,

  plugins: [
    react(),

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
        globIgnores: ['course-media/**'],
        runtimeCaching: [{
          urlPattern: /\/course-media\/[^/]+\.(?:mp3|m4a|mp4)$/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'little-words-course-v1',
            cacheableResponse: { statuses: [200] },
            rangeRequests: true,
          },
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
})
