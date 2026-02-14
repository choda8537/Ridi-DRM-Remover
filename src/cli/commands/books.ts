import { BookService } from '@/core/book/book-service'
import { ConfigService } from '@/core/config/config-service'
import { truncateText } from '@/cli/utils/text'
import { getTerminalWidth } from '@/cli/utils/terminal'

export class BooksCommandCLI {
  constructor(
    private bookService: BookService,
    private configService: ConfigService
  ) {}

  async run(nameFilter?: string, idFilter?: string): Promise<void> {
    const active = this.configService.getActiveUser()
    if (!active) {
      console.error('No active user. Please login first.')
      return
    }

    const userIdx = active.user_idx
    const deviceId = active.device_id

    try {
      let books = this.bookService.getAvailableBooks(userIdx)
      books = this.bookService.filterById(books, idFilter)

      console.log(`Scanning ${books.length} books for metadata...`)

      const results = await this.bookService.getBooksWithMetadata(
        books,
        deviceId,
        (current, total, bookId) => {
          process.stderr.write(`\rProcessing ${current}/${total}: ${bookId}`)
        }
      )

      process.stderr.write('\r' + ' '.repeat(50) + '\r')

      const filtered = nameFilter
        ? results.filter(r => r.title.includes(nameFilter))
        : results

      if (filtered.length === 0) {
        console.warn('No books matched criteria.')
        return
      }

      this.displayBooks(filtered.map(r => [r.book.id, r.title]))
    } catch (e) {
      if (e instanceof Error) {
        console.error(`Error: ${e.message}`)
      } else {
        console.error(`Error: ${e}`)
      }
    }
  }

  private displayBooks(results: Array<[string, string]>): void {
    const terminalWidth = getTerminalWidth()

    const idWidth = 12
    const separatorWidth = 3

    const titleWidth = Math.max(
      terminalWidth - idWidth - separatorWidth - 5,
      30
    )

    console.log(`${'ID'.padEnd(idWidth)} | ${'Title'}`)
    console.log(
      '-'.repeat(Math.min(terminalWidth, idWidth + separatorWidth + titleWidth))
    )

    for (const [bid, btitle] of results) {
      const titleDisplay = truncateText(btitle, titleWidth)
      console.log(`${bid.padEnd(idWidth)} | ${titleDisplay}`)
    }
  }
}
