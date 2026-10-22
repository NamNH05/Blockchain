# CÔNG NGHỆ VÀ TIÊU CHUẨN KỸ THUẬT SỬ DỤNG (TECH STACK & STANDARDS)

Tài liệu này tổng hợp toàn bộ các ngôn ngữ, framework, thư viện tiêu chuẩn, các EIPs được ứng dụng và lý do lựa chọn kỹ thuật cho hệ thống Secure Collector DAO.

---

## 1. TỔNG QUAN STACK CÔNG NGHỆ

| Thành phần | Công nghệ / Thư viện | Phiên bản | Mục đích sử dụng |
| :--- | :--- | :--- | :--- |
| **Ngôn ngữ Smart Contract** | Solidity | `^0.8.24` | Trình biên dịch hỗ trợ EVM Cancun, tích hợp sẵn kiểm tra tràn số (Overflow/Underflow) |
| **Framework Phát triển & Test** | Foundry (`forge`, `cast`) | Mới nhất | Viết test bằng chính Solidity, thực thi cực nhanh, hỗ trợ Fuzz testing, Mock call và Time-travel |
| **Thư viện Hợp đồng Chuẩn** | `@openzeppelin/contracts` | `v5.0.x` | Bộ thư viện tiêu chuẩn ngành cho Governance, Token, Timelock và Security |
| **Framework Thay thế (Tùy chọn)** | Hardhat | `^2.22.x` | Nếu cần tích hợp backend JavaScript/TypeScript hoặc viết migration script |

---

## 2. CÁC TIÊU CHUẨN EIP / ERC ĐƯỢC ỨNG DỤNG

### 2.1. `ERC-721`: Non-Fungible Token Standard
- **Áp dụng tại**: Các tác phẩm NFT trong bộ sưu tập và `IERC721Receiver` trên `NFTTreasury`.
- **Hợp đồng kế thừa**: `@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol`.
- **Lý do**: Đảm bảo Treasury có thể nhận và lưu ký an toàn các NFT ERC-721 mà không bị kẹt token (thông qua hàm `onERC721Received`).

### 2.2. `ERC-20` & `ERC20Votes`: Governance Token với Snapshot
- **Áp dụng tại**: `GovToken.sol`.
- **Module sử dụng**:
  - `ERC20`: Quản lý số dư token của các thành viên.
  - `ERC20Votes`: Quản lý điểm biểu quyết lịch sử (Historical Checkpoints), cho phép truy vấn điểm voting tại một thời điểm quá khứ mà không bị ảnh hưởng bởi các giao dịch mua/bán sau đó.
  - `ERC20Permit`: Hỗ trợ ký ủy quyền không tốn gas (EIP-2612).

### 2.3. `ERC-6372`: Contract Clock Standard
- **Áp dụng tại**: `GovToken.sol` và `NFTDaoGovernor.sol`.
- **Lý do**: Chuẩn hóa cơ chế đo lường thời gian. Thay vì mặc định theo số block (dễ bị sai lệch khi triển khai trên các mạng L2 như Arbitrum, Optimism hoặc Base), hệ thống cấu hình:
  - `clock() returns (uint48)`: Trả về `block.timestamp`.
  - `CLOCK_MODE() returns (string)`: Trả về `"mode=timestamp"`.

### 2.4. `ERC-165`: Standard Interface Detection
- **Áp dụng tại**: Kiểm tra chuẩn giao diện giữa `NFTTreasury` và các hợp đồng bộ sưu tập đối tác.

---

## 3. CÁC MODULE OPENZEPPELIN V5 ĐƯỢC SỬ DỤNG

### 3.1. Phân hệ Quản trị (`Governor`)
- `Governor.sol`: Lõi điều phối vòng đời của một Proposal (Pending $\rightarrow$ Active $\rightarrow$ Succeeded $\rightarrow$ Queued $\rightarrow$ Executed).
- `GovernorSettings.sol`: Quản lý các tham số quản trị có thể tinh chỉnh:
  - `votingDelay`: 1 ngày (thời gian chờ trước khi mở cổng vote).
  - `votingPeriod`: 3 ngày (thời gian mở cổng vote).
  - `proposalThreshold`: Ngưỡng token tối thiểu để được tạo đề xuất (1% tổng cung).
- `GovernorCountingSimple.sol`: Bộ đếm phiếu cơ bản (3 lựa chọn: *Against*, *For*, *Abstain*).
- `GovernorVotes.sol`: Kết nối Governor với nguồn điểm voting (`ERC20Votes`).
- `GovernorVotesQuorumFraction.sol`: Định nghĩa tỷ lệ túc số tham gia tối thiểu (ví dụ: 4% tổng cung) để một đề xuất được công nhận hợp lệ.
- `GovernorTimelockControl.sol`: Kết nối trực tiếp Governor với `TimelockController`.

### 3.2. Phân hệ Bảo mật & Kiểm soát Truy cập
- `ReentrancyGuard.sol`: Sử dụng modifier `nonReentrant` cho mọi hàm di chuyển tài sản (mua, bán) trong `NFTTreasury`.
- `AccessControl.sol`: Quản lý vai trò theo mã định danh `bytes32`:
  - `TIMELOCK_ROLE`: Vai trò tối cao để điều khiển các lệnh chi tiền trên Treasury.
  - `SECURITY_COUNCIL_ROLE`: Vai trò tạm dừng khẩn cấp có thời hạn.
- `TimelockController.sol`: Bộ đếm lùi thời gian độc lập của OpenZeppelin, giữ lệnh trong 48 giờ trước khi thực thi.

---

## 4. TẠI SAO LỰA CHỌN FOUNDRY LÀM TOOLCHAIN CHÍNH?

1. **Viết Test bằng Solidity nguyên bản**: Không cần chuyển đổi kiểu dữ liệu phức tạp qua ethers.js hay viem, kiểm thử các thao tác `calldata` và `struct` trực tiếp.
2. **Cheatcodes mạnh mẽ cho Quản trị**:
   - `vm.warp(timestamp)`: Dễ dàng mô phỏng thời gian trôi qua (bỏ phiếu 3 ngày, timelock 48h, pause 7 ngày).
   - `vm.roll(blockNumber)`: Kiểm tra tương tác với số block.
   - `vm.prank(address)`: Đóng vai bất kỳ thành viên nào trong DAO hoặc Timelock để kiểm tra phân quyền.
   - `vm.deal(address, balance)`: Bơm ETH nhanh chóng cho Treasury để test các kịch bản mua sắm.
3. **Hiệu năng & Fuzz Testing**: Chạy hàng nghìn kịch bản ngẫu nhiên cho các tham số `maxPrice`, `actualPrice` chỉ trong vài giây.
