import { ConfigService } from '@/core/config/config-service'
import { UserDevice, UserDevices } from './types'
import { RIDI_LOGIN_URL, RIDI_USER_DEVICES_API } from '@/shared/constants'

export class AuthService {
  constructor(private configService: ConfigService) {}

  getLoginUrl(): string {
    const statePayload = JSON.stringify({ return_url: RIDI_USER_DEVICES_API })
    const stateQ = encodeURIComponent(statePayload)
    return `${RIDI_LOGIN_URL}?state=${stateQ}`
  }

  parseDeviceList(jsonInput: string): UserDevice[] {
    let cleaned = jsonInput
    if (!jsonInput.startsWith('{')) {
      const start = jsonInput.indexOf('{')
      if (start !== -1) {
        cleaned = jsonInput.substring(start)
      }
    }

    const data = JSON.parse(cleaned) as UserDevices
    return data.user_devices || []
  }

  addDevice(device: UserDevice): void {
    const userIdx = String(device.user_idx)
    const deviceId = device.device_id
    const deviceName = device.device_nick
    this.configService.addUser(userIdx, deviceId, deviceName)
  }

  listUsers() {
    return this.configService.listUsers()
  }

  switchUser(userId: string): boolean {
    return this.configService.switchUser(userId)
  }

  removeUser(userId: string): boolean {
    return this.configService.removeUser(userId)
  }

  getActiveUser() {
    return this.configService.getActiveUser()
  }
}
