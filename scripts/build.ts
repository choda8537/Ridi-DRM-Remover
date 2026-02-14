import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function main() {
  const projectRoot = join(__dirname, '..')
  const mainScript = join(projectRoot, 'src', 'cli', 'index.ts')

  if (!existsSync(mainScript)) {
    console.error(`Error: Could not find main script at ${mainScript}`)
    process.exit(1)
  }

  const distDir = join(projectRoot, 'dist')
  const outFile = join(distDir, 'ridi')

  console.log(`Building standalone executable with Bun.build()...`)
  console.log(`  Source: ${mainScript}`)
  console.log(`  Output: ${outFile}`)

  try {
    const result = await Bun.build({
      entrypoints: [mainScript],
      compile: {
        outfile: outFile
      },
      target: 'bun',
      minify: true,
      sourcemap: 'linked'
    })

    if (!result.success) {
      console.error('\nBuild failed with errors:')
      for (const log of result.logs) {
        console.error(log)
      }
      process.exit(1)
    }

    console.log(`\n✓ Build successful! Executable: ${outFile}`)
  } catch (error) {
    console.error('\nBuild error:', error)
    process.exit(1)
  }
}

main()
