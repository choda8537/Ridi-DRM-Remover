const UNSAFE_CHARS = /[\\/:*?"<>|]/g
const WHITESPACE_RUN = /\s+/g
const WINDOWS_RESERVED = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9'
])

export function sanitizeFilename(name: string, maxLen: number = 120): string {
  let sanitized = name.trim().replace(UNSAFE_CHARS, ' ')
  sanitized = sanitized.replace(WHITESPACE_RUN, ' ').trim()
  if (sanitized.length > maxLen) {
    sanitized = sanitized.substring(0, maxLen).trimEnd()
  }
  if (WINDOWS_RESERVED.has(sanitized.toUpperCase())) {
    sanitized = `_${sanitized}`
  }
  return sanitized || 'untitled'
}
