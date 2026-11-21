# CÔNG NGHỆ VÀ TIÊU CHUẨN KỸ THUẬT

Tài liệu này mô tả công nghệ được cấu hình và sử dụng trong mã nguồn hiện có.

## 1. Stack công nghệ

| Thành phần | Công nghệ | Vai trò |
| --- | --- | --- |
| Smart contract | Solidity ^0.8.24 | Viết GovToken, Governor, Treasury và Adapter |
| Biên dịch, test, deploy | Hardhat 2, Hardhat Toolbox | Biên dịch Solidity, chạy test TypeScript và script triển khai |
| Hợp đồng chuẩn | OpenZeppelin Contracts 5.x | Token, Governor, Timelock, phân quyền và bảo vệ reentrancy |
| Frontend | Vite, TypeScript, ethers.js 6 | Giao diện web và tương tác hợp đồng qua ví |
| Kiểm thử | Mocha/Chai qua Hardhat | Test tại thư mục test/ |

hardhat.config.ts đặt Solidity 0.8.24, optimizer 200 runs, EVM Cancun và Hardhat local chainId 31337. Foundry không được cấu hình làm toolchain trong dự án hiện tại.

## 2. Tiêu chuẩn và module được dùng

### 2.1 ERC-721

NFTTreasury kế thừa ERC721Holder để nhận NFT ERC-721 thông qua cơ chế safe transfer.

### 2.2 ERC-20, ERC20Votes và ERC20Permit

GovToken dùng ERC-20 để quản lý token, ERC20Votes để ghi nhận quyền biểu quyết lịch sử và ERC20Permit cho cơ chế ủy quyền bằng chữ ký. Hợp đồng cũng có hàm mint công khai không giới hạn role; không nên giả định nguồn cung cố định.

### 2.3 ERC-6372

GovToken.clock() trả về block.timestamp, còn CLOCK_MODE() trả về mode=timestamp, để thống nhất cách Governor đọc mốc thời gian biểu quyết.

### 2.4 Governor và Timelock

Governor dựa trên các module OpenZeppelin cho cài đặt tham số, đếm phiếu, lấy quyền biểu quyết, tính quorum và tích hợp Timelock. Script deploy đặt voting delay 1 ngày, voting period 3 ngày, threshold 1.000 SCT, quorum 4% và Timelock delay 48 giờ.

### 2.5 AccessControl và ReentrancyGuard

Treasury sử dụng AccessControl cho TIMELOCK_ROLE và SECURITY_COUNCIL_ROLE; hai hàm mua/bán có nonReentrant.

## 3. Cấu hình triển khai và giới hạn

Script scripts/deploy.ts triển khai GovToken, Timelock, Treasury, Governor, MockMarketplace và SafeMarketplaceAdapter. Security Council trong script mẫu là địa chỉ deployer. hardhat.config.ts chỉ khai báo mạng Hardhat local; do đó không xem các địa chỉ mặc định hay marketplace mô phỏng là triển khai công khai.

Các lệnh dự án được khai báo trong package.json: npm run compile, npm test, npm run coverage và npm run deploy. Kết quả kiểm thử hoặc coverage chỉ nên trình bày như kết quả tại lần chạy tương ứng.
