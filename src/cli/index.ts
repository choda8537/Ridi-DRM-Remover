import { Command } from 'commander'
import { ConfigService } from '@/core/config/config-service'
import { AuthService } from '@/core/auth/auth-service'
import { BookService } from '@/core/book/book-service'
import { ExportService } from '@/core/crypto/export-service'
import { AuthCommandCLI } from './commands/auth'
import { BooksCommandCLI } from './commands/books'
import { ExportCommandCLI } from './commands/export'
import { CONFIG_FILE } from '@/shared/constants'

async function main(): Promise<void> {
  const program = new Command()
  program.name('ridi').description('Ridi Books DRM Remover CLI Utility')

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
    .action(() => authCLI.login())
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
    .action(() => authCLI.listAccounts())

  program
    .command('books')
    .description('List downloaded books')
    .option('-n, --name <name>', 'Filter by book title (partial match)')
    .option('-i, --id <id>', 'Filter by book ID (exact match)')
    .action(async options => {
      await booksCLI.run(options.name, options.id)
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
        console.log('Error: Please specify --all, --name, or --id')
        return
      }
      await exportCLI.run(options.output, options.name, options.id)
    })

  await program.parseAsync(process.argv)
}

main().catch(e => {
  console.error(e)
})
