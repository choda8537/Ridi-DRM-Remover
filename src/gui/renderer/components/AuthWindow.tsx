import { useState, useEffect } from 'react'

interface AuthWindowProps {
  onSuccess: () => void
  onFailed?: () => void
}

export function AuthWindow({ onSuccess, onFailed }: AuthWindowProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string>('')

  useEffect(() => {
    attemptAutoLogin()
  }, [])

  const attemptAutoLogin = async () => {
    try {
      setIsLoading(true)
      setError(null)
      setDebugInfo('Electron API 확인 중...')

      if (!window.electronAPI?.auth) {
        throw new Error('[Error] Electron API가 로드되지 않았습니다.')
      }

      setDebugInfo(prev => prev + '\nElectron API 확인됨\nautoLogin() 호출 중...')

      const result = await window.electronAPI.auth.autoLogin()
      setDebugInfo(prev => prev + '\n결과: ' + JSON.stringify(result, null, 2))

      if (result?.success) {
        setDebugInfo(prev => prev + '\n자동 로그인 성공 — ' + result.username)
        setTimeout(() => onSuccess(), 800)
      } else {
        const diagLog = result?.diagnostics?.join('\n') || '알 수 없는 오류'
        setDebugInfo(prev => prev + '\n--- 진단 정보 ---\n' + diagLog)
        setError('Ridi 앱 인증 데이터를 찾을 수 없습니다. Ridi PC 앱이 설치되어 있고 로그인되어 있는지 확인해 주세요.')
        onFailed?.()
      }
    } catch (err) {
      const msg = (err as Error).message
      setDebugInfo(prev => prev + '\n오류: ' + msg)
      setError(msg)
      onFailed?.()
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="auth-card">
      <div className="auth-card-header">
        <h2>Ridi 자동 감지</h2>
        <p>PC에 설치된 Ridi 앱에서 인증 정보를 가져옵니다</p>
      </div>

      {isLoading && (
        <div className="auth-loading">
          <div className="fl-ring" />
          <span className="auth-loading-text">Ridi PC 앱을 탐색하는 중...</span>
          <div className="fl-progress-bar" style={{ width: '160px' }} />
        </div>
      )}

      {!isLoading && error && (
        <div className="auth-error-section">
          <div className="error-message">{error}</div>
          <div className="auth-error-retry">
            <button className="fl-btn fl-btn-primary" onClick={attemptAutoLogin}>
              다시 시도
            </button>
          </div>
          {debugInfo && (
            <details className="fl-details">
              <summary>진단 정보</summary>
              <pre>{debugInfo}</pre>
            </details>
          )}
        </div>
      )}

      {!isLoading && !error && debugInfo && (
        <details className="fl-details">
          <summary>상세 로그</summary>
          <pre>{debugInfo}</pre>
        </details>
      )}
    </div>
  )
}