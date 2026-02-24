/*
 * Copyright 2026 meherpraveen
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * This file contains code derived from:
 * - https://github.com/Retro-Rex8/Ridi-DRM-Remover (Apache-2.0)
 * - https://github.com/hsj1/ridiculous (CC0 1.0 Universal)
 */
import { existsSync, readdirSync, statSync } from 'fs'
import { homedir, platform } from 'os'
import { join } from 'path'

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