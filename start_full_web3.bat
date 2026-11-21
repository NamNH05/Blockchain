@echo off
title Secure Collector DAO - Full Web3
color 0A
cd /d "%~dp0"

echo =====================================================================
echo      KHOI DONG TRON GOI WEB3: NODE + DEPLOY CONTRACTS + FRONTEND
echo =====================================================================
echo.
echo [1/3] Dang bat Hardhat Node trong cua so rieng...
start "Hardhat Local Node" cmd /k "cd /d ""%~dp0"" && npx.cmd hardhat node"

echo [2/3] Cho Node khoi dong (4 giay)...
timeout /t 4 /nobreak >nul

echo [3/3] Deploy Smart Contracts len Localhost...
call npx.cmd hardhat run scripts/deploy.ts --network localhost

echo.
echo [*] Dang mo Frontend tren trinh duyet (http://localhost:5173)...
start "" http://localhost:5173
cd /d "%~dp0frontend"
call npm.cmd run dev