import { table } from 'table'

import { logger } from '@/cli/utils/logger'
import { BookService } from '@/core/book/book-service'
import { ConfigService } from '@/core/config/config-service'

export class BooksCommandCLI {
  constructor(
    private bookService: BookService,
    private configService: ConfigService
  ) {}

  async run(
    nameFilter?: string,
    idFilter?: string,
    json: boolean = false
  ): Promise<void> {
    const active = this.configService.getActiveUser()
    if (!active) {
      logger.error('No active user. Please login first.')
      return
    }

    const userIdx = active.user_idx
    const deviceId = active.device_id

    try {
      let books = this.bookService.getAvailableBooks(userIdx)
      books = this.bookService.filterById(books, idFilter)

      if (!json) {
        logger.info(`Scanning ${books.length} books for metadata...`)
      }

      const results = await this.bookService.getBooksWithMetadata(
        books,
        deviceId,
        (current, total, bookId) => {
          if (!json) {
            process.stderr.write(`\rProcessing ${current}/${total}: ${bookId}`)
          }
        }
      )

      if (!json) {
        process.stderr.write('\r' + ' '.repeat(50) + '\r')
      }

      const filtered = nameFilter
        ? results.filter(r => r.title.includes(nameFilter))
        : results

      if (filtered.length === 0) {
        if (json) {
          console.log('[]')
        } else {
          logger.warn('No books matched criteria.')
        }
        return
      }

      if (json) {
        console.log(JSON.stringify(filtered, null, 2))
      } else {
        this.displayBooks(filtered.map(r => [r.book.id, r.title]))
      }
    } catch (e) {
      if (e instanceof Error) {
        logger.error(`Error: ${e.message}`)
      } else {
        logger.error(`Error: ${e}`)
      }
    }
  }

  private displayBooks(results: Array<[string, string]>): void {
    const data = [['ID', 'Title'], ...results]
    console.log(table(data))
  }
}
