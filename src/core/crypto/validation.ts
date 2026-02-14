import { BookFormat } from '@/core/book/types'

export function isValidOutput(fmt: BookFormat, data: Buffer): boolean {
  if (fmt === BookFormat.EPUB) {
    return (
      data.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) ||
      data.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x05, 0x06])) ||
      data.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x07, 0x08]))
    )
  } else if (fmt === BookFormat.PDF) {
    return data.subarray(0, 4).equals(Buffer.from('%PDF'))
  }
  return false
}

export function removePKCS7Padding(data: Buffer): Buffer {
  const paddingLength = data[data.length - 1]
  if (paddingLength > 16 || paddingLength === 0) {
    throw new Error('Invalid PKCS7 padding')
  }
  for (let i = 1; i <= paddingLength; i++) {
    if (data[data.length - i] !== paddingLength) {
      throw new Error('Invalid PKCS7 padding')
    }
  }
  return data.subarray(0, data.length - paddingLength)
}
