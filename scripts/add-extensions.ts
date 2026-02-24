import { readdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

function addJsExtensions(dir: string): void {
  const files = readdirSync(dir, { recursive: true })

  for (const file of files) {
    if (typeof file !== 'string' || !file.endsWith('.js')) continue

    const filePath = join(dir, file)
    let content = readFileSync(filePath, 'utf-8')

    // Add .js extension to relative imports that don't have extensions
    content = content.replace(
      /from\s+['"](\.\.[/\\][^'"]*?)(?<!\.js)['"];/g,
      "from '$1.js';"
    )

    content = content.replace(
      /import\s+(['"][^'"]*?)(?<!\.js)['"];/g,
      "import '$1.js';"
    )

    writeFileSync(filePath, content, 'utf-8')
  }

  console.log('✓ Added .js extensions to relative imports')
}

const distDir = join(process.cwd(), 'src/gui/dist')
addJsExtensions(distDir)
