import { ConfigService } from '@/core/config/config-service'
import {
  RIDI_LOGIN_URL,
  RIDI_OAUTH_CLIENT_ID,
  RIDI_OAUTH_CLIENT_SECRET,
  RIDI_OAUTH_TOKEN_API,
  RIDI_USER_DEVICES_API
} from '@/shared/constants'

import { AppAuthService } from './app-auth-service'
import { UserDevice, UserDevices } from './types'

const USER_AGENT = 'Ridibooks/0.11.7 (Windows NT 10.0; Win64; x64)'

interface TokenResponse {
  access_token: string
  user: {
    idx: number
    id: string
  }
}

export interface AutoLoginResult {
  device: UserDevice
  username: string
}

export class AuthService {
  private appAuthService: AppAuthService

  constructor(private configService: ConfigService) {
    this.appAuthService = new AppAuthService()
  }

  getLoginUrl(): string {
    const statePayload = JSON.stringify({ return_url: RIDI_USER_DEVICES_API })
    const stateEncoded = encodeURIComponent(statePayload)
    return `${RIDI_LOGIN_URL}?state=${stateEncoded}`
  }

  async autoLogin(): Promise<AutoLoginResult | null> {
    const appAuth = await this.appAuthService.getAppAuthData()
    if (!appAuth) return null

    const credentials = this.getOAuthCredentials()
    if (!credentials) return null

    try {
      const tokenResponse = await this.refreshAccessToken(
        appAuth.refreshToken,
        appAuth.deviceId,
        credentials
      )
      if (!tokenResponse) return null

      const devices = await this.fetchUserDevices(tokenResponse.access_token)
      const device = this.findMatchingDevice(devices, appAuth.deviceId)

      if (!device) return null

      return {
        device,
        username: appAuth.username
      }
    } catch {
      return null
    }
  }

  parseDeviceList(jsonInput: string): UserDevice[] {
    const cleaned = this.cleanJsonInput(jsonInput)
    const data = JSON.parse(cleaned) as UserDevices
    return data.user_devices || []
  }

  addDevice(device: UserDevice): void {
    this.configService.addUser(
      String(device.user_idx),
      device.device_id,
      device.device_nick
    )
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

  private getOAuthCredentials(): {
    clientId: string
    clientSecret: string
  } | null {
    if (!RIDI_OAUTH_CLIENT_ID || !RIDI_OAUTH_CLIENT_SECRET) return null

    return {
      clientId: RIDI_OAUTH_CLIENT_ID,
      clientSecret: RIDI_OAUTH_CLIENT_SECRET
    }
  }

  private async refreshAccessToken(
    refreshToken: string,
    deviceId: string,
    credentials: { clientId: string; clientSecret: string }
  ): Promise<TokenResponse | null> {
    const response = await fetch(RIDI_OAUTH_TOKEN_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        device_id: deviceId
      })
    })

    if (!response.ok) return null

    const json = (await response.json()) as TokenResponse
    return json
  }

  private async fetchUserDevices(accessToken: string): Promise<UserDevice[]> {
    const response = await fetch(RIDI_USER_DEVICES_API, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': USER_AGENT
      }
    })

    if (!response.ok) return []

    const data = (await response.json()) as UserDevices
    return data.user_devices || []
  }

  private findMatchingDevice(
    devices: UserDevice[],
    deviceId: string
  ): UserDevice | null {
    return devices.find(device => device.device_id === deviceId) || null
  }

  private cleanJsonInput(jsonInput: string): string {
    if (jsonInput.startsWith('{')) return jsonInput

    const startIndex = jsonInput.indexOf('{')
    return startIndex !== -1 ? jsonInput.substring(startIndex) : jsonInput
  }
}
