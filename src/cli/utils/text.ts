/**
 * Calculate the display width of characters (2 for CJK, 1 for others)
 */
export function displayWidth(text: string): number {
  let width = 0
  for (const char of text) {
    const code = char.codePointAt(0) || 0
    if (
      (code >= 0x1100 && code <= 0x115f) ||
      (code >= 0x2e80 && code <= 0xa4cf && code !== 0x303f) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe10 && code <= 0xfe19) ||
      (code >= 0xfe30 && code <= 0xfe6f) ||
      (code >= 0xff00 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6) ||
      (code >= 0x20000 && code <= 0x2fffd) ||
      (code >= 0x30000 && code <= 0x3fffd)
    ) {
      width += 2
    } else {
      width += 1
    }
  }
  return width
}

/**
 * Truncate text to fit maximum width (adds ".." if exceeded)
 */
export function truncateText(text: string, maxWidth: number): string {
  if (maxWidth < 3) {
    return ''
  }

  let currentWidth = 0
  const result: string[] = []

  for (const char of text) {
    const code = char.codePointAt(0) || 0
    const charWidth =
      (code >= 0x1100 && code <= 0x115f) ||
      (code >= 0x2e80 && code <= 0xa4cf && code !== 0x303f) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe10 && code <= 0xfe19) ||
      (code >= 0xfe30 && code <= 0xfe6f) ||
      (code >= 0xff00 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6) ||
      (code >= 0x20000 && code <= 0x2fffd) ||
      (code >= 0x30000 && code <= 0x3fffd)
        ? 2
        : 1

    if (currentWidth + charWidth > maxWidth - 2) {
      result.push('..')
      break
    }

    result.push(char)
    currentWidth += charWidth
  }

  return result.join('')
}
