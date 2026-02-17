import { stdin, stdout } from 'process'
import { createInterface } from 'readline'
import * as open from 'open'
import { table } from 'table'

import { logger } from '@/cli/utils/logger'
import { AuthService } from '@/core/auth/auth-service'
import { UserDevice } from '@/core/auth/types'

export class AuthCommandCLI {
  constructor(private authService: AuthService) {}

  async login(manual: boolean = false): Promise<void> {
    if (!manual && (await this.attemptAutoLogin())) return
    await this.performManualLogin()
  }

  async switch(): Promise<void> {
    const users = this.authService.listUsers()
    if (users.length === 0) {
      logger.info('No users found.')
      return
    }

    const activeUserId = this.authService.getActiveUser()?.id
    this.displayUserList(users, activeUserId)

    const selectedUser = await this.promptUserSelection(users)
    if (selectedUser && this.authService.switchUser(selectedUser.id)) {
      logger.success(`Switched to user ${selectedUser.user_idx}`)
    } else {
      logger.warn('Invalid selection.')
    }
  }

  listAccounts(json: boolean = false): void {
    const users = this.authService.listUsers()
    if (users.length === 0) {
      if (json) {
        console.log('[]')
      } else {
        logger.info('No users found.')
      }
      return
    }

    if (json) {
      console.log(JSON.stringify(users, null, 2))
      return
    }

    const activeUserId = this.authService.getActiveUser()?.id
    logger.info('Registered Users:')

    const headers = ['Active', 'ID', 'User Index', 'Device Name']
    const rows = users.map(user => [
      user.id === activeUserId ? '*' : '',
      user.id,
      user.user_idx,
      user.device_name || 'Unknown'
    ])

    console.log(table([headers, ...rows]))
  }

  logout(): void {
    const activeUser = this.authService.getActiveUser()
    if (!activeUser) {
      logger.info('No active user.')
      return
    }

    if (this.authService.removeUser(activeUser.id)) {
      logger.success('User removed.')
    } else {
      logger.error('Failed to remove user.')
    }
  }

  private async attemptAutoLogin(): Promise<boolean> {
    logger.info('Attempting automatic login using Ridibooks App data...')
    const autoLoginResult = await this.authService.autoLogin()

    if (!autoLoginResult) {
      logger.warn('Automatic login failed. Falling back to manual login.')
      return false
    }

    this.authService.addDevice(autoLoginResult.device)
    logger.success(
      `Successfully logged in automatically: ${autoLoginResult.username} (Device: ${autoLoginResult.device.device_id})`
    )
    return true
  }

  private async performManualLogin(): Promise<void> {
    const url = this.authService.getLoginUrl()
    this.displayManualLoginInstructions(url)

    await open.default(url)

    const jsonInput = await this.promptJsonInput()
    if (!jsonInput) {
      logger.warn('No data entered.')
      return
    }

    try {
      const devices = this.authService.parseDeviceList(jsonInput)
      if (devices.length === 0) {
        logger.error('No devices found in the provided JSON.')
        return
      }

      this.displayDevices(devices)
      const selected = await this.selectDevice(devices)
      this.authService.addDevice(selected)
      logger.success(
        `Successfully added user ${selected.user_idx} (Device: ${selected.device_id})`
      )
    } catch {
      logger.error(
        'Invalid JSON format. Please ensure you copied the text correctly.'
      )
    }
  }

  private displayManualLoginInstructions(url: string): void {
    logger.info(`Opening browser to: ${url}`)
    console.log('\n=== Login Instructions ===')
    console.log('1. Log in to Ridi Books in the opened browser window.')
    console.log(
      '2. After logging in, you will be redirected to a page showing JSON text (device list).'
    )
    console.log('3. Copy ALL the JSON text displayed on that page.')
    console.log('4. Paste it below and press Enter.')
  }

  private promptJsonInput(): Promise<string> {
    return new Promise(resolve => {
      const rl = createInterface({ input: stdin, output: stdout })
      rl.question('\nPaste JSON > ', input => {
        rl.close()
        resolve(input.trim())
      })
    })
  }

  private displayDevices(devices: UserDevice[]): void {
    logger.info('Select the device you are using for this machine:')

    const headers = ['No.', 'Device Name', 'Device ID', 'Code', 'Last Used']
    const rows = devices.map((device, index) => [
      String(index + 1),
      device.device_nick || 'Unknown',
      device.device_id,
      device.device_code,
      this.formatLastUsed(device.last_used)
    ])

    console.log(table([headers, ...rows]))
  }

  private formatLastUsed(lastUsedRaw: string | null): string {
    if (!lastUsedRaw) return 'N/A'

    try {
      return new Date(lastUsedRaw).toLocaleString()
    } catch {
      return lastUsedRaw
    }
  }

  private selectDevice(devices: UserDevice[]): Promise<UserDevice> {
    return new Promise(resolve => {
      const rl = createInterface({ input: stdin, output: stdout })

      const askForSelection = () => {
        rl.question('\nEnter number: ', input => {
          const selection = parseInt(input, 10)

          if (selection >= 1 && selection <= devices.length) {
            rl.close()
            resolve(devices[selection - 1])
          } else {
            logger.warn('Invalid selection.')
            askForSelection()
          }
        })
      }

      askForSelection()
    })
  }

  private displayUserList(
    users: Array<{ id: string; user_idx: string; device_name: string | null }>,
    activeUserId?: string
  ): void {
    logger.info('Registered Users:')
    users.forEach((user, index) => {
      const marker = user.id === activeUserId ? '*' : ' '
      const deviceName = user.device_name || 'Unknown'
      console.log(`${marker} ${index + 1}. ${user.user_idx} (${deviceName})`)
    })
  }

  private promptUserSelection(
    users: Array<{ id: string; user_idx: string }>
  ): Promise<(typeof users)[0] | null> {
    return new Promise(resolve => {
      const rl = createInterface({ input: stdin, output: stdout })

      rl.question('\nSelect user to switch to: ', input => {
        rl.close()
        const selection = parseInt(input, 10)

        if (selection >= 1 && selection <= users.length) {
          resolve(users[selection - 1])
        } else {
          resolve(null)
        }
      })
    })
  }
}
