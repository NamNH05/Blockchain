# BÁO CÁO KẾT QUẢ KIỂM THỬ VÀ HƯỚNG DẪN TRIỂN KHAI (TEST RESULTS & DEPLOYMENT)

Tài liệu này tổng hợp chi tiết kết quả thực thi toàn bộ 19 bài kiểm thử, ma trận đối chiếu 11 tiêu chuẩn bảo mật (SEC-01 đến SEC-11), bảng đo lường độ bao phủ mã nguồn (Coverage), và hướng dẫn chi tiết các lệnh vận hành hệ thống **Secure Collector DAO**.

---

## 1. KẾT QUẢ ĐƯỢC GHI NHẬN TRONG TÀI LIỆU (EXECUTIVE SUMMARY)

- **Kết quả được ghi nhận trong báo cáo đi kèm**: 19/19 bài kiểm thử đạt.
- **Thời gian chạy bộ test**: `~2.0 giây`.
- **Trạng thái biên dịch**: `Compiled 38 Solidity files successfully (evm target: cancun)`.
- **Độ bao phủ dòng mã (Line Coverage)**:
  - `NFTTreasury.sol`: **100% Lines**, **100% Functions**, **100% Statements**
  - `SafeMarketplaceAdapter.sol`: **100% Lines**, **100% Functions**, **100% Statements**
  - `GovToken.sol`: **100% Lines**, **100% Functions**, **100% Statements**
  - `NFTDaoGovernor.sol`: **85% Lines**, **86.67% Functions**

---

## 2. MA TRẬN 11 BÀI KIỂM THỬ BẢO MẬT (SECURITY ACCEPTANCE MATRIX)

