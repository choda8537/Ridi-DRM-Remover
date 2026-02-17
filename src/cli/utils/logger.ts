import pc from 'picocolors'

export const logger = {
  info: (message: string) => {
    console.log(`${pc.blue('info')} ${message}`)
  },
  success: (message: string) => {
    console.log(`${pc.green('success')} ${message}`)
  },
  warn: (message: string) => {
    console.warn(`${pc.yellow('warn')} ${message}`)
  },
  error: (message: string) => {
    console.error(`${pc.red('error')} ${message}`)
  },
  debug: (message: string) => {
    if (process.env.DEBUG) {
      console.log(`${pc.magenta('debug')} ${message}`)
    }
  }
}
