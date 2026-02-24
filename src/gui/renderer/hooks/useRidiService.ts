import { useState, useEffect, useCallback } from 'react'

declare global {
  interface Window {
    electronAPI: any
  }
}

export function useRidiService() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [books, setBooks] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasElectronAPI = typeof window !== 'undefined' && !!window.electronAPI

  const loadActiveUser = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      if (!hasElectronAPI) {
        throw new Error('Electron API가 로드되지 않았습니다. 개발자 도구를 확인해주세요.')
      }

      const user = await window.electronAPI.auth.getActiveUser()
      setCurrentUser(user)

      if (user) {
        try {
          const bookList = await window.electronAPI.books.getAvailableBooks()
          setBooks(bookList)
        } catch (bookErr) {
          console.warn('책 목록 불러오기 실패:', (bookErr as Error).message)
          setBooks([])
        }
      }
    } catch (err) {
      const errorMsg = (err as Error).message
      setError(errorMsg)
      console.error('loadActiveUser error:', errorMsg)
      setCurrentUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [hasElectronAPI])

  const loadUsers = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const userList = await window.electronAPI.auth.listUsers()
      setUsers(userList)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadBooks = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const bookList = await window.electronAPI.books.getAvailableBooks()
      setBooks(bookList)
    } catch (err) {
      setError((err as Error).message)
      setBooks([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  const getLoginUrl = useCallback(async () => {
    try {
      return await window.electronAPI.auth.getLoginUrl()
    } catch (err) {
      setError((err as Error).message)
      return null
    }
  }, [])

  const parseDeviceList = useCallback(async (jsonInput: string) => {
    try {
      setError(null)
      return await window.electronAPI.auth.parseDeviceList(jsonInput)
    } catch (err) {
      setError((err as Error).message)
      return []
    }
  }, [])

  const addDevice = useCallback(
    async (device: any) => {
      try {
        setError(null)
        await window.electronAPI.auth.addDevice(device)
        await loadUsers()
        await loadActiveUser()
        return true
      } catch (err) {
        setError((err as Error).message)
        return false
      }
    },
    [loadUsers, loadActiveUser]
  )

  const switchUser = useCallback(
    async (userId: string) => {
      try {
        setError(null)
        const success = await window.electronAPI.auth.switchUser(userId)
        if (success) {
          await loadActiveUser()
          await loadBooks()
        }
        return success
      } catch (err) {
        setError((err as Error).message)
        return false
      }
    },
    [loadActiveUser, loadBooks]
  )

  const removeUser = useCallback(
    async (userId: string) => {
      try {
        setError(null)
        const success = await window.electronAPI.auth.removeUser(userId)
        if (success) {
          await loadUsers()
          await loadActiveUser()
        }
        return success
      } catch (err) {
        setError((err as Error).message)
        return false
      }
    },
    [loadUsers, loadActiveUser]
  )

  const exportBooks = useCallback(
    async (
      bookList: any[],
      deviceId: string,
      outputDir: string,
      onProgress?: (progress: any) => void
    ) => {
      try {
        setError(null)
        if (onProgress) {
          window.electronAPI.export.onProgress(onProgress)
        }
        const result = await window.electronAPI.export.exportBooks(
          bookList,
          deviceId,
          outputDir
        )
        return result
      } catch (err) {
        setError((err as Error).message)
        throw err
      }
    },
    []
  )

  const selectFolder = useCallback(async () => {
    try {
      return await window.electronAPI.util.selectFolder()
    } catch (err) {
      setError((err as Error).message)
      return null
    }
  }, [])

  const openExternal = useCallback(async (url: string) => {
    try {
      await window.electronAPI.util.openExternal(url)
    } catch (err) {
      setError((err as Error).message)
    }
  }, [])

  const saveToken = useCallback(async (userId: string, token: any) => {
    try {
      setError(null)
      await window.electronAPI.auth.saveToken(userId, token)
    } catch (err) {
      setError((err as Error).message)
      throw err
    }
  }, [])

  const getToken = useCallback(async (userId: string) => {
    try {
      setError(null)
      return await window.electronAPI.auth.getToken(userId)
    } catch (err) {
      setError((err as Error).message)
      return null
    }
  }, [])

  const removeToken = useCallback(async (userId: string) => {
    try {
      setError(null)
      await window.electronAPI.auth.removeToken(userId)
    } catch (err) {
      setError((err as Error).message)
      throw err
    }
  }, [])

  useEffect(() => {
    loadActiveUser()
    loadUsers()
  }, [loadActiveUser, loadUsers])

  return {
    currentUser,
    users,
    books,
    isLoading,
    error,
    loadActiveUser,
    loadUsers,
    loadBooks,
    getLoginUrl,
    parseDeviceList,
    addDevice,
    switchUser,
    removeUser,
    exportBooks,
    selectFolder,
    openExternal,
    saveToken,
    getToken,
    removeToken
  }
}
