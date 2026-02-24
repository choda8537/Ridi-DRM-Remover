/**
 * Electron GUI 런처 (Bun 환경 최적화)
 *
 * - main process: NODE_OPTIONS="--import tsx/esm"로 TypeScript 직접 실행
 * - preload: Bun.build로 즉시 트랜스파일 (~10ms)
 * - renderer: Vite 개발 서버 (별도 프로세스)
 */

import { resolve } from 'path'
import { spawn } from 'child_process'

// 1) Preload 스크립트 빠른 트랜스파일 (renderer 프로세스는 tsx 로더 미지원)
const preloadResult = await Bun.build({
  entrypoints: ['src/gui/preload.ts'],
  outdir: 'src/gui/dist',
  target: 'node',
  external: ['electron'],
})

if (!preloadResult.success) {
  console.error('❌ Preload 빌드 실패:', preloadResult.logs)
  process.exit(1)
}
console.log('✅ Preload 트랜스파일 완료')

// 2) NODE_OPTIONS로 tsx 등록 후 Electron 실행
const electronBin = resolve('node_modules/.bin/electron')

const child = spawn(electronBin, ['src/gui/main.ts'], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    NODE_OPTIONS: '--import tsx/esm',
  },
})

child.on('exit', (code) => process.exit(code ?? 0))
