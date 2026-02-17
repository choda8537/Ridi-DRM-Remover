/*
 * Copyright 2026 meherpraveen
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * This file contains code derived from:
 * - https://github.com/Retro-Rex8/Ridi-DRM-Remover (Apache-2.0)
 * - https://github.com/hsj1/ridiculous (CC0 1.0 Universal)
 */
import { createDecipheriv } from 'crypto'
import { existsSync, readFileSync } from 'fs'

import { BookInfo } from '@/core/book/book-info'
import { FileKind } from '@/core/book/types'

import { isValidOutput, removePKCS7Padding } from './validation'

export function decryptKey(bookInfo: BookInfo, deviceId: string): Buffer {
  const dataPath = bookInfo.getFile(FileKind.DATA)
  if (!existsSync(dataPath)) {
    throw new Error(`Missing data file: ${dataPath}`)
  }

  const data = readFileSync(dataPath)
  const key = Buffer.from(deviceId.substring(0, 16), 'utf-8')
  const iv = data.subarray(0, 16)

  const decipher = createDecipheriv('aes-128-cbc', key, iv)
  decipher.setAutoPadding(false)
  const decrypted = Buffer.concat([
    decipher.update(data.subarray(16)),
    decipher.final()
  ])

  const plaintext = removePKCS7Padding(decrypted)

  if (plaintext.length < 84) {
    throw new Error(`.dat plaintext too short: ${plaintext.length} bytes`)
  }

  const sessionKey = Buffer.from(
    plaintext.subarray(68, 84).toString('utf-8', 0, 16),
    'utf-8'
  )
  if (sessionKey.length !== 16) {
    throw new Error('Invalid session key length')
  }

  return sessionKey
}

export function decryptBook(bookInfo: BookInfo, key: Buffer): Buffer {
  const bookFilePath = bookInfo.getFile(FileKind.BOOK)

  if (!existsSync(bookFilePath)) {
    throw new Error(`Book file not found: ${bookFilePath}`)
  }

  const raw = readFileSync(bookFilePath)

  if (isValidOutput(bookInfo.format, raw)) {
    return raw
  }

  if (raw.length < 16) {
    throw new Error('Book file too small to contain IV')
  }

  const iv = raw.subarray(0, 16)
  const decipher = createDecipheriv('aes-128-cbc', key, iv)
  decipher.setAutoPadding(false)
  const decrypted = Buffer.concat([
    decipher.update(raw.subarray(16)),
    decipher.final()
  ])

  return removePKCS7Padding(decrypted)
}
