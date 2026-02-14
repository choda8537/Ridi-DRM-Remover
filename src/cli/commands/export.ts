import { BookService } from '@/core/book/book-service'
import { ExportService } from '@/core/crypto/export-service'
import { ConfigService } from '@/core/config/config-service'

export class ExportCommandCLI {
  constructor(
    private exportService: ExportService,
    private bookService: BookService,
    private configService: ConfigService
  ) {}

  async run(
    outputDir: string,
    nameFilter?: string,
    idFilter?: string
  ): Promise<void> {
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
      books = await this.bookService.filterByName(books, deviceId, nameFilter)

      if (books.length === 0) {
        console.warn('No books found matching criteria.')
        return
      }

      console.log(`Found ${books.length} books. Preparing to export...`)

      const result = await this.exportService.exportBooks(
        books,
        deviceId,
        outputDir,
        progress => {
          if (progress.status === 'processing') {
            process.stdout.write(`\r⣿ Decrypting "${progress.fileName}"`)
          } else if (progress.status === 'success') {
            console.log(`\r⣿ Decrypting "${progress.fileName}" ✔︎`)
          } else {
            console.log(`\r⣿ Decrypting "${progress.fileName}" ✘`)
          }
        }
      )

      console.log(
        `\nExport completed. ${result.success}/${result.total} books exported to ${outputDir}`
      )
    } catch (e) {
      if (e instanceof Error) {
        console.error(`Error during export: ${e.message}`)
      } else {
        console.error(`Error during export: ${e}`)
      }
    }
  }
}
