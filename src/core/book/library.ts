import { existsSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { homedir, platform } from 'os'
import { BookInfo } from './book-info'

export function libraryPath(userIdx: string): string {
  const plat = platform()
  if (plat === 'darwin') {
    const home = homedir()
    return join(
      home,
      'Library',
      'Application Support',
      'Ridibooks',
      'library',
      `_${userIdx}`
    )
  }
  if (plat === 'win32') {
    const appdata = process.env.APPDATA
    if (!appdata || !existsSync(appdata)) {
      throw new Error('APPDATA environment variable not found')
    }
    return join(appdata, 'Ridibooks', 'library', `_${userIdx}`)
  }
  throw new Error('library_path() not implemented for this OS')
}

export function discoverBooks(path: string): BookInfo[] {
  if (!existsSync(path)) {
    return []
  }
  const infos: BookInfo[] = []
  const entries = readdirSync(path)
  for (const entry of entries) {
    const fullPath = join(path, entry)
    if (statSync(fullPath).isDirectory()) {
      try {
        infos.push(new BookInfo(fullPath))
      } catch {
        continue
      }
    }
  }
  return infos
}
