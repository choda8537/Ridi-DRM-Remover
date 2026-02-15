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
