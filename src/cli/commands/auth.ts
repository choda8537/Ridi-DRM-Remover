import { stdin, stdout } from 'process'
import { createInterface } from 'readline'
import * as open from 'open'
import { AuthService } from '@/core/auth/auth-service'
import { UserDevice } from '@/core/auth/types'
import { displayWidth, truncateText } from '@/cli/utils/text'
import { getTerminalWidth } from '@/cli/utils/terminal'

export class AuthCommandCLI {
  constructor(private authService: AuthService) {}

  async login(): Promise<void> {
    const url = this.authService.getLoginUrl()

    console.log(`Opening browser to: ${url}`)
    console.log('\n=== Login Instructions ===')
    console.log('1. Log in to Ridi Books in the opened browser window.')
    console.log(
      '2. After logging in, you will be redirected to a page showing JSON text (device list).'
    )
    console.log('3. Copy ALL the JSON text displayed on that page.')
    console.log('4. Paste it below and press Enter.')

    await open.default(url)

    const rl = createInterface({ input: stdin, output: stdout })

    rl.question('\nPaste JSON > ', async jsonInput => {
      rl.close()
      if (!jsonInput.trim()) {
        console.warn('No data entered.')
        return
      }

      try {
        const devices = this.authService.parseDeviceList(jsonInput.trim())
        if (devices.length === 0) {
          console.error('No devices found in the provided JSON.')
          return
        }

        this.displayDevices(devices)
        const selected = await this.selectDevice(devices)
        this.authService.addDevice(selected)
        console.log(
          `Successfully added user ${selected.user_idx} (Device: ${selected.device_id})`
        )
      } catch (e) {
        console.error(
          'Invalid JSON format. Please ensure you copied the text correctly.'
        )
      }
    })
  }

  private formatLastUsed(lastUsedRaw: string | null): string {
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
      const lastUsed = this.formatLastUsed(dev.last_used)
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
            console.warn('Invalid selection.')
            ask()
          }
        })
      }
      ask()
    })
  }

  async switch(): Promise<void> {
    const users = this.authService.listUsers()
    if (users.length === 0) {
      console.log('No users found.')
      return
    }

    const activeUserId = this.authService.getActiveUser()?.id

    console.log('\nRegistered Users:')
    for (let idx = 0; idx < users.length; idx++) {
      const user = users[idx]
      const isActive = user.id === activeUserId
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
        if (this.authService.switchUser(targetUser.id)) {
          console.log(`Switched to user ${targetUser.user_idx}`)
        }
      } else {
        console.warn('Invalid selection.')
      }
    })
  }

  listAccounts(): void {
    const users = this.authService.listUsers()
    if (users.length === 0) {
      console.log('No users found.')
      return
    }

    const activeUserId = this.authService.getActiveUser()?.id

    console.log('\nRegistered Users:')
    for (const user of users) {
      const isActive = user.id === activeUserId
      const active = isActive ? '*' : ' '
      console.log(
        `${active} [${user.id}] User: ${user.user_idx}, Device: ${user.device_name}`
      )
    }
  }

  logout(): void {
    const activeUser = this.authService.getActiveUser()
    if (!activeUser) {
      console.log('No active user.')
      return
    }
    if (this.authService.removeUser(activeUser.id)) {
      console.log('User removed.')
    } else {
      console.error('Failed to remove user.')
    }
  }
}
