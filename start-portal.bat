@echo off
title Nursery & Primary Result Portal (Port 3001)
cd /d "%~dp0"
echo Starting Nursery ^& Primary Result Portal...
echo URL:   http://localhost:3001
echo Admin: http://localhost:3001/admin
echo Login: admin / admin123
echo.
node server.js
pause