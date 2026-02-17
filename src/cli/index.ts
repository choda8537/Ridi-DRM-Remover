import { Command } from 'commander'

import { logger } from '@/cli/utils/logger'
import { APP_VERSION } from '@/cli/version'
import { AuthService } from '@/core/auth/auth-service'
import { BookService } from '@/core/book/book-service'
import { ConfigService } from '@/core/config/config-service'
import { ExportService } from '@/core/crypto/export-service'
import { CONFIG_FILE } from '@/shared/constants'

import { AuthCommandCLI } from './commands/auth'
import { BooksCommandCLI } from './commands/books'
import { ExportCommandCLI } from './commands/export'

async function main(): Promise<void> {
  const program = new Command()

  program
    .name('ridi')
    .description('Ridi Books DRM Remover CLI Utility')
    .version(APP_VERSION, '-V, --version')

  const configService = new ConfigService(CONFIG_FILE)
  const authService = new AuthService(configService)
  const bookService = new BookService()
  const exportService = new ExportService()

  const authCLI = new AuthCommandCLI(authService)
  const booksCLI = new BooksCommandCLI(bookService, configService)
  const exportCLI = new ExportCommandCLI(
    exportService,
    bookService,
    configService
  )

  const authCmd = program.command('auth').description('Manage authentication')
  authCmd
    .command('login')
    .description('Login to Ridi account')
    .option('--manual', 'Skip automatic login and perform manual login')
    .action(options => authCLI.login(options.manual))
  authCmd
    .command('logout')
    .description('Logout current account')
    .action(() => authCLI.logout())
  authCmd
    .command('switch')
    .description('Switch between accounts')
    .action(() => authCLI.switch())
  authCmd
    .command('list')
    .description('List accounts')
    .option('--json', 'Output list as JSON')
    .action(options => authCLI.listAccounts(options.json))

  program
    .command('books')
    .description('List downloaded books')
    .option('-n, --name <name>', 'Filter by book title (partial match)')
    .option('-i, --id <id>', 'Filter by book ID (exact match)')
    .option('--json', 'Output list as JSON')
    .action(async options => {
      await booksCLI.run(options.name, options.id, options.json)
    })

  program
    .command('export')
    .description('Export and decrypt books')
    .option('-o, --output <dir>', 'Output directory (default: current)', '.')
    .option('-n, --name <name>', 'Export books matching title (partial match)')
    .option('-i, --id <id>', 'Export book matching ID (exact match)')
    .option('-a, --all', 'Export all books')
    .action(async options => {
      if (!options.all && !options.name && !options.id) {
        logger.error('Please specify --all, --name, or --id')
        return
      }
      await exportCLI.run(options.output, options.name, options.id)
    })

  await program.parseAsync(process.argv)
}

main().catch(e => {
  logger.error(e instanceof Error ? e.message : String(e))
})
