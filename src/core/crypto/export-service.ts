import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { BookInfo } from '@/core/book/book-info'
import { FileKind } from '@/core/book/types'
import { bookFormatExtension } from '@/core/book/book-info'
import { decryptKey, decryptBook } from './decrypt'
import { extractTitle } from '@/core/metadata/extract'
import { sanitizeFilename } from '@/core/metadata/sanitize'

export interface ExportProgress {
  bookId: string
  fileName: string
  status: 'processing' | 'success' | 'error'
  error?: Error
}

export class ExportService {
  async exportBook(
    bookInfo: BookInfo,
    deviceId: string,
    outputDir: string,
    onProgress?: (progress: ExportProgress) => void
  ): Promise<string> {
    const fileName = bookInfo.fileName(FileKind.BOOK)

    onProgress?.({
      bookId: bookInfo.id,
      fileName,
      status: 'processing'
    })

    try {
      const key = decryptKey(bookInfo, deviceId)
      const content = decryptBook(bookInfo, key)

      const title = await extractTitle(bookInfo.format, content)
      let outName: string
      if (title) {
        outName = `${sanitizeFilename(title)}.${bookFormatExtension(bookInfo.format)}`
      } else {
        outName = fileName
      }

      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true })
      }

      let target = join(outputDir, outName)

      if (existsSync(target)) {
        const lastDot = outName.lastIndexOf('.')
        const stem = lastDot > 0 ? outName.substring(0, lastDot) : outName
        const suffix = lastDot > 0 ? outName.substring(lastDot) : ''
        let i = 1
        while (existsSync(target) && i < 1000) {
          target = join(outputDir, `${stem} (${i})${suffix}`)
          i++
        }
      }

      writeFileSync(target, content)

      onProgress?.({
        bookId: bookInfo.id,
        fileName,
        status: 'success'
      })

      return target
    } catch (error) {
      onProgress?.({
        bookId: bookInfo.id,
        fileName,
        status: 'error',
        error: error as Error
      })
      throw error
    }
  }

  async exportBooks(
    books: BookInfo[],
    deviceId: string,
    outputDir: string,
    onProgress?: (progress: ExportProgress) => void
  ): Promise<{ success: number; total: number }> {
    let successCount = 0
    for (const book of books) {
      try {
        await this.exportBook(book, deviceId, outputDir, onProgress)
        successCount++
      } catch {
        continue
      }
    }
    return { success: successCount, total: books.length }
  }
}
