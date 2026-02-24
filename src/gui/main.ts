import 'dotenv/config'
import electron from 'electron'
const { app, BrowserWindow } = electron
import * as path from 'path'
import { fileURLToPath } from 'url'
import { setupIpcHandlers } from './services/ipc-handlers.js'
import { CONFIG_FILE } from '../shared/constants.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function createWindow() {
  const isDev = process.env.NODE_ENV !== 'production'

  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#1C1C1C',
    show: false,
    webPreferences: {
      preload: isDev
        ? path.join(__dirname, 'dist', 'preload.js')
        : path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    app.quit()
  })
}

app.whenReady().then(() => {
  setupIpcHandlers(CONFIG_FILE)
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})