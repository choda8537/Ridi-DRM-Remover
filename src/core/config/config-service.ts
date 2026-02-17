import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname } from 'path'

import { ConfigData, UserData } from './types'

export class ConfigService {
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
      const dir = dirname(this.configPath)
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
      writeFileSync(
        this.configPath,
        JSON.stringify(this.config, null, 2),
        'utf-8'
      )
    } catch (e) {
      throw new Error(`Failed to save config: ${e}`)
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
