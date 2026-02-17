import { execSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

import { logger } from '../src/cli/utils/logger'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function main() {
  const projectRoot = join(__dirname, '..')
  const mainScript = join(projectRoot, 'src', 'cli', 'index.ts')

  if (!existsSync(mainScript)) {
    logger.error(`Could not find main script at ${mainScript}`)
    process.exit(1)
  }

  const pkg = JSON.parse(
    readFileSync(join(projectRoot, 'package.json'), 'utf-8')
  )
  const version = pkg.version
  const buildTime = new Date().toISOString()
  let gitCommit = 'unknown'

  try {
    gitCommit = execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    logger.warn('Could not get git commit hash.')
  }

  const distDir = join(projectRoot, 'dist')
  const outFile = join(distDir, 'ridi')

  logger.info(`Building standalone executable with Bun.build()...`)
  console.log(`  Version: ${version}`)
  console.log(`  Commit: ${gitCommit}`)
  console.log(`  Time: ${buildTime}`)

  try {
    const result = await Bun.build({
      entrypoints: [mainScript],
      compile: {
        outfile: outFile
      },
      target: 'bun',
      minify: true,
      sourcemap: 'linked',
      define: {
        'process.env.RIDI_OAUTH_CLIENT_ID': JSON.stringify(
          process.env.RIDI_OAUTH_CLIENT_ID
        ),
        'process.env.RIDI_OAUTH_CLIENT_SECRET': JSON.stringify(
          process.env.RIDI_OAUTH_CLIENT_SECRET
        ),
        BUILD_VERSION: JSON.stringify(version),
        BUILD_TIME: JSON.stringify(buildTime),
        GIT_COMMIT: JSON.stringify(gitCommit)
      }
    })

    if (!result.success) {
      logger.error('Build failed with errors:')
      for (const log of result.logs) {
        console.error(log)
      }
      process.exit(1)
    }

    logger.success(`Build successful! Executable: ${outFile}`)
  } catch (error) {
    logger.error(`Build error: ${error}`)
    process.exit(1)
  }
}

main()
