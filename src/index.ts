import { Command } from 'commander'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { stdin, stdout } from 'process'
import { createInterface } from 'readline'
import * as open from 'open'
import { BookInfo, FileKind, discoverBooks, libraryPath } from './book.js'
import { decryptBook, decryptKey, decryptWithProgress } from './crypto.js'
import { extractTitle } from './metadata.js'
import type { ConfigData, UserData, UserDevice, UserDevices } from './models.js'
import { displayWidth, getTerminalWidth, truncateText } from './table.js'

const CONFIG_FILE = join(homedir(), '.ridi_auth.json')
const RIDI_LOGIN_URL = 'https://ridibooks.com/account/login'
const RIDI_USER_DEVICES_API =
  'https://account.ridibooks.com/api/user-devices/app'

function log(message: string): void {
  console.log(message)
}

function error(message: string): void {
  console.error(message)
}

function warning(message: string): void {
  console.warn(message)
}

function getAvailableBooks(userIdx: string): BookInfo[] {
  const libPath = libraryPath(userIdx)
  if (!existsSync(libPath)) {
    error(`Library path not found for user ${userIdx}: ${libPath}`)
    return []
  }

  const infos = discoverBooks(libPath).filter(b =>
    existsSync(b.getFile(FileKind.DATA))
  )
  if (infos.length === 0) {
    warning('No books found in library.')
  }
  return infos
}

function filterById(infos: BookInfo[], idFilter?: string): BookInfo[] {
  if (!idFilter) return infos
  const filtered = infos.filter(b => b.id === idFilter)
  if (filtered.length === 0) {
    warning(`No books found with ID: ${idFilter}`)
  }
  return filtered
}

async function filterByName(
  infos: BookInfo[],
  deviceId: string,
  nameFilter?: string
): Promise<BookInfo[]> {
  if (!nameFilter) return infos

  log('Scanning books to match title...')
  const matched: BookInfo[] = []
  for (const book of infos) {
    try {
      const key = decryptKey(book, deviceId)
      const content = decryptBook(book, key)
      const title = await extractTitle(book.format, content)
      if (title && title.includes(nameFilter)) {
        matched.push(book)
      }
    } catch {
      continue
    }
  }
  return matched
}

class ConfigManager {
  private configPath: string
  public config: ConfigData

  constructor(configPath: string) {
    this.configPath = configPath
    this.config = this.load()
  }

  private load(): ConfigData {
    if (!existsSync(this.configPath)) {
      return { users: [], active_user: null }
    }
    try {
      const content = readFileSync(this.configPath, 'utf-8')
      return JSON.parse(content) as ConfigData
    } catch {
      return { users: [], active_user: null }
    }
  }

  save(): void {
    try {
      const dir = this.configPath.substring(0, this.configPath.lastIndexOf('/'))
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
      writeFileSync(
        this.configPath,
        JSON.stringify(this.config, null, 2),
        'utf-8'
      )
    } catch (e) {
      error(`Failed to save config: ${e}`)
    }
  }

  addUser(userIdx: string, deviceId: string, deviceName: string | null): void {
    for (const user of this.config.users) {
      if (user.user_idx === userIdx && user.device_id === deviceId) {
        user.device_name = deviceName || 'Unknown Device'
        this.config.active_user = this.makeId(userIdx, deviceId)
        this.save()
        return
      }
    }

    const newUser: UserData = {
      id: this.makeId(userIdx, deviceId),
      user_idx: userIdx,
      device_id: deviceId,
      device_name: deviceName || 'Unknown Device'
    }
    this.config.users.push(newUser)
    this.config.active_user = newUser.id
    this.save()
  }

  private makeId(userIdx: string, deviceId: string): string {
    return `${userIdx}_${deviceId.substring(0, 8)}`
  }

  getActiveUser(): UserData | null {
    if (!this.config.active_user) return null
    for (const user of this.config.users) {
      if (user.id === this.config.active_user) {
        return user
      }
    }
    return null
  }

  switchUser(userId: string): boolean {
    for (const user of this.config.users) {
      if (user.id === userId) {
        this.config.active_user = userId
        this.save()
        return true
      }
    }
    return false
  }

  removeUser(userId: string): boolean {
    const initialLen = this.config.users.length
    this.config.users = this.config.users.filter(u => u.id !== userId)
    if (this.config.users.length < initialLen) {
      if (this.config.active_user === userId) {
        this.config.active_user =
          this.config.users.length > 0 ? this.config.users[0].id : null
      }
      this.save()
      return true
    }
    return false
  }

  listUsers(): UserData[] {
    return this.config.users
  }
}

class AuthCommand {
  private configMgr: ConfigManager

  constructor(configMgr: ConfigManager) {
    this.configMgr = configMgr
  }

  async login(): Promise<void> {
    const callbackUrl = RIDI_USER_DEVICES_API
    const statePayload = JSON.stringify({ return_url: callbackUrl })
    const stateQ = encodeURIComponent(statePayload)
    const targetUrl = `${RIDI_LOGIN_URL}?state=${stateQ}`

    log(`Opening browser to: ${targetUrl}`)
    log('\n=== Login Instructions ===')
    log('1. Log in to Ridi Books in the opened browser window.')
    log(
      '2. After logging in, you will be redirected to a page showing JSON text (device list).'
    )
    log('3. Copy ALL the JSON text displayed on that page.')
    log('4. Paste it below and press Enter.')

    await open.default(targetUrl)

    const rl = createInterface({ input: stdin, output: stdout })

    rl.question('\nPaste JSON > ', jsonInput => {
      rl.close()
      if (!jsonInput.trim()) {
        warning('No data entered.')
        return
      }
      this.processDeviceList(jsonInput.trim())
    })
  }

  private static formatLastUsed(lastUsedRaw: string | null): string {
    if (!lastUsedRaw) return 'N/A'
    try {
      const dt = new Date(lastUsedRaw)
      return dt.toLocaleString()
    } catch {
      return lastUsedRaw
    }
  }

  private displayDevices(devices: UserDevice[]): void {
    const terminalWidth = getTerminalWidth()

    const fixedWidth = 4 + 3 + 5
    const deviceIdWidth = 40
    const codeWidth = 10

    const remaining = Math.max(
      terminalWidth - fixedWidth - deviceIdWidth - codeWidth,
      30
    )
    const deviceNameWidth = Math.max(Math.floor(remaining * 0.4), 15)
    const lastUsedWidth = Math.max(remaining - deviceNameWidth, 15)

    console.log('\nSelect the device you are using for this machine:')
    console.log(
      `${'No.'.padEnd(4)} ${'Device Name'.padEnd(deviceNameWidth)} ${'Device ID'.padEnd(
        deviceIdWidth
      )} ${'Code'.padEnd(codeWidth)} ${'Last Used'.padEnd(lastUsedWidth)}`
    )
    console.log(
      '-'.repeat(
        Math.min(
          terminalWidth,
          4 + deviceNameWidth + deviceIdWidth + codeWidth + lastUsedWidth + 4
        )
      )
    )

    for (let idx = 0; idx < devices.length; idx++) {
      const dev = devices[idx]
      const lastUsed = AuthCommand.formatLastUsed(dev.last_used)
      const deviceNameRaw = dev.device_nick || 'Unknown'
      const deviceId = dev.device_id

      const deviceName = truncateText(deviceNameRaw, deviceNameWidth)
      const deviceIdDisplay = truncateText(deviceId, deviceIdWidth)
      const lastUsedDisplay = truncateText(lastUsed, lastUsedWidth)

      const deviceNamePadded =
        deviceName + ' '.repeat(deviceNameWidth - displayWidth(deviceName))
      const deviceIdPadded =
        deviceIdDisplay +
        ' '.repeat(deviceIdWidth - displayWidth(deviceIdDisplay))
      const lastUsedPadded =
        lastUsedDisplay +
        ' '.repeat(lastUsedWidth - displayWidth(lastUsedDisplay))

      console.log(
        `${String(idx + 1).padEnd(4)} ${deviceNamePadded} ${deviceIdPadded} ${dev.device_code.padEnd(
          codeWidth
        )} ${lastUsedPadded}`
      )
    }
    console.log(
      '-'.repeat(
        Math.min(
          terminalWidth,
          4 + deviceNameWidth + deviceIdWidth + codeWidth + lastUsedWidth + 4
        )
      )
    )
  }

  private selectDevice(devices: UserDevice[]): Promise<UserDevice> {
    return new Promise(resolve => {
      const rl = createInterface({ input: stdin, output: stdout })
      const ask = () => {
        rl.question('\nEnter number: ', line => {
          const sel = parseInt(line, 10)
          if (sel >= 1 && sel <= devices.length) {
            rl.close()
            resolve(devices[sel - 1])
          } else {
            warning('Invalid selection.')
            ask()
          }
        })
      }
      ask()
    })
  }

  private async processDeviceList(jsonStr: string): Promise<void> {
    try {
      let cleaned = jsonStr
      if (!jsonStr.startsWith('{')) {
        const start = jsonStr.indexOf('{')
        if (start !== -1) {
          cleaned = jsonStr.substring(start)
        }
      }

      const data = JSON.parse(cleaned) as UserDevices
      const devices = data.user_devices || []

      if (devices.length === 0) {
        error('No devices found in the provided JSON.')
        return
      }

      this.displayDevices(devices)
      const target = await this.selectDevice(devices)

      const userIdx = String(target.user_idx)
      const deviceId = target.device_id
      const deviceName = target.device_nick

      if (userIdx && deviceId) {
        this.configMgr.addUser(userIdx, deviceId, deviceName)
        log(`Successfully added user ${userIdx} (Device: ${deviceId})`)
      } else {
        error('Error: Invalid device data in selection.')
      }
    } catch (e) {
      error('Invalid JSON format. Please ensure you copied the text correctly.')
    }
  }

  async switch(): Promise<void> {
    const users = this.configMgr.listUsers()
    if (users.length === 0) {
      log('No users found.')
      return
    }

    console.log('\nRegistered Users:')
    for (let idx = 0; idx < users.length; idx++) {
      const user = users[idx]
      const isActive = user.id === this.configMgr.config.active_user
      const active = isActive ? '*' : ' '
      console.log(
        `${active} ${idx + 1}. ${user.user_idx} (${user.device_name})`
      )
    }

    const rl = createInterface({ input: stdin, output: stdout })
    rl.question('\nSelect user to switch to: ', line => {
      rl.close()
      const sel = parseInt(line, 10)
      if (sel >= 1 && sel <= users.length) {
        const targetUser = users[sel - 1]
        if (this.configMgr.switchUser(targetUser.id)) {
          log(`Switched to user ${targetUser.user_idx}`)
        }
      } else {
        warning('Invalid selection.')
      }
    })
  }

  listAccounts(): void {
    const users = this.configMgr.listUsers()
    if (users.length === 0) {
      log('No users found.')
      return
    }
    console.log('\nRegistered Users:')
    for (const user of users) {
      const isActive = user.id === this.configMgr.config.active_user
      const active = isActive ? '*' : ' '
      console.log(
        `${active} [${user.id}] User: ${user.user_idx}, Device: ${user.device_name}`
      )
    }
  }

  logout(): void {
    const activeUserId = this.configMgr.config.active_user
    if (!activeUserId) {
      log('No active user.')
      return
    }
    if (this.configMgr.removeUser(activeUserId)) {
      log('User removed.')
    } else {
      error('Failed to remove user.')
    }
  }
}

class BooksCommand {
  private configMgr: ConfigManager

  constructor(configMgr: ConfigManager) {
    this.configMgr = configMgr
  }

  async run(nameFilter?: string, idFilter?: string): Promise<void> {
    const active = this.configMgr.getActiveUser()
    if (!active) {
      error('No active user. Please login first.')
      return
    }

    const userIdx = active.user_idx
    const deviceId = active.device_id

    try {
      let infos = getAvailableBooks(userIdx)
      if (infos.length === 0) return

      infos = filterById(infos, idFilter)
      if (infos.length === 0) return

      const results = await this.scanBookTitles(infos, deviceId, nameFilter)
      if (results.length === 0) {
        warning('No books matched criteria.')
        return
      }

      this.displayBooks(results)
    } catch (e) {
      error(`Error: ${e}`)
    }
  }

  private async scanBookTitles(
    infos: BookInfo[],
    deviceId: string,
    nameFilter?: string
  ): Promise<Array<[string, string]>> {
    const results: Array<[string, string]> = []
    log(`Scanning ${infos.length} books for metadata...`)

    for (let i = 0; i < infos.length; i++) {
      const book = infos[i]
      try {
        process.stderr.write(
          `\rProcessing ${i + 1}/${infos.length}: ${book.id}`
        )

        const key = decryptKey(book, deviceId)
        const content = decryptBook(book, key)
        const title =
          (await extractTitle(book.format, content)) || 'Unknown Title'

        if (nameFilter && !title.includes(nameFilter)) {
          continue
        }

        results.push([book.id, title])
      } catch (e) {
        if (!nameFilter) {
          results.push([book.id, `[Error: ${e}]`])
        }
      }
    }

    process.stderr.write('\r' + ' '.repeat(50) + '\r')
    return results
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

class ExportCommand {
  private configMgr: ConfigManager

  constructor(configMgr: ConfigManager) {
    this.configMgr = configMgr
  }

  async run(
    outputDir: string,
    nameFilter?: string,
    idFilter?: string
  ): Promise<void> {
    const active = this.configMgr.getActiveUser()
    if (!active) {
      error('No active user. Please login first.')
      return
    }

    const userIdx = active.user_idx
    const deviceId = active.device_id

    try {
      let infos = getAvailableBooks(userIdx)
      if (infos.length === 0) return

      let candidates = filterById(infos, idFilter)
      if (candidates.length === 0) return

      candidates = await filterByName(candidates, deviceId, nameFilter)
      if (candidates.length === 0) {
        warning('No books found matching criteria.')
        return
      }

      log(`Found ${candidates.length} books. Preparing to export...`)
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true })
      }

      let successCount = 0
      for (const b of candidates) {
        const success = await decryptWithProgress(b, deviceId, false, outputDir)
        if (success) successCount++
      }
      log(
        `\nExport completed. ${successCount}/${candidates.length} books exported to ${outputDir}`
      )
    } catch (e) {
      error(`Error during export: ${e}`)
    }
  }
}

async function main(): Promise<void> {
  const program = new Command()
  program.name('ridi').description('Ridi Books DRM Remover CLI Utility')

  const authCmd = program.command('auth').description('Manage authentication')
  authCmd
    .command('login')
    .description('Login to Ridi account')
    .action(async () => {
      const configMgr = new ConfigManager(CONFIG_FILE)
      const auth = new AuthCommand(configMgr)
      await auth.login()
    })
  authCmd
    .command('logout')
    .description('Logout current account')
    .action(() => {
      const configMgr = new ConfigManager(CONFIG_FILE)
      const auth = new AuthCommand(configMgr)
      auth.logout()
    })
  authCmd
    .command('switch')
    .description('Switch between accounts')
    .action(async () => {
      const configMgr = new ConfigManager(CONFIG_FILE)
      const auth = new AuthCommand(configMgr)
      await auth.switch()
    })
  authCmd
    .command('list')
    .description('List accounts')
    .action(() => {
      const configMgr = new ConfigManager(CONFIG_FILE)
      const auth = new AuthCommand(configMgr)
      auth.listAccounts()
    })

  program
    .command('books')
    .description('List downloaded books')
    .option('-n, --name <name>', 'Filter by book title (partial match)')
    .option('-i, --id <id>', 'Filter by book ID (exact match)')
    .action(async options => {
      const configMgr = new ConfigManager(CONFIG_FILE)
      const books = new BooksCommand(configMgr)
      await books.run(options.name, options.id)
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
      const configMgr = new ConfigManager(CONFIG_FILE)
      const exp = new ExportCommand(configMgr)
      await exp.run(options.output, options.name, options.id)
    })

  await program.parseAsync(process.argv)
}

main().catch(e => {
  console.error(e)
})
