@echo off
setlocal
cd /d "%~dp0"
title Goldthorn TD - Local Server (close this window to stop)

set NO_PROXY=127.0.0.1,localhost
set no_proxy=127.0.0.1,localhost

echo.
echo   ==================================================
echo    Goldthorn Defense - local game server
echo    URL : http://127.0.0.1:8080/
echo    Keep this window open while playing.
echo    Close this window to stop the server.
echo   ==================================================
echo.

curl -s -f --noproxy "*" -o NUL --max-time 2 http://127.0.0.1:8080/
if %errorlevel%==0 (
  echo   Server already running. Opening the game...
  start "" http://127.0.0.1:8080/
  ping -n 4 127.0.0.1 >NUL
  exit /b 0
)

echo   Starting server. The game page will open in a few seconds...
start "" /MIN cmd /c "ping -n 7 127.0.0.1 >NUL & start http://127.0.0.1:8080/"
call npm run dev

echo.
echo   Server stopped. Press any key to close.
pause >NUL
