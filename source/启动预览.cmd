@echo off
cd /d "%~dp0"
set "PATH=C:\Program Files\nodejs;%PATH%"
call npm.cmd run dev
