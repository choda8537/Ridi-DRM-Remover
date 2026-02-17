import { logger } from '@/cli/utils/logger'
import { BookService } from '@/core/book/book-service'
import { ConfigService } from '@/core/config/config-service'
import { ExportService } from '@/core/crypto/export-service'

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
      logger.error('No active user. Please login first.')
      return
    }

    const userIdx = active.user_idx
    const deviceId = active.device_id

    try {
      let books = this.bookService.getAvailableBooks(userIdx)
      books = this.bookService.filterById(books, idFilter)
      books = await this.bookService.filterByName(books, deviceId, nameFilter)

      if (books.length === 0) {
        logger.warn('No books found matching criteria.')
        return
      }

      logger.info(`Found ${books.length} books. Preparing to export...`)

      const result = await this.exportService.exportBooks(
        books,
        deviceId,
        outputDir,
        progress => {
          if (progress.status === 'processing') {
            process.stdout.write(`\r⣿ Decrypting "${progress.fileName}"`)
          } else if (progress.status === 'success') {
            process.stdout.write(`\r⣿ Decrypting "${progress.fileName}" ✔︎\n`)
          } else {
            process.stdout.write(`\r⣿ Decrypting "${progress.fileName}" ✘\n`)
          }
        }
      )

      logger.success(
        `Export completed. ${result.success}/${result.total} books exported to ${outputDir}`
      )
    } catch (e) {
      if (e instanceof Error) {
        logger.error(`Error during export: ${e.message}`)
      } else {
        logger.error(`Error during export: ${e}`)
      }
    }
  }
}
