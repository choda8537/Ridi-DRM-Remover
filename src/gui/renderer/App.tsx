import { useState, useRef } from 'react'
import { useRidiService } from './hooks/useRidiService'
import { AuthWindow } from './components/AuthWindow'
import { BookList } from './components/BookList'
import { ExportDialog } from './components/ExportDialog'
import './App.css'

const SPLASH_MIN_MS = 1500

// ── 스플래시 로딩 화면 ──────────────────────────────────
function SplashScreen({ fading }: { fading?: boolean }) {
  return (
    <div className={`splash-screen${fading ? ' splash--fading' : ''}`}>
      {/* WinUI 3 스타일 상단 인디케이터 바 */}
      <div className="splash-indicator">
        <div className="splash-indicator__bar1" />
        <div className="splash-indicator__bar2" />
      </div>

      <div className="splash-card">
        <div className="splash-icon-wrap">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" clipRule="evenodd"
              d="M8 10a3 3 0 013-3h12v34H11a3 3 0 01-3-3V10zm15-3h12a3 3 0 013 3v28a3 3 0 01-3 3H23V7z"
              fill="white" />
            <rect x="20" y="36" width="8" height="2" rx="1" fill="rgba(255,255,255,0.4)" />
          </svg>
        </div>

        <div className="splash-brand">
          <span className="splash-brand__ridi">RIDI</span>
          <span className="splash-brand__sub">DRM Remover</span>
        </div>

        <p className="splash-status">PC의 리디북스 앱을 감지하는 중</p>
      </div>
    </div>
  )
}

export default function App() {
  const ridiService = useRidiService()
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [selectedBooks, setSelectedBooks] = useState<any[]>([])
  const [appError, setAppError] = useState<string | null>(null)
  const [appStarted, setAppStarted] = useState(false)
  const [splashFading, setSplashFading] = useState(false)
  const splashStartRef = useRef(Date.now())

  const exitSplash = () => {
    const elapsed = Date.now() - splashStartRef.current
    const delay = Math.max(0, SPLASH_MIN_MS - elapsed)
    setTimeout(() => {
      setSplashFading(true)
      setTimeout(() => setAppStarted(true), 380)
    }, delay)
  }

  const handleAuthSuccess = async () => {
    await ridiService.loadActiveUser()
    await ridiService.loadUsers()
    ridiService.loadBooks()
    exitSplash()
  }

  const handleAuthFailed = () => exitSplash()

  const handleExport = async (books: any[]) => {
    setSelectedBooks(books)
    setIsExportDialogOpen(true)
  }

  const handlePerformExport = async (
    books: any[],
    deviceId: string,
    outputDir: string
  ) => {
    try {
      setAppError(null)
      await ridiService.exportBooks(books, deviceId, outputDir, (_progress) => {})
    } catch (err) {
      setAppError((err as Error).message)
      throw err
    }
  }

  const handleSelectFolder = async () => {
    return await ridiService.selectFolder()
  }

  if (!appStarted) {
    return (
      <div className="app">
        <SplashScreen fading={splashFading} />
        <div style={{ display: 'none' }}>
          <AuthWindow
            onSuccess={handleAuthSuccess}
            onFailed={handleAuthFailed}
          />
        </div>
      </div>
    )
  }

  if (!ridiService.currentUser) {
    return (
      <div className="app">
        <nav className="app-title-bar">
          <span className="title-bar-name">Ridi DRM Remover</span>
        </nav>
        <div className="app-content">
          <div className="app-main auth-screen">
            <AuthWindow onSuccess={handleAuthSuccess} onFailed={handleAuthFailed} />
          </div>
        </div>
        <footer className="app-footer">Ridi DRM Remover — 안전한 개인 백업용</footer>
      </div>
    )
  }

  const nick = ridiService.currentUser?.device_nick ?? ''
  const initials = nick.slice(0, 2).toUpperCase()

  return (
    <div className="app">
      <nav className="app-title-bar">
        <span className="title-bar-name">Ridi DRM Remover</span>
        <div className="title-bar-divider" />
        <div className="title-bar-user">
          <div className="user-avatar" title={nick}>{initials}</div>
          <span className="user-nick">{nick}</span>
        </div>
        <div className="title-bar-spacer" />
      </nav>

      {(appError || ridiService.error) && (
        <div className="banner-area">
          {appError && (
            <div className="fl-message fl-message-error">{appError}</div>
          )}
          {ridiService.error && (
            <div className="fl-message fl-message-warning">{ridiService.error}</div>
          )}
        </div>
      )}

      <div className="app-content">
        <BookList
          books={ridiService.books}
          isLoading={ridiService.isLoading}
          onExport={handleExport}
        />
      </div>

      <ExportDialog
        books={selectedBooks}
        users={ridiService.users}
        currentUser={ridiService.currentUser}
        isOpen={isExportDialogOpen}
        onClose={() => {
          setIsExportDialogOpen(false)
          setSelectedBooks([])
        }}
        onExport={handlePerformExport}
        onSelectFolder={handleSelectFolder}
      />

      <footer className="app-footer">Ridi DRM Remover — 개인 백업 전용</footer>
    </div>
  )
}