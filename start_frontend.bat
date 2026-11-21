@echo off
title Secure Collector DAO - Frontend
color 0B
cd /d "%~dp0"

echo =====================================================================
echo           SECURE COLLECTOR DAO - KHOI DONG FRONTEND
echo =====================================================================
echo.
echo [*] Dang khoi dong may chu Vite va mo trinh duyet Web...
echo [*] Luu y: Giu nguyen cua so nay trong suot qua trinh su dung.
echo [*] De dung may chu: Dong cua so nay hoac nhan Ctrl + C.
echo.
cd /d "%~dp0frontend"
node .\node_modules\vite\bin\vite.js --open
if errorlevel 1 (
  echo.
  echo [!] Co loi xay ra khi chay.
)
pause