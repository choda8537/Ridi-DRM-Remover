import { existsSync, readFileSync } from 'fs'
import { homedir, platform } from 'os'
import { join } from 'path'
import CryptoJS from 'crypto-js'
import keytar from 'keytar'
import { z } from 'zod'

import {
  RIDI_KEYCHAIN_ACCOUNT,
  RIDI_KEYCHAIN_SERVICE,
  RIDI_SETTINGS_PAYLOAD_OFFSET
} from '@/shared/constants'

export interface AppAuthData {
  refreshToken: string
  deviceId: string
  username: string
}

const uuidSchema = z.uuid()

export class AppAuthService {
  async getAppAuthData(): Promise<AppAuthData | null> {
    try {
      const key = await this.retrieveKeychainKey()
      if (!key) return null

      const settingsPath = this.resolveSettingsPath()
      if (!settingsPath || !existsSync(settingsPath)) return null

      const encryptedData = readFileSync(settingsPath)
      const decryptedJson = this.decryptSettingsFile(encryptedData, key)
      if (!decryptedJson) return null

      return this.extractAuthData(decryptedJson)
    } catch {
      return null
    }
  }

  private async retrieveKeychainKey(): Promise<string | null> {
    try {
      const password = await keytar.getPassword(
        RIDI_KEYCHAIN_SERVICE,
        RIDI_KEYCHAIN_ACCOUNT
      )
      if (!password) return null

      return this.decodeBase64IfUuid(password) ?? password
    } catch {
      return null
    }
  }

  private decodeBase64IfUuid(encoded: string): string | null {
    try {
      const decoded = Buffer.from(encoded, 'base64').toString('utf8')
      const parseResult = uuidSchema.safeParse(decoded)
      return parseResult.success ? decoded : null
    } catch {
      return null
    }
  }

  private resolveSettingsPath(): string | null {
    const currentPlatform = platform()

    if (currentPlatform === 'win32') {
      const appData =
        process.env.APPDATA || join(homedir(), 'AppData', 'Roaming')
      return join(appData, 'Ridibooks', 'datastores', 'global', 'Settings')
    }

    if (currentPlatform === 'darwin') {
      return join(
        homedir(),
        'Library',
        'Application Support',
        'Ridibooks',
        'datastores',
        'global',
        'Settings'
      )
    }

    return null
  }

  private decryptSettingsFile(
    buffer: Buffer,
    masterKey: string
  ): string | null {
    const payload = this.extractPayload(buffer)

    return (
      this.attemptDecryptWithUuidKey(payload, masterKey) ??
      this.attemptDecryptWithDerivedKey(payload)
    )
  }

  private extractPayload(buffer: Buffer): CryptoJS.lib.WordArray {
    const rawPayload = buffer.subarray(RIDI_SETTINGS_PAYLOAD_OFFSET)
    return CryptoJS.lib.WordArray.create(new Uint8Array(rawPayload) as any)
  }

  private attemptDecryptWithUuidKey(
    payload: CryptoJS.lib.WordArray,
    key: string
  ): string | null {
    return this.decrypt(payload, key, true)
  }

  private attemptDecryptWithDerivedKey(
    payload: CryptoJS.lib.WordArray
  ): string | null {
    const derivedKey = this.deriveKeyFromSource('Settings-global')
    return this.decrypt(payload, derivedKey, false)
  }

  private deriveKeyFromSource(source: string): string {
    const hash = CryptoJS.SHA1(source).toString()
    return hash.substring(2, 18)
  }

  private decrypt(
    payload: CryptoJS.lib.WordArray,
    keyString: string,
    applyPkcs7: boolean
  ): string | null {
    try {
      const key = this.prepareKey(keyString, applyPkcs7)
      const decrypted = this.performAesDecryption(payload, key)
      const bytes = this.convertToByteArray(decrypted)

      return this.extractJsonFromBytes(bytes)
    } catch {
      return null
    }
  }

  private prepareKey(
    keyString: string,
    applyPkcs7: boolean
  ): CryptoJS.lib.WordArray {
    const key = CryptoJS.enc.Utf8.parse(keyString)

    if (applyPkcs7 && keyString.length % 16 !== 0) {
      ;(CryptoJS.pad.Pkcs7 as any).pad(key, 4)
    }

    return key
  }

  private performAesDecryption(
    payload: CryptoJS.lib.WordArray,
    key: CryptoJS.lib.WordArray
  ): CryptoJS.lib.WordArray {
    const cipherParams = CryptoJS.lib.CipherParams.create({
      ciphertext: payload
    })

    return CryptoJS.AES.decrypt(cipherParams, key, {
      mode: CryptoJS.mode.ECB,
      padding: CryptoJS.pad.NoPadding
    })
  }

  private extractJsonFromBytes(bytes: Uint8Array): string | null {
    if (bytes.length === 0) return null

    const unpadded = this.removePkcs7Padding(bytes)
    if (!unpadded) return null

    const jsonStr = Buffer.from(unpadded).toString('utf8')
    return this.isValidJson(jsonStr) ? jsonStr : null
  }

  private removePkcs7Padding(bytes: Uint8Array): Uint8Array | null {
    const paddingLength = bytes[bytes.length - 1]

    if (paddingLength < 1 || paddingLength > 16) return null

    return bytes.slice(0, bytes.length - paddingLength)
  }

  private isValidJson(str: string): boolean {
    return str.startsWith('{') && (str.includes('data') || str.includes('user'))
  }

  private convertToByteArray(wordArray: CryptoJS.lib.WordArray): Uint8Array {
    const { words, sigBytes } = wordArray
    const result = new Uint8Array(sigBytes)

    let offset = 0
    for (const word of words) {
      if (offset < sigBytes) result[offset++] = (word >> 24) & 0xff
      if (offset < sigBytes) result[offset++] = (word >> 16) & 0xff
      if (offset < sigBytes) result[offset++] = (word >> 8) & 0xff
      if (offset < sigBytes) result[offset++] = word & 0xff
    }

    return result
  }

  private extractAuthData(jsonStr: string): AppAuthData | null {
    try {
      const data = JSON.parse(jsonStr)
      const refreshToken = data?.data?.autoLogin?.refreshToken
      const deviceId = data?.data?.device?.deviceId
      const username = data?.data?.autoLogin?.username

      if (!refreshToken || !deviceId || !username) return null

      return { refreshToken, deviceId, username }
    } catch {
      return null
    }
  }
}
