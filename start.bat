@echo off
setlocal
title Secure Collector DAO - Launcher
color 0B
cd /d "%~dp0"

echo =====================================================================
echo           SECURE COLLECTOR DAO - SYSTEM LAUNCHER
echo =====================================================================
echo.
echo   [1] Khoi chay Giao Dien Web Frontend (Mac dinh - Nhan Enter de chay)
echo   [2] Khoi chay Tron Goi Full Web3 (Node + Deploy + Frontend)
echo   [3] Chi bat Hardhat Local Node (Cua so rieng)
echo   [4] Deploy lai Smart Contracts len Local Node
echo   [5] Chay kiem thu Smart Contract (Hardhat Test)
echo   [0] Thoat
echo.
echo =====================================================================
echo.
set "sel=1"
set /p "sel=Nhap lua chon cua ban [1, 2, 3, 4, 5, 0] (Mac dinh la 1): "

if "%sel%"=="0" goto opt_exit
if "%sel%"=="2" goto opt_web3
if "%sel%"=="3" goto opt_node
if "%sel%"=="4" goto opt_deploy
if "%sel%"=="5" goto opt_test

:opt_fe
echo.
echo [*] Dang khoi dong Frontend va mo trinh duyet...
echo [*] Luu y: Giu nguyen cua so nay trong khi su dung Web.
echo.
cd /d "%~dp0frontend"
node .\node_modules\vite\bin\vite.js --open
echo.
echo [*] May chu da dung.
pause
goto opt_end

:opt_web3
echo.
echo [*] Dang khoi dong Hardhat Node trong cua so rieng...
start "Hardhat Local Node" cmd /k "cd /d ""%~dp0"" && npx.cmd hardhat node"
echo [*] Cho Node khoi dong (4 giay)...
timeout /t 4 /nobreak >nul

echo [*] Deploy Smart Contracts len Localhost...
call npx.cmd hardhat run scripts/deploy.ts --network localhost

echo.
echo [*] Dang khoi dong Frontend va mo trinh duyet...
echo [*] Luu y: Giu nguyen cua so nay trong khi su dung Web.
echo.
cd /d "%~dp0frontend"
node .\node_modules\vite\bin\vite.js --open
echo.
echo [*] May chu da dung.
pause
goto opt_end

:opt_node
echo.
echo [*] Dang mo Hardhat Local Node trong cua so moi...
start "Hardhat Local Node" cmd /k "cd /d ""%~dp0"" && npx.cmd hardhat node"
pause
goto opt_end

:opt_deploy
echo.
echo [*] Dang Deploy Smart Contracts...
call npx.cmd hardhat run scripts/deploy.ts --network localhost
pause
goto opt_end

:opt_test
echo.
echo [*] Dang chay kiem thu...
call npx.cmd hardhat test
pause
goto opt_end

:opt_exit
exit /b 0

:opt_end
endlocal