import electron from 'electron'
const { ipcMain, dialog, shell } = electron
import path from 'path'
import fs from 'fs'
import { AuthService } from '../../core/auth/auth-service.js'
import { AppAuthService } from '../../core/auth/app-auth-service.js'
import { BookInfo } from '../../core/book/book-info.js'
import { BookService } from '../../core/book/book-service.js'
import { ExportService } from '../../core/crypto/export-service.js'
import { ConfigService } from '../../core/config/config-service.js'
import {
  RIDI_OAUTH_CLIENT_ID,
  RIDI_OAUTH_CLIENT_SECRET
} from '../../shared/constants.js'

export function setupIpcHandlers(configPath: string) {
  const configService = new ConfigService(configPath)
  const authService = new AuthService(configService)
  const bookService = new BookService()
  const exportService = new ExportService()

  ipcMain.handle('auth:getLoginUrl', () => {
    return authService.getLoginUrl()
  })

  ipcMain.handle('auth:parseDeviceList', (_: any, jsonInput: string) => {
    return authService.parseDeviceList(jsonInput)
  })

  ipcMain.handle('auth:addDevice', (_: any, device: any) => {
    authService.addDevice(device)
  })

  ipcMain.handle('auth:autoLogin', async () => {
    const diagnostics: string[] = []

    try {
      diagnostics.push('[1/4] 앱 인증 데이터 확인 중...')
      const appAuthService = new AppAuthService()
      const appAuth = await appAuthService.getAppAuthData()

      if (!appAuth) {
        const deviceOnlyAuth = await appAuthService.getDeviceIdOnly()
        if (deviceOnlyAuth) {
          diagnostics.push(`[1/4] ⚠️ refreshToken 없음 — deviceId만 확인됨: ${deviceOnlyAuth.deviceId.substring(0, 8)}...`)
          diagnostics.push('[1/4] ℹ️ 이미 등록된 사용자가 없어 수동 등록이 필요합니다')
          console.warn('[autoLogin]', diagnostics.join('\n'))
          return { success: false, diagnostics }
        }
        diagnostics.push('[1/4] ❌ 앱 인증 데이터를 찾을 수 없음 (Ridi 앱이 설치/로그인 되어있는지 확인)')
        console.error('[autoLogin]', diagnostics.join('\n'))
        return { success: false, diagnostics }
      }
      diagnostics.push(`[1/4] ✅ 인증 데이터 확인됨 — 사용자: ${appAuth.username}, 디바이스: ${appAuth.deviceId.substring(0, 8)}...`)

      diagnostics.push('[2/4] OAuth 자격증명 확인 중...')
      if (!RIDI_OAUTH_CLIENT_ID || !RIDI_OAUTH_CLIENT_SECRET) {
        diagnostics.push('[2/4] ❌ OAuth 자격증명 누락 (RIDI_OAUTH_CLIENT_ID / RIDI_OAUTH_CLIENT_SECRET 환경변수 필요)')
        console.error('[autoLogin]', diagnostics.join('\n'))
        return { success: false, diagnostics }
      }
      diagnostics.push('[2/4] ✅ OAuth 자격증명 확인됨')

      diagnostics.push('[3/4] 토큰 갱신 및 디바이스 조회 중...')
      const result = await authService.autoLogin()

      if (!result) {
        diagnostics.push('[3/4] ❌ 토큰 갱신 또는 디바이스 매칭 실패')
        console.error('[autoLogin]', diagnostics.join('\n'))
        return { success: false, diagnostics }
      }
      diagnostics.push(`[3/4] ✅ 로그인 성공 — ${result.username}`)

      diagnostics.push('[4/4] 디바이스 정보 저장 중...')
      authService.addDevice(result.device)
      diagnostics.push('[4/4] ✅ 저장 완료')

      console.log('[autoLogin] 성공:', diagnostics.join('\n'))
      return {
        success: true,
        device: result.device,
        username: result.username,
        diagnostics
      }
    } catch (err) {
      diagnostics.push(`❌ 예외 발생: ${(err as Error).message}`)
      console.error('[autoLogin] 예외:', err)
      return { success: false, diagnostics }
    }
  })

  ipcMain.handle('auth:listUsers', () => {
    return authService.listUsers()
  })

  ipcMain.handle('auth:switchUser', (_: any, userId: string) => {
    return authService.switchUser(userId)
  })

  ipcMain.handle('auth:removeUser', (_: any, userId: string) => {
    return authService.removeUser(userId)
  })

  ipcMain.handle('auth:getActiveUser', () => {
    return authService.getActiveUser()
  })

  ipcMain.handle('books:getAvailableBooks', async (_event: any) => {
    const user = configService.getActiveUser()
    console.log('[books] activeUser:', JSON.stringify(user))
    if (!user) {
      console.log('[books] ❌ 활성 사용자 없음')
      return []
    }

    const appdata = process.env.APPDATA
    const libPath = path.join(appdata || '', 'Ridibooks', 'library', `_${user.user_idx}`)
    console.log('[books] 탐색 경로:', libPath)
    console.log('[books] 경로 존재:', fs.existsSync(libPath))

    const libraryRoot = path.join(appdata || '', 'Ridibooks', 'library')
    if (fs.existsSync(libraryRoot)) {
      const dirs = fs.readdirSync(libraryRoot)
      console.log('[books] library/ 하위 폴더:', dirs)
    } else {
      console.log('[books] ❌ library 폴더 자체가 없음:', libraryRoot)
      const ridiRoot = path.join(appdata || '', 'Ridibooks')
      if (fs.existsSync(ridiRoot)) {
        const ridiDirs = fs.readdirSync(ridiRoot)
        console.log('[books] Ridibooks/ 하위:', ridiDirs)
      } else {
        console.log('[books] ❌ Ridibooks 폴더 없음:', ridiRoot)
      }
    }

    try {
      const books = bookService.getAvailableBooks(user.user_idx)
      console.log('[books] 발견된 책:', books.length)
      const booksWithMeta = await bookService.getBooksWithMetadata(books, user.device_id)
      return booksWithMeta
    } catch (err) {
      console.error('[books] 에러:', (err as Error).message)
      return []
    }
  })

  ipcMain.handle('export:exportBook', async (event: any, book: any, deviceId: string, outputDir: string) => {
    const bookInfo = new BookInfo(book.path)
    return exportService.exportBook(bookInfo, deviceId, outputDir, (progress: any) => {
      event.sender.send('export:progress', progress)
    })
  })

  ipcMain.handle('export:exportBooks', async (event: any, books: any[], deviceId: string, outputDir: string) => {
    const bookInfos = books.map((b: any) => new BookInfo(b.path))
    return exportService.exportBooks(bookInfos, deviceId, outputDir, (progress: any) => {
      event.sender.send('export:progress', progress)
    })
  })

  ipcMain.handle('util:selectFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('util:openExternal', (_: any, url: string) => {
    return shell.openExternal(url)
  })

  ipcMain.handle('books:getAvailableBooksForUser', async (_: any, userId: string) => {
    try {
      const books = bookService.getAvailableBooks(userId)
      const activeUser = configService.getActiveUser()
      const deviceId = activeUser?.device_id || ''
      return bookService.getBooksWithMetadata(books, deviceId)
    } catch (err) {
      console.error('[books:getAvailableBooksForUser] 에러:', (err as Error).message)
      return []
    }
  })

  ipcMain.handle('user:getActiveUser', () => authService.getActiveUser())
  ipcMain.handle('user:switchUser', (_: any, userId: string) => authService.switchUser(userId))
  ipcMain.handle('user:removeUser', (_: any, userId: string) => authService.removeUser(userId))
  ipcMain.handle('user:listUsers', () => authService.listUsers())

  const tokenStore = new Map<string, any>()
  ipcMain.handle('auth:getToken', (_: any, userId: string) => tokenStore.get(userId) ?? null)
  ipcMain.handle('auth:saveToken', (_: any, userId: string, token: any) => { tokenStore.set(userId, token) })
  ipcMain.handle('auth:removeToken', (_: any, userId: string) => { tokenStore.delete(userId) })
}