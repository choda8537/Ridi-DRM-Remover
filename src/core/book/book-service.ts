import { existsSync } from 'fs'

import { decryptBook, decryptKey } from '@/core/crypto/decrypt'
import { extractTitle } from '@/core/metadata/extract'

import { BookInfo } from './book-info'
import { discoverBooks, libraryPath } from './library'
import { FileKind } from './types'

export class BookService {
  getAvailableBooks(userIdx: string): BookInfo[] {
    const libPath = libraryPath(userIdx)
    if (!existsSync(libPath)) {
      throw new Error(`Library path not found for user ${userIdx}: ${libPath}`)
    }

    const infos = discoverBooks(libPath).filter(b =>
      existsSync(b.getFile(FileKind.DATA))
    )

    if (infos.length === 0) {
      throw new Error('No books found in library.')
    }

    return infos
  }

  filterById(books: BookInfo[], id?: string): BookInfo[] {
    if (!id) return books
    const filtered = books.filter(b => b.id === id)
    if (filtered.length === 0) {
      throw new Error(`No books found with ID: ${id}`)
    }
    return filtered
  }

  async filterByName(
    books: BookInfo[],
    deviceId: string,
    name?: string
  ): Promise<BookInfo[]> {
    if (!name) return books

    const matched: BookInfo[] = []
    for (const book of books) {
      try {
        const key = decryptKey(book, deviceId)
        const content = decryptBook(book, key)
        const title = await extractTitle(book.format, content)
        if (title && title.includes(name)) {
          matched.push(book)
        }
      } catch {
        continue
      }
    }
    return matched
  }

  async getBooksWithMetadata(
    books: BookInfo[],
    deviceId: string,
    onProgress?: (current: number, total: number, bookId: string) => void
  ): Promise<Array<{ book: BookInfo; title: string }>> {
    const results: Array<{ book: BookInfo; title: string }> = []

    for (let i = 0; i < books.length; i++) {
      const book = books[i]
      onProgress?.(i + 1, books.length, book.id)

      try {
        const key = decryptKey(book, deviceId)
        const content = decryptBook(book, key)
        const title =
          (await extractTitle(book.format, content)) || 'Unknown Title'
        results.push({ book, title })
      } catch (e) {
        results.push({ book, title: `[Error: ${e}]` })
      }
    }

    return results
  }
}
