@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 oder neuer fehlt. Siehe README-TEST.md.
  exit /b 1
)
node setup-server.cjs --ensure
if errorlevel 1 exit /b 1
node check-install.cjs
if errorlevel 1 exit /b 1
node dist_back/skymp5-server.js %*
exit /b %errorlevel%
