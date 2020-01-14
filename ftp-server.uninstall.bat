@echo off

set NSSM="%~dp0bin\nssm.exe"
set NAME=walkner-ipt-vision-ftp-server

netsh advfirewall firewall delete rule name=%NAME%
%NSSM% stop %NAME%
%NSSM% remove %NAME% confirm
pause
