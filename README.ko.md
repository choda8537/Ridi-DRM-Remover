# Ridi-DRM-Remover

리디북스에서 구매하여 다운로드한 전자책의 DRM을 제거하여 일반적인 EPUB/PDF 파일로 변환해주는 CLI 도구입니다.

> **면책 조항 (Disclaimer)**
>
> 본 소프트웨어를 통해 취득한 결과물을 공유, 배포 또는 판매하는 행위는 엄격히 금지됩니다. 본 소프트웨어의 오용으로 인해 발생하는 모든 책임은 사용자 본인에게 있습니다. 사용 시 주의하시기 바랍니다.

## 준비 사항

- [**Python 3.14**](https://www.python.org/)
- [**uv**](https://github.com/astral-sh/uv)
- **리디북스 PC/Mac 앱**: DRM을 제거하려는 도서가 공식 앱을 통해 미리 다운로드되어 있어야 합니다.

## 설치 방법

1. 저장소를 클론합니다:

   ```bash
   git clone https://github.com/thecats1105/Ridi-DRM-Remover.git
   cd Ridi-DRM-Remover
   ```

2. 가상 환경을 생성합니다:

   ```bash
   uv venv
   ```

3. 필요한 패키지를 설치합니다:
   ```bash
   uv sync
   ```

## 사용 방법

이 도구는 `uv run src/main.py`를 통해 실행할 수 있습니다.

```bash
uv run src/main.py --help
```

### 1. 계정 인증 및 설정 (`auth`)

도서를 추출하기 전, `device_id`와 `user_idx`를 설정하기 위해 로그인을 진행해야 합니다.

```bash
uv run src/main.py auth login
```

- 안내에 따라 브라우저에서 리디북스에 로그인합니다.
- 로그인 후 표시되는 페이지의 JSON 데이터를 복사합니다.
- 터미널에 붙여넣은 뒤, 도서가 다운로드된 기기를 선택하세요.

**기타 인증 명령:**

- `uv run src/main.py auth list`: 저장된 계정 목록 보기.
- `uv run src/main.py auth switch`: 활성 계정 전환.
- `uv run src/main.py auth logout`: 계정 정보 삭제.

### 2. 도서 목록 확인 (`books`)

로컬 라이브러리에 다운로드된 도서 중 추출 가능한 목록을 확인합니다.

```bash
uv run src/main.py books
```

- **제목 필터링**: `uv run src/main.py books -n "제목"`
- **ID로 필터링**: `uv run src/main.py books -i "123456"`

### 3. 도서 내보내기 (`export`)

도서의 DRM을 제거하여 지정된 디렉토리에 저장합니다.

```bash
# 모든 다운로드된 도서 내보내기
uv run src/main.py export --all -o ./output

# 특정 ID의 도서만 내보내기
uv run src/main.py export -i "123456" -o ./output

# 제목이 포함된 도서 내보내기
uv run src/main.py export -n "제목"
```

## 컴파일 (빌드)

`PyInstaller`를 사용하여 단일 실행 파일(.exe)로 컴파일할 수 있습니다:

```bash
uv run src/build.py
```

빌드가 완료되면 `dist/` 디렉토리에 단일 실행 파일이 생성됩니다.


## 주요 기능

- **다중 계정 지원**: 여러 개의 리디 계정을 관리할 수 있습니다. 기기 선택은 현재 리디북스 뷰어가 활성화된 기기의 암호화 데이터를 일치시키기 위해 사용됩니다.
- **제목 자동 추출**: EPUB/PDF 메타데이터를 분석하여 실제 도서 제목으로 파일 이름을 생성합니다.
- **EPUB & PDF 지원**: 리디북스에서 제공하는 두 가지 주요 포맷을 모두 지원합니다.
- **파일명 정리**: 파일 시스템에서 오류를 일으킬 수 있는 문자를 자동으로 제거합니다.

## 참고

- [Retro-Rex8/Ridi-DRM-Remover](https://github.com/Retro-Rex8/Ridi-DRM-Remover)
- [hsj1/ridiculous](https://github.com/hsj1/ridiculous)
