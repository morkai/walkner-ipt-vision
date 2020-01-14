@echo off

set NSSM="%~dp0bin\nssm.exe"
set NAME=walkner-ipt-vision-ftp-server

netsh advfirewall firewall show rule name=%name% > nul

if errorlevel 1 (
  echo Adding firewall rule %NAME%...
  netsh advfirewall firewall add rule name=%NAME% dir=in protocol=TCP localport=21 program="%~dp0bin\node.exe" action=allow
) else (
  echo Firewall rule %NAME% already exists!
)

sc query %NAME% > nul

if errorlevel 1 (
  echo Installing service %NAME%...
  %NSSM% install %NAME% "%~dp0bin\node.exe" """%~dp0lib\ftp-server.js"""
  %NSSM% set %NAME% AppNoConsole 1
) else (
  echo Service %NAME% already exists!
)

sc query %NAME% | findstr "RUNNING" > nul

if errorlevel 1 (
  echo Starting the service...
  %NSSM% start %NAME%
) else (
  echo Service already running!
)

pause
