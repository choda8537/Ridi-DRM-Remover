import { createDecipheriv } from 'crypto'
import { readFileSync, existsSync } from 'fs'
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
