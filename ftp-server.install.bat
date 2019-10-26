@echo off

set NSSM="%~dp0bin\nssm.exe"
set NAME=walkner-ipt-vision-ftp-server

%NSSM% install %NAME% "%~dp0bin\node.exe" """%~dp0lib\ftp-server.js"""
%NSSM% set %NAME% AppNoConsole 1
%NSSM% start %NAME%
pause
