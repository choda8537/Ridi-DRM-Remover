import { useState, useEffect } from 'react'
import type { BookInfo } from '@/core/book/book-info'
import type { ExportProgress } from '@/core/crypto/export-service'

interface ExportDialogProps {
  books: BookInfo[]
  users: any[]
  currentUser: any
  isOpen: boolean
  onClose: () => void
  onExport: (books: BookInfo[], deviceId: string, outputDir: string) => Promise<void>
  onSelectFolder: () => Promise<string | null>
}

export function ExportDialog({
  books,
  users,
  currentUser,
  isOpen,
  onClose,
  onExport,
  onSelectFolder
}: ExportDialogProps) {
  const [selectedDevice, setSelectedDevice] = useState<string>('')
  const [outputDir, setOutputDir] = useState<string>('')
  const [isExporting, setIsExporting] = useState(false)
  const [progress, setProgress] = useState<ExportProgress[]>([])
  const [error, setError] = useState<string | null>(null)

  // 다이얼로그가 열릴 때마다 상태 초기화
  useEffect(() => {
    if (isOpen) {
      setIsExporting(false)
      setProgress([])
      setError(null)
    }
  }, [isOpen])

  useEffect(() => {
    if (currentUser?.device_id) {
      setSelectedDevice(currentUser.device_id)
    }
  }, [currentUser])

  const handleReset = () => {
    setProgress([])
    setIsExporting(false)
    setError(null)
  }

  const handleSelectFolder = async () => {
    try {
      const folder = await onSelectFolder()
      if (folder) {
        setOutputDir(folder)
      }
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const handleExport = async () => {
    if (!selectedDevice) {
      setError('디바이스를 선택해주세요')
      return
    }

    if (!outputDir) {
      setError('저장 폴더를 선택해주세요')
      return
    }

    try {
      setError(null)
      setIsExporting(true)
      setProgress([])

      // 진행 상황 리스너 등록
      window.electronAPI.export.onProgress((prog: ExportProgress) => {
        setProgress((prev) => {
          const updated = [...prev]
          const existingIndex = updated.findIndex((p) => p.bookId === prog.bookId)
          if (existingIndex >= 0) {
            updated[existingIndex] = prog
          } else {
            updated.push(prog)
          }
          return updated
        })
      })

      await onExport(books, selectedDevice, outputDir)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsExporting(false)
    }
  }

  if (!isOpen) return null

  const successCount = progress.filter((p) => p.status === 'success').length
  const errorCount = progress.filter((p) => p.status === 'error').length
  const processingCount = progress.filter((p) => p.status === 'processing').length
  const totalCount = books.length

  const progressPercent = Math.round((progress.length / totalCount) * 100)

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2>도서 내보내기</h2>
          <button onClick={onClose} className="close-button">✕</button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {!isExporting && progress.length === 0 && (
          <div className="modal-body">
            <div className="form-group">
              <label>디바이스 선택</label>
              <select value={selectedDevice} onChange={(e) => setSelectedDevice(e.target.value)}>
                <option value="">-- 디바이스를 선택하세요 --</option>
                <optgroup label="현재 사용자">
                  {currentUser && (
                    <option value={currentUser.device_id}>
                      {currentUser.device_nick} ({currentUser.device_id})
                    </option>
                  )}
                </optgroup>
                <optgroup label="다른 사용자">
                  {users
                    .filter((u) => u.device_id !== currentUser?.device_id)
                    .map((user) => (
                      <option key={user.user_idx} value={user.device_id}>
                        {user.device_nick} ({user.device_id})
                      </option>
                    ))}
                </optgroup>
              </select>
            </div>

            <div className="form-group">
              <label>저장 폴더</label>
              <div className="folder-input">
                <input type="text" value={outputDir} disabled />
                <button onClick={handleSelectFolder} className="fl-btn fl-btn-secondary fl-btn-sm">
                  폴더 선택
                </button>
              </div>
            </div>

            <div className="export-summary">
              <p>선택된 도서: <strong>{books.length}</strong>권</p>
            </div>

            <div className="modal-footer">
              <button onClick={onClose} className="fl-btn fl-btn-secondary">취소</button>
              <button
                onClick={handleExport}
                disabled={!selectedDevice || !outputDir}
                className="fl-btn fl-btn-primary"
              >
                내보내기 시작
              </button>
            </div>
          </div>
        )}

        {(isExporting || progress.length > 0) && (
          <div className="modal-body progress-body">
            <div className="progress-stats">
              <div className="stat">
                <span className="label">성공</span>
                <span className="value success">{successCount}</span>
              </div>
              <div className="stat">
                <span className="label">진행 중</span>
                <span className="value processing">{processingCount}</span>
              </div>
              <div className="stat">
                <span className="label">오류</span>
                <span className="value error">{errorCount}</span>
              </div>
              <div className="stat">
                <span className="label">총 도서</span>
                <span className="value">{books.length}</span>
              </div>
            </div>

            {/* 전체 진행률 표시 */}
            <div className="overall-progress">
              <div className="progress-header">
                <span className="progress-label">전체 진행률</span>
                <span className="progress-percent">{progressPercent}%</span>
              </div>
              <div className="progress-bar-container">
                <div 
                  className="progress-bar-fill" 
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            <div className="progress-list">
              {progress.map((p) => (
                <div key={p.bookId} className={`progress-item ${p.status}`}>
                  <span className="status-icon">
                    {p.status === 'success' && (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" fill="var(--fl-success)"/><path d="M4 7l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    )}
                    {p.status === 'processing' && (
                      <span className="fl-ring fl-ring-sm" />
                    )}
                    {p.status === 'error' && (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" fill="var(--fl-error)"/><path d="M5 5l4 4M9 5l-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    )}
                  </span>
                  <span className="filename">{p.fileName}</span>
                  {p.error && <span className="error-text">{p.error.message}</span>}
                </div>
              ))}
            </div>

            {!isExporting && (
              <div className="modal-footer">
                <button onClick={handleReset} className="fl-btn fl-btn-secondary">다시 내보내기</button>
                <button onClick={onClose} className="fl-btn fl-btn-primary">닫기</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}