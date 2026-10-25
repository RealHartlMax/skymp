@echo off
call "%~dp0start-test-server.cmd" %*
exit /b %errorlevel%
