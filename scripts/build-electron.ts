import { execSync } from 'child_process'
import { build } from 'esbuild'
import fs from 'fs'

const run = (cmd: string) => execSync(cmd, { stdio: 'inherit' })

if (fs.existsSync('build')) {
  fs.rmSync('build', { recursive: true, force: true })
}

console.log('[1/3] 렌더러 빌드 중...')
run('npx vite build')

console.log('[2/3] 메인 프로세스 번들링 중...')
const shared = {
  bundle: true,
  platform: 'node' as const,
  target: 'node20',
  format: 'esm' as const,
  packages: 'external' as const,
  tsconfig: 'tsconfig.json',
}

await build({ ...shared, entryPoints: ['src/gui/main.ts'],    outfile: 'build/electron/main.js' })
await build({ ...shared, entryPoints: ['src/gui/preload.ts'], outfile: 'build/electron/preload.js' })

console.log('[3/3] 앱 패키징 중...')
run('npx electron-builder --win --x64')

console.log('빌드 완료 → dist-app/')
