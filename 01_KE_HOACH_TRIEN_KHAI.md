# KẾ HOẠCH TRIỂN KHAI DỰ ÁN: SECURE COLLECTOR DAO

Tài liệu này xác định lộ trình thực hiện, các giai đoạn phát triển, danh sách công việc cụ thể và các tiêu chí hoàn thành (Definition of Done) cho đề tài Xây dựng DAO quản lý bộ sưu tập NFT an toàn.

---

## 1. NGUYÊN TẮC THỰC HIỆN
- **Test-Driven Development (TDD)**: Viết interface và viết bộ test case trước hoặc song song với việc viết logic thực thi.
- **Phát triển từ lõi ra biên**: Triển khai và kiểm thử an toàn tầng lưu ký tài sản (`NFTTreasury`) trước, sau đó phát triển tầng kết nối (`Adapter`), cuối cùng mới tích hợp hệ thống quản trị (`Governor` & `Timelock`).
- **Xác thực độc hại (Adversarial Testing)**: Mỗi tính năng đều phải có ít nhất 1 bài test giả lập kẻ tấn công hoặc hợp đồng đối tác độc hại.

---

## 2. LỘ TRÌNH 4 GIAI ĐOẠN (ROADMAP)

```
┌────────────────────────────────────────────────────────┐
│ GIAI ĐOẠN 1: KHỞI TẠO MÔI TRƯỜNG & HỢP ĐỒNG KHO BẠC   │
│ - Cấu hình dự án (Foundry/Hardhat)                    │
│ - Viết INFTMarketplaceAdapter.sol                      │
│ - Viết NFTTreasury.sol (Hạn mức ngày, Pause, Refund)   │
└────────────────────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ GIAI ĐOẠN 2: PHÁT TRIỂN ADAPTER & MOCK MARKETPLACE     │
│ - Viết MockERC721.sol                                  │
│ - Viết MockMarketplace.sol                             │
│ - Viết SafeAdapter.sol & MaliciousAdapter.sol          │
│ - Chạy bộ Test Unit kiểm tra luồng tiền                │
└────────────────────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ GIAI ĐOẠN 3: HỆ THỐNG QUẢN TRỊ (GOVERNANCE SYSTEM)     │
│ - Viết GovToken.sol (ERC20Votes, ERC-6372 Timestamp)   │
│ - Cấu hình OpenZeppelin TimelockController             │
│ - Viết NFTDaoGovernor.sol (Quét trần đề xuất Multi-call)│
└────────────────────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ GIAI ĐOẠN 4: TÍCH HỢP TOÀN DIỆN & BỘ KIỂM THỬ BẢO MẬT │
│ - Chạy toàn bộ 11 kịch bản kiểm thử bảo mật (SEC-01..11)│
│ - Đo lường độ bao phủ mã nguồn (Coverage > 95%)        │
│ - Đóng gói tài liệu báo cáo kỹ thuật                   │
└────────────────────────────────────────────────────────┘
```

---

## 3. DANH SÁCH CÔNG VIỆC CHI TIẾT (TASK BREAKDOWN)

### Giai đoạn 1: Lõi Lưu ký & Kho bạc (`NFTTreasury`)
- [x] Thiết lập thư mục dự án với thư viện `@openzeppelin/contracts` (v5.x).
- [x] Định nghĩa interface `INFTMarketplaceAdapter.sol`:
  - `buyNFT(address nftContract, uint256 tokenId, uint256 maxPrice) external payable returns (uint256 actualPrice)`
  - `sellNFT(address nftContract, uint256 tokenId, uint256 minRevenue) external returns (uint256 netRevenue)`
- [x] Xây dựng hợp đồng `NFTTreasury.sol`:
  - Kế thừa `ERC721Holder`, `ReentrancyGuard`, `AccessControl`.
  - Khai báo hàm `receive() external payable {}` rỗng, không chứa logic.
  - Cài đặt `executeBuyNFT(...)` với đối chiếu chéo `netSpent == actualPrice`.
  - Cài đặt `executeSellNFT(...)` với xác nhận chuyển giao NFT và kiểm tra doanh thu ròng.
  - Cài đặt giới hạn `MAX_PER_CALL_LIMIT` và `DAILY_SPENDING_LIMIT`.
  - Cài đặt cơ chế `pausedUntil` cho Security Council.

