@echo off
chcp 65001 >nul
cd /d "%~dp0"

if "%~1"=="" (
  echo.
  echo 사용법: deploy.cmd "커밋 메시지"
  echo 예시:   deploy.cmd "PWA 캐시 수정"
  echo.
  exit /b 1
)

git add -A
git status
git commit -m "%~1"
if errorlevel 1 (
  echo.
  echo 커밋이 필요 없거나 실패했습니다. 위 메시지를 확인하세요.
  exit /b 1
)
git push
if errorlevel 1 (
  echo.
  echo push 실패 — 네트워크·인증을 확인하세요.
  exit /b 1
)
echo.
echo 완료: GitHub에 반영되었습니다. Render Auto-Deploy면 곧 사이트도 갱신됩니다.
exit /b 0
