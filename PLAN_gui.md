  # GUI 개발 계획

  ## 제안하는 GUI 구조

  ```
  src/
  ├── gui/                        # GUI 프로그램 (독립 실행 가능)
  │   ├── main.ts                # Electron/Tauri 진입점
  │   ├── preload.ts             # Electron preload script
  │   ├── renderer/
  │   │   ├── index.html
  │   │   ├── App.tsx            # 메인 React 앱
  │   │   ├── components/
  │   │   │   ├── AuthWindow.tsx     # GUI 인증 UI
  │   │   │   ├── BookList.tsx       # GUI 책 목록 UI
  │   │   │   └── ExportDialog.tsx   # GUI 내보내기 UI
  │   │   └── hooks/
  │   │       └── useRidiService.ts  # React hook for core services
  │   └── services/
  │       └── ipc-handlers.ts    # IPC 통신 핸들러 (core 모듈 호출)
  ```

  ## GUI에서의 Core 모듈 사용 예시

  ### 1. 진행 상황 업데이트 (콜백 활용)

  ```typescript
  // GUI에서 사용
  await exportBook(book, deviceId, outputDir, progress => {
    if (progress.status === 'processing') {
      updateProgressBar(progress.fileName)
    } else if (progress.status === 'success') {
      showSuccessNotification(progress.fileName)
    } else {
      showErrorDialog(progress.error?.message)
    }
  })
  ```

  ### 2. 인증 UI (React 컴포넌트)

  ```typescript
  // 🎨 gui/renderer/components/AuthWindow.tsx - GUI UI
  export function AuthWindow() {
    const [devices, setDevices] = useState<UserDevice[]>([]);

    const handleLogin = async () => {
      // IPC를 통해 메인 프로세스에 로그인 요청
      const url = await window.electronAPI.getLoginUrl();
      await window.electronAPI.openExternal(url);

      // 사용자가 JSON을 붙여넣을 수 있는 다이얼로그 표시
      const jsonInput = await window.electronAPI.showInputDialog({
        title: 'Ridi Login',
        message: 'Please paste the JSON data from the browser'
      });

      // IPC를 통해 디바이스 목록 파싱 요청
      const deviceList = await window.electronAPI.parseDeviceList(jsonInput);
      setDevices(deviceList);
    };

    const handleSelectDevice = async (device: UserDevice) => {
      await window.electronAPI.addDevice(device);
      // 성공 알림 표시 
    };

    return (
      <div>
        <button onClick={handleLogin}>Login</button>
        <DeviceList devices={devices} onSelect={handleSelectDevice} />
      </div>
    );
  }
  ```

  ## 향후 GUI 개발 시나리오

  ### 1. GUI 프로젝트 생성 (Electron/Tauri)

  ```bash
  mkdir gui
  cd gui
  bun init
  bun add electron react
  ```

  ### 2. Core 모듈 import (GUI 메인 프로세스)

  ```typescript
  // gui/services/ipc-handlers.ts
  import { ipcMain } from 'electron'
  import { AuthService } from '../../core/auth/auth-service.js'
  import { BookService } from '../../core/book/book-service.js'
  import { ExportService } from '../../core/crypto/export-service.js'
  import { ConfigService } from '../../core/config/config-service.js'

  export function setupIpcHandlers(configPath: string) {
    const configService = new ConfigService(configPath)
    const authService = new AuthService(configService)
    const bookService = new BookService()
    const exportService = new ExportService()

    // 인증 관련 IPC 핸들러
    ipcMain.handle('auth:getLoginUrl', () => {
      return authService.getLoginUrl()
    })

    ipcMain.handle('auth:parseDeviceList', (_, jsonInput: string) => {
      return authService.parseDeviceList(jsonInput)
    })

    ipcMain.handle('auth:addDevice', (_, device) => {
      authService.addDevice(device)
    })

    // 책 관련 IPC 핸들러
    ipcMain.handle('books:getAvailableBooks', () => {
      const user = configService.getActiveUser()
      if (!user) throw new Error('No active user')
      return bookService.getAvailableBooks(user.user_idx)
    })

    // 내보내기 관련 IPC 핸들러
    ipcMain.handle('export:exportBook', (event, book, deviceId, outputDir) => {
      return exportService.exportBook(book, deviceId, outputDir, progress => {
        // 진행 상황을 렌더러 프로세스로 전송
        event.sender.send('export:progress', progress)
      })
    })
  }
  ```

  ### 3. React 컴포넌트에서 사용 (내보내기 다이얼로그)

  ```typescript
  // gui/renderer/components/ExportDialog.tsx
  import { useState, useEffect } from 'react';
  import type { ExportProgress } from '../../../core/crypto/export-service';

  export function ExportDialog({ books, deviceId, outputDir }) {
    const [progress, setProgress] = useState<ExportProgress[]>([]);

    useEffect(() => {
      // 진행 상황 이벤트 리스너 등록
      const unsubscribe = window.electronAPI.onExportProgress((prog: ExportProgress) => {
        setProgress(prev => [...prev, prog]);
      });

      return unsubscribe;
    }, []);

    const handleExport = async () => {
      for (const book of books) {
        await window.electronAPI.exportBook(book, deviceId, outputDir);
      }
    };

    return (
      <div>
        <button onClick={handleExport}>Export</button>
        <ul>
          {progress.map(p => (
            <li key={p.bookId}>
              {p.fileName}: {p.status}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  ```

  ### 4. 비즈니스 로직 재사용 완료

  - ✅ CLI와 GUI가 동일한 core 모듈 사용
  - ✅ 암호화/복호화 로직 중복 없음
  - ✅ 설정 관리, 인증 로직 공유
  - ✅ UI만 다르게 구현

  ## 빌드 및 개발 명령 (예시)

  ### GUI 빌드
  ```bash
  bun run build:gui
  # 출력: dist/RidiDRMRemover.exe (Electron app)
  ```

  ### GUI 개발 모드
  ```bash
  bun run dev:gui
  ```
