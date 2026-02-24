import { contextBridge, ipcRenderer } from 'electron'

console.log('[Preload] Electron IPC 브릿지 시작')

try {
  contextBridge.exposeInMainWorld('electronAPI', {
    auth: {
      getLoginUrl: () => ipcRenderer.invoke('auth:getLoginUrl'),
      parseDeviceList: (jsonInput: string) =>
        ipcRenderer.invoke('auth:parseDeviceList', jsonInput),
      addDevice: (device: any) =>
        ipcRenderer.invoke('auth:addDevice', device),
      listUsers: () => ipcRenderer.invoke('auth:listUsers'),
      switchUser: (userId: string) =>
        ipcRenderer.invoke('auth:switchUser', userId),
      removeUser: (userId: string) =>
        ipcRenderer.invoke('auth:removeUser', userId),
      getActiveUser: () => ipcRenderer.invoke('auth:getActiveUser'),
      autoLogin: () => ipcRenderer.invoke('auth:autoLogin'),
      getToken: (userId: string) =>
        ipcRenderer.invoke('auth:getToken', userId),
      saveToken: (userId: string, token: any) =>
        ipcRenderer.invoke('auth:saveToken', userId, token),
      removeToken: (userId: string) =>
        ipcRenderer.invoke('auth:removeToken', userId)
    },

    user: {
      getActiveUser: () => ipcRenderer.invoke('user:getActiveUser'),
      switchUser: (userId: string) =>
        ipcRenderer.invoke('user:switchUser', userId),
      removeUser: (userId: string) =>
        ipcRenderer.invoke('user:removeUser', userId),
      listUsers: () => ipcRenderer.invoke('user:listUsers')
    },

    books: {
      getAvailableBooks: () => ipcRenderer.invoke('books:getAvailableBooks'),
      getAvailableBooksForUser: (userId: string) =>
        ipcRenderer.invoke('books:getAvailableBooksForUser', userId)
    },

    export: {
      exportBook: (book: any, deviceId: string, outputDir: string) =>
        ipcRenderer.invoke('export:exportBook', book, deviceId, outputDir),
      exportBooks: (books: any[], deviceId: string, outputDir: string) =>
        ipcRenderer.invoke('export:exportBooks', books, deviceId, outputDir),
      onProgress: (callback: (progress: any) => void) =>
        ipcRenderer.on('export:progress', (_event, progress) => callback(progress))
    },

    util: {
      selectFolder: () => ipcRenderer.invoke('util:selectFolder'),
      openExternal: (url: string) => ipcRenderer.invoke('util:openExternal', url)
    },

    getLibrary: () => ipcRenderer.invoke('books:getAvailableBooks')
  })

  console.log('[Preload] Electron IPC 브릿지 로드 완료 ✅')
} catch (error) {
  console.error('[Preload] 브릿지 로드 실패:', error)
}