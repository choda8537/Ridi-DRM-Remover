/**
 * Returns the current terminal width
 */
export function getTerminalWidth(): number {
  return process.stdout.columns || 80
}