Các bài kiểm thử đối kháng (Adversarial Security Tests) được mô tả trong bộ test tại [`test/NFTTreasury.spec.ts`](file:///d:/Visual%20studio%20code/Blockchain/test/NFTTreasury.spec.ts) và [`test/GovernanceSecurity.spec.ts`](file:///d:/Visual%20studio%20code/Blockchain/test/GovernanceSecurity.spec.ts):

| Mã Test | Vector tấn công / Kịch bản kiểm tra | File Test & Vị trí | Kỳ vọng nghiệp vụ | Kết quả thực tế | Trạng thái |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **SEC-01** | Adapter cố tình giữ lại tiền thừa từ `maxPrice` (không refund) | [`NFTTreasury.spec.ts`](file:///d:/Visual%20studio%20code/Blockchain/test/NFTTreasury.spec.ts) | Phát hiện `netSpent != actualPrice`, rollback giao dịch | Reverted: `Treasury: Revenue/Refund mismatch` | **PASSED** |
| **SEC-02** | Adapter gửi sai NFT `tokenId` về Treasury | [`NFTTreasury.spec.ts`](file:///d:/Visual%20studio%20code/Blockchain/test/NFTTreasury.spec.ts) | Treasury kiểm tra quyền sở hữu đúng `tokenId`, từ chối nhận sai | Reverted: `Treasury: NFT not received` | **PASSED** |
| **SEC-03** | Adapter thực hiện tấn công Reentrancy gọi ngược lại Treasury | [`NFTTreasury.spec.ts`](file:///d:/Visual%20studio%20code/Blockchain/test/NFTTreasury.spec.ts) | Khóa `nonReentrant` chặn cuộc gọi đệ quy | Reverted với Custom Error: `ReentrancyGuardReentrantCall` | **PASSED** |
| **SEC-04** | Tổng chi tiêu mua NFT trong 24h vượt quá `DAILY_SPENDING_LIMIT` | [`NFTTreasury.spec.ts`](file:///d:/Visual%20studio%20code/Blockchain/test/NFTTreasury.spec.ts) | Chặn lệnh mua vượt trần ngày; tự làm mới sau 24h | Reverted: `Treasury: Daily spending limit exceeded` | **PASSED** |
| **SEC-05** | Security Council kích hoạt Pause khẩn cấp có thời hạn | [`NFTTreasury.spec.ts`](file:///d:/Visual%20studio%20code/Blockchain/test/NFTTreasury.spec.ts) | Chặn giao dịch trong thời hạn; tự động mở lại khi hết hạn (không cần gửi lệnh unpause) | Reverted: `Treasury: Trading paused`, tự mở sau `pausedUntil` | **PASSED** |
| **SEC-06** | Thực thi giao dịch sau khi đã quá hạn `deadline` | [`NFTTreasury.spec.ts`](file:///d:/Visual%20studio%20code/Blockchain/test/NFTTreasury.spec.ts) | Chống khớp lệnh trễ khi giá thị trường biến động | Reverted: `Treasury: Transaction expired` | **PASSED** |
| **SEC-07** | Thành viên giữ token nhưng không gọi `delegate()` trước Snapshot | [`GovernanceSecurity.spec.ts`](file:///d:/Visual%20studio%20code/Blockchain/test/GovernanceSecurity.spec.ts) | Điểm voting power tại Snapshot bằng 0, không thể biểu quyết | `getPastVotes(bob, snapshot) == 0` | **PASSED** |
| **SEC-08** | Lệnh hoàn tiền thừa (`refund`) từ phía Adapter gặp sự cố | [`NFTTreasury.spec.ts`](file:///d:/Visual%20studio%20code/Blockchain/test/NFTTreasury.spec.ts) | Tính nguyên tử của EVM đảm bảo toàn bộ giao dịch revert | Reverted: `MaliciousAdapter: Simulated refund crash` | **PASSED** |
| **SEC-09** | Đề xuất chứa Multi-call gom nhiều lệnh mua có tổng vượt trần | [`GovernanceSecurity.spec.ts`](file:///d:/Visual%20studio%20code/Blockchain/test/GovernanceSecurity.spec.ts) | Hàm `propose()` quét calldata và từ chối tạo đề xuất | Reverted: `Governor: Total maxPrice exceeds proposal spending limit` | **PASSED** |
| **SEC-10** | Tấn công Replay: Gọi thực thi 2 lần trên cùng một proposal | [`GovernanceSecurity.spec.ts`](file:///d:/Visual%20studio%20code/Blockchain/test/GovernanceSecurity.spec.ts) | Timelock/Governor từ chối do trạng thái đề xuất không hợp lệ | Reverted với Custom Error: `GovernorUnexpectedProposalState` | **PASSED** |
| **SEC-11** | Adapter gian lận khai báo sai `actualPrice` so với ETH thực trả | [`NFTTreasury.spec.ts`](file:///d:/Visual%20studio%20code/Blockchain/test/NFTTreasury.spec.ts) | Treasury phát hiện chênh lệch số dư không khớp với báo cáo | Reverted: `Treasury: Revenue/Refund mismatch` | **PASSED** |

---

## 3. BẢNG ĐỘ BAO PHỦ MÃ NGUỒN ĐƯỢC GHI NHẬN (COVERAGE REPORT)

Bảng dưới đây là kết quả được lưu trong tài liệu/báo cáo coverage của dự án; cần chạy lại `npm run coverage` để xác nhận với trạng thái mã nguồn hiện tại.

```
----------------------------------|----------|----------|----------|----------|----------------|
File                              |  % Stmts | % Branch |  % Funcs |  % Lines | Uncovered Lines|
----------------------------------|----------|----------|----------|----------|----------------|
 contracts/adapters/              |      100 |       60 |      100 |      100 |                |
  SafeMarketplaceAdapter.sol      |      100 |       60 |      100 |      100 |                |
 contracts/core/                  |      100 |    85.53 |      100 |      100 |                |
  NFTTreasury.sol                 |      100 |    85.53 |      100 |      100 |                |
 contracts/governance/            |     87.5 |    68.18 |    90.48 |    87.23 |                |
  GovToken.sol                    |      100 |       50 |      100 |      100 |                |
  NFTDaoGovernor.sol              |    84.85 |       70 |    86.67 |       85 | 186            |
 contracts/interfaces/            |      100 |      100 |      100 |      100 |                |
  INFTMarketplaceAdapter.sol      |      100 |      100 |      100 |      100 |                |
  INFTTreasury.sol                |      100 |      100 |      100 |      100 |                |
 contracts/mocks/                 |    75.93 |    52.38 |    83.33 |    76.92 |                |
  MockNFT.sol                     |      100 |      100 |      100 |      100 |                |
  MockMarketplace.sol             |      100 |       55 |       75 |    96.43 | 42             |
  MaliciousMarketplaceAdapter.sol |    55.17 |       50 |    83.33 |    61.11 |                |
----------------------------------|----------|----------|----------|----------|----------------|
 All files                        |    88.24 |       72 |     91.3 |    88.65 |                |
----------------------------------|----------|----------|----------|----------|----------------|
```

> **Nhận xét**: Số liệu coverage là số liệu tại lần chạy được ghi nhận, không tự chứng minh chất lượng hay mức độ an toàn; `NFTDaoGovernor.sol` và các nhánh của một số hợp đồng chưa đạt 100%.

---

## 4. QUY TRÌNH KIỂM TRA LUỒNG TOÀN DIỆN (FULL E2E LIFECYCLE)

Bài test E2E kiểm chứng chu trình trọn vẹn từ lúc khởi xướng đến khi tài sản NFT thuộc về Kho bạc:

```
[Alice: Tạo Proposal] ──> [Voting Delay: 1 ngày] ──> [Alice Cast Vote: FOR]
                                                              │
                                                              ▼
[Queue vào Timelock]  <── [Đạt Quorum 4% & Passed] <── [Voting Period: 3 ngày]
        │
        ▼
[Timelock Delay: 48 giờ (Observation Window)]
        │ (Security Council có thể Veto)
        ▼
[Execute Proposal]
        │
        ├─> Timelock gọi: NFTTreasury.executeBuyNFT(...)
        ├─> Treasury chi tối đa maxPrice sang SafeMarketplaceAdapter (trong script triển khai mẫu kết nối MockMarketplace)
        ├─> Adapter khớp lệnh tại Marketplace với giá thực tế
        ├─> Adapter nhận NFT và chuyển giao sang Treasury
        ├─> Adapter hoàn trả toàn bộ ETH dư thừa về lại Treasury
        └─> Treasury xác thực: ownerOf(tokenId) == Treasury && netSpent == actualPrice
```

---

## 5. HƯỚNG DẪN THỰC THI VÀ VẬN HÀNH (OPERATIONAL COMMANDS)

### 5.1. Biên dịch Hợp đồng
```powershell
npm run compile
```

### 5.2. Chạy Toàn Bộ Test Suite (19 Test Cases)
```powershell
npm test
```

### 5.3. Chạy Từng File Test Riêng Lẻ
- Kiểm tra riêng Kho bạc và Adapter:
  ```powershell
  npx hardhat test test/NFTTreasury.spec.ts
  ```
- Kiểm tra riêng Quản trị, Timelock và Veto:
  ```powershell
  npx hardhat test test/GovernanceSecurity.spec.ts
  ```

### 5.4. Xuất Báo Cáo Code Coverage
```powershell
npm run coverage
```
Báo cáo HTML chi tiết được lưu tự động tại thư mục: [`coverage/index.html`](file:///d:/Visual%20studio%20code/Blockchain/coverage/index.html).

### 5.5. Chạy Script Triển Khai Thực Nghiệm (Local Node / Simulation)
```powershell
npm run deploy
```
Script sẽ khởi tạo đầy đủ:
1. `GovToken` (1,000,000 token)
2. `TimelockController` (Delay 48h)
3. `NFTTreasury` (Hạn mức 5 ETH/call, 10 ETH/day)
4. `NFTDaoGovernor` (Ngưỡng 8 ETH/proposal, Quorum 4%)
5. `MockMarketplace` & `SafeMarketplaceAdapter`
6. Tự động bàn giao toàn quyền Admin về cho Timelock và rút quyền Deployer EOA.
