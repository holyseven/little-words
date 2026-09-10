/**
 * 构建入口包装（解决 Node 18 的一个依赖链问题）
 *
 * 现象：`vite build` 走到生成 Service Worker 时报 `ReferenceError: crypto is not defined`。
 * 原因：workbox-build → @rollup/plugin-terser 在 **worker 线程** 里 require
 *      serialize-javascript@7，而后者在模块顶层就调用全局 `crypto.getRandomValues`。
 *      全局 `crypto` 从 Node 19 起才默认存在；Node 18 的 worker 线程里是 undefined
 *      （主线程有，所以只在打包 SW 这一步才炸）。
 * 处理：Node < 20 时补上 --experimental-global-webcrypto。该 flag 通过 execArgv
 *      被 worker 线程继承，正是需要的位置。Node ≥ 20 不加任何 flag。
 *
 * 等依赖链升上来（或项目最低 Node 提到 20）后，本文件可以直接删掉，
 * package.json 里改回 `vite build` 即可。
 */

import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const major = Number(process.versions.node.split('.')[0])
const execArgv = major < 20 ? ['--experimental-global-webcrypto'] : []

if (execArgv.length > 0) {
  console.log(`[build] Node ${process.versions.node}：已补 ${execArgv.join(' ')}`)
}

/*
 * 直接定位 vite 的 CLI 入口，避免依赖 shell 里的 npx / PATH。
 * vite 的 exports 没有暴露 ./bin/vite.js，但暴露了 ./package.json，
 * 从它反推包根目录最稳。
 */
const require = createRequire(import.meta.url)
const viteBin = join(dirname(require.resolve('vite/package.json')), 'bin', 'vite.js')

const child = spawn(process.execPath, [...execArgv, viteBin, 'build', ...process.argv.slice(2)], {
  stdio: 'inherit',
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 1)
})