### Giai đoạn 2: Tầng Adapter & Môi trường Giả lập
- [x] Viết `MockNFT.sol` (ERC-721 chuẩn để mint test).
- [x] Viết `MockMarketplace.sol` (Mô phỏng sàn giao dịch niêm yết và khớp lệnh mua/bán bằng ETH).
- [x] Viết `SafeMarketplaceAdapter.sol`:
  - Khớp lệnh mua/bán đúng giá.
  - Hoàn trả chính xác `msg.value - actualPrice` về lại cho Treasury.
- [x] Viết `MaliciousMarketplaceAdapter.sol` nhằm phục vụ testing:
  - Cố tình giữ lại tiền thừa (không refund).
  - Cố tình báo cáo sai `actualPrice`.
  - Cố tình thực hiện reentrancy gọi ngược lại Treasury.
  - Cố tình chuyển sai `tokenId`.

### Giai đoạn 3: Tầng Quản trị & Đồng chế thời gian
- [x] Xây dựng `GovToken.sol`:
  - Kế thừa `ERC20`, `ERC20Votes`, `ERC20Permit`.
  - Override `clock()` và `CLOCK_MODE()` theo chuẩn `ERC-6372` để sử dụng `block.timestamp`.
- [x] Triển khai `TimelockController.sol` của OpenZeppelin:
  - Cấu hình `minDelay = 2 days` (48 giờ).
  - Cấp vai trò: `PROPOSER_ROLE` cho Governor, `EXECUTOR_ROLE` cho `address(0)`, `CANCELLER_ROLE` cho Security Council và Governor.
  - Bàn giao quyền Admin của Timelock cho chính địa chỉ của Timelock.
- [x] Xây dựng `NFTDaoGovernor.sol`:
  - Kế thừa `Governor`, `GovernorSettings`, `GovernorCountingSimple`, `GovernorVotes`, `GovernorVotesQuorumFraction`, `GovernorTimelockControl`.
  - Override hàm `propose()`: Quét toàn bộ `calldatas` nhắm tới Treasury, giải mã các tham số `maxPrice`, kiểm tra điều kiện tổng $\sum \text{maxPrice} \le \text{MAX\_PER\_PROPOSAL\_LIMIT}$.

### Giai đoạn 4: Bộ kiểm thử Bảo mật & Đánh giá
- [x] Viết bộ test `TreasurySecurityTest`: Thực thi các kịch bản SEC-01 đến SEC-08 và SEC-11.
- [x] Viết bộ test `GovernorGovernanceTest`: Thực thi các kịch bản SEC-05, SEC-06, SEC-07, SEC-09, SEC-10.
- [x] Chạy kiểm tra Code Coverage, tối ưu hóa Gas.
- [x] Tổng hợp báo cáo kết quả kiểm thử.

---

## 4. MA TRẬN 11 BÀI KIỂM THỬ BẢO MẬT (ACCEPTANCE CRITERIA)

| Mã test | Kịch bản kiểm tra | Kỳ vọng |
| :---: | :--- | :--- |
| **SEC-01** | Adapter không hoàn lại tiền thừa từ `maxPrice` | Giao dịch `revert`, Treasury không mất tiền |
| **SEC-02** | Adapter gửi sai NFT `tokenId` về Treasury | Giao dịch `revert` do không sở hữu đúng token |
| **SEC-03** | Adapter thực hiện tấn công Reentrancy vào Treasury | Bị chặn bởi `nonReentrant` |
| **SEC-04** | Tổng chi tiêu trong ngày vượt `DAILY_SPENDING_LIMIT` | Giao dịch thứ $N$ vượt hạn mức bị `revert` |
| **SEC-05** | Security Council kích hoạt Pause có thời hạn | Không giao dịch được trong thời hạn; tự mở lại khi hết hạn |
| **SEC-06** | Thực thi giao dịch sau khi đã quá `deadline` | Giao dịch `revert("Transaction expired")` |
| **SEC-07** | Thành viên giữ token nhưng không delegate trước Snapshot | Điểm voting power tại Snapshot bằng 0 |
| **SEC-08** | Lệnh hoàn tiền thừa (`refund`) bị lỗi kỹ thuật | Toàn bộ giao dịch rollback an toàn |
| **SEC-09** | Proposal chứa nhiều lệnh mua có tổng vượt trần | Hàm `propose()` trên Governor từ chối tạo |
| **SEC-10** | Gọi thực thi 2 lần trên cùng một proposal | Timelock từ chối do đã thực thi (`already executed`) |
| **SEC-11** | Adapter gian lận khai báo sai `actualPrice` | Bị phát hiện do chênh lệch số dư không khớp, `revert` |
