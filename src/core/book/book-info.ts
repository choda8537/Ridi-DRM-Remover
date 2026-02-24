import { readdirSync, statSync } from 'fs'
import { basename, join } from 'path'

import { BookFormat, FileKind } from './types'

export function bookFormatFromPath(path: string): BookFormat {
  const ext = path.substring(path.lastIndexOf('.') + 1).toLowerCase()
  if (ext === 'epub') return BookFormat.EPUB
  if (ext === 'pdf') return BookFormat.PDF
  throw new Error(`not a book file: ${path}`)
}

export function bookFormatExtension(format: BookFormat): string {
  return format.toString()
}

export class BookInfo {
  public readonly path: string
  public readonly id: string
  public readonly format: BookFormat

  constructor(path: string) {
    this.path = path
    this.id = basename(path)
    this.format = this.detectFormat(path)
  }

  private detectFormat(path: string): BookFormat {
    const entries = readdirSync(path)
    for (const entry of entries) {
      const fullPath = join(path, entry)
      if (statSync(fullPath).isFile()) {
        try {
          return bookFormatFromPath(fullPath)
        } catch {
          continue
        }
      }
    }
    throw new Error(`Valid book file not found in: ${path}`)
  }

  getFile(kind: FileKind): string {
    const ext =
      kind === FileKind.BOOK ? bookFormatExtension(this.format) : 'dat'
    const entries = readdirSync(this.path)
    for (const entry of entries) {
      const fullPath = join(this.path, entry)
      if (
        statSync(fullPath).isFile() &&
        entry.startsWith(this.id) &&
        entry.toLowerCase().endsWith(`.${ext}`)
      ) {
        return fullPath
      }
    }
    return join(this.path, `${this.id}.${ext}`)
  }

  fileName(kind: FileKind): string {
    if (kind === FileKind.BOOK) {
      return `${this.id}.${bookFormatExtension(this.format)}`
    }
    const filePath = this.getFile(kind)
    return basename(filePath)
  }
}