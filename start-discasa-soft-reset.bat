@echo off
setlocal EnableExtensions

cd /d "%~dp0"

echo ==========================================
echo Discasa - Soft Reset
echo ==========================================
echo.
echo Close the app before running this reset.
echo.
echo This will remove cached/generated items from the project folder:
echo - node_modules
echo - package-lock.json
echo - apps\desktop\node_modules
echo - apps\desktop\dist
echo - apps\desktop\src-tauri\target
echo - apps\server\dist
echo - apps\server\node_modules
echo - target
echo.
echo This soft reset preserves:
echo - apps\server\.discasa-data
echo - local UI storage (accent color, sidebar state, etc.)
echo.
choice /C YN /M "Continue"
if errorlevel 2 (
  echo Cancelled.
  exit /b 0
)

call :remove_dir "node_modules"
call :remove_file "package-lock.json"
call :remove_dir "apps\desktop\node_modules"
call :remove_dir "apps\desktop\dist"
call :remove_dir "apps\desktop\src-tauri\target"
call :remove_dir "apps\server\dist"
call :remove_dir "apps\server\node_modules"
call :remove_dir "target"

echo.
echo Soft reset complete.
echo.

choice /C YN /M "Run npm install now"
if errorlevel 2 goto ask_start

echo.
echo Running npm install...
call npm install
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if not "%EXIT_CODE%"=="0" (
  echo npm install failed with exit code %EXIT_CODE%.
  pause
  exit /b %EXIT_CODE%
)

echo npm install finished successfully.
echo.

:ask_start
choice /C YN /M "Start the app now"
if errorlevel 2 goto end

echo.
echo Starting Discasa...
start "Discasa Server" cmd /k "cd /d ""%~dp0"" && npm run dev:server"
timeout /t 2 >nul
start "Discasa Desktop" cmd /k "cd /d ""%~dp0"" && npm --workspace @discasa/desktop exec tauri dev"
goto end

:end
exit /b 0

:remove_dir
if exist "%~1" (
  echo Removing folder: %~1
  rmdir /s /q "%~1"
) else (
  echo Folder not found, skipping: %~1
)
exit /b 0

:remove_file
if exist "%~1" (
  echo Removing file: %~1
  del /f /q "%~1"
) else (
  echo File not found, skipping: %~1
)
exit /b 0
