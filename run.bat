@echo off

"%~dp0bin\nssm.exe" start walkner-ipt-vision-ftp-server > NUL 2>&1
"%~dp0bin\node.exe" "%~dp0lib\index.js" "%1"
