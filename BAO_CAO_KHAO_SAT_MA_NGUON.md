# BÁO CÁO KHẢO SÁT MÃ NGUỒN CHUYÊN SÂU: DỰ ÁN SECURE COLLECTOR DAO

**Người thực hiện khảo sát:** Báo cáo khảo sát dự án  
**Phạm vi khảo sát:** Thư mục `D:\Visual studio code\Blockchain`  
**Thời điểm thực hiện:** 22/10/2026  
**Nguyên tắc thực hiện:**
1. Giữ nguyên trạng mã nguồn (Read-Only), không can thiệp sửa đổi code trong quá trình khảo sát.
2. Các kết luận cần đối chiếu với mã nguồn hiện tại; kết quả kiểm thử/coverage được nêu là kết quả ghi nhận tại thời điểm chạy, không bảo đảm còn tương ứng sau thay đổi mã nguồn.
3. Không phỏng đoán số liệu kiểm thử hay giao dịch khi chưa có bằng chứng thực thi.

---

## MỤC LỤC BÁO CÁO
- [A. Cấu Trúc Thư Mục và Vai Trò Các File Chính](#a-cấu-trúc-thư-mục-và-vai-trò-các-file-chính)
- [B. Bảng Đối Chiếu Mục Lục Toàn Diện Dự Án](#b-bảng-đối-chiếu-mục-lục-toàn-diện-dự-án)
- [C. Mô Tả Kiến Trúc Thực Tế, Luồng Dữ Liệu và Phân Quyền](#c-mô-tả-kiến-trúc-thực-tế-luồng-dữ-liệu-và-phân-quyền)
- [D. Bảng Test Case Chi Tiết và Kết Quả Chạy Thực Tế](#d-bảng-test-case-chi-tiết-và-kết-quả-chạy-thực-tế)
- [E. Danh Sách Vấn Đề Bảo Mật Phát Hiện Được](#e-danh-sách-vấn-đề-bảo-mật-phát-hiện-được)
- [F. Bản Ghi Môi Trường và Lệnh Kiểm Tra](#f-bản-ghi-môi-trường-và-lệnh-kiểm-tra)
- [G. Những Câu Hỏi Cần Nhà Phát Triển Xác Nhận](#g-những-câu-hỏi-cần-nhà-phát-triển-xác-nhận)

---

## A. CẤU TRÚC THƯ MỤC VÀ VAI TRÒ CÁC FILE CHÍNH

Hệ thống được tổ chức theo cấu trúc tiêu chuẩn của một dự án Web3/Hardhat kết hợp Frontend:

```
D:\Visual studio code\Blockchain
│
├── contracts/                               # Toàn bộ Smart Contracts bằng Solidity (^0.8.24)
│   ├── core/
│   │   └── NFTTreasury.sol                  # Hợp đồng kho bạc lưu ký tài sản, kiểm soát hạn mức & pause
│   ├── governance/
│   │   ├── GovToken.sol                     # Token biểu quyết ERC20Votes (ERC-6372 Timestamp Clock)
│   │   └── NFTDaoGovernor.sol              # Hợp đồng Governor tùy biến quét trần calldata multi-call
│   ├── interfaces/
│   │   ├── INFTMarketplaceAdapter.sol       # Chuẩn giao diện Adapter mua/bán NFT với sàn ngoài
│   │   └── INFTTreasury.sol                 # Chuẩn giao diện tương tác và sự kiện của Treasury
│   ├── adapters/
│   │   └── SafeMarketplaceAdapter.sol       # Adapter an toàn (khớp lệnh đúng giá, hoàn tiền thừa)
│   └── mocks/
│       ├── MockNFT.sol                      # NFT ERC-721 phục vụ giả lập
│       ├── MockMarketplace.sol              # Sàn giao dịch giả lập khớp lệnh niêm yết bằng ETH
│       └── MaliciousMarketplaceAdapter.sol  # Adapter đối kháng (giả lập 5 chế độ tấn công kiểm thử)
│
├── test/                                    # Bộ kiểm thử đơn vị và bảo mật tự động hóa (Mocha/Chai/Ethers)
│   ├── NFTTreasury.spec.ts                  # Kiểm thử Kho bạc, giới hạn, quyền hạn, SEC-01..06, SEC-08, SEC-11
│   └── GovernanceSecurity.spec.ts           # Kiểm thử Quản trị, Timelock 48h, Veto, Snapshot, SEC-07, 09, 10
│
├── scripts/
│   └── deploy.ts                            # Kịch bản triển khai 6 bước và chuyển giao quyền hạn khép kín
│
├── frontend/                                # Ứng dụng Web Dashboard giao diện người dùng
│   ├── src/
│   │   ├── main.ts                          # Điều phối logic tương tác, chuyển tab, giả lập tấn công
│   │   ├── state.ts                         # Quản lý trạng thái kho bạc, đề xuất, mock personas
│   │   └── style.css                        # Hệ thống thiết kế Vanilla CSS Dark-mode / Glassmorphism
│   ├── index.html                           # Cấu trúc HTML5 chuẩn SEO
│   └── package.json                         # Dependencies của ứng dụng Frontend (Vite, Ethers, Canvas-confetti)
│
├── hardhat.config.ts                        # Hardhat local, Solidity 0.8.24, Cancun EVM, Optimizer
├── package.json                             # Cấu hình gói và dependencies gốc (@openzeppelin/contracts v5.6.1)
├── tsconfig.json                            # Cấu hình TypeScript cho Hardhat
├── .gitignore                               # Loại trừ artifacts, cache, node_modules, coverage
│
└── Tài liệu thiết kế & Báo cáo:
    ├── 01_KE_HOACH_TRIEN_KHAI.md            # Kế hoạch phát triển 4 giai đoạn và ma trận 11 bài test
    ├── 02_KIEN_TRUC_HE_THONG.md             # Kiến trúc phân tách 4 tầng và Access Control Matrix
    ├── 03_XU_LY_NGHIEP_VU_VA_BAO_MAT.md     # Đặc tả thuật toán chi tiết và mô hình đe dọa (Threat Model)
    ├── 04_CONG_NGHE_SU_DUNG.md              # Tiêu chuẩn kỹ thuật EIP/ERC và lý do lựa chọn công nghệ
    └── 05_KET_QUA_KIEM_THU_VA_TRIEN_KHAI.md # Báo cáo kết quả kiểm thử và độ bao phủ mã nguồn
```

---

## B. BẢNG ĐỐI CHIẾU MỤC LỤC TOÀN DIỆN DỰ ÁN

Dưới đây là bảng đối chiếu từng đầu mục chức năng và nghiệp vụ giữa **Tài liệu thiết kế** và **Mã nguồn thực tế**:

| Hạng mục nghiệp vụ | Phân loại trạng thái | Bằng chứng mã nguồn (File, Contract, Function, Line) | Bằng chứng kiểm thử (Test Case, Status) |
| :--- | :---: | :--- | :--- |
| **1. Kho bạc lưu ký NFT (`ERC721Holder`)** | `IMPLEMENTED` | [`NFTTreasury.sol`](file:///d:/Visual%20studio%20code/Blockchain/contracts/core/NFTTreasury.sol#L16): Kế thừa `ERC721Holder`. | `NFTTreasury.spec.ts`: Happy Path Buy NFT (`PASSED`) |
| **2. Hàm nhận ETH an toàn (`receive()`)** | `IMPLEMENTED` | [`NFTTreasury.sol:78`](file:///d:/Visual%20studio%20code/Blockchain/contracts/core/NFTTreasury.sol#L78): `receive() external payable {}` rỗng hoàn toàn, không gas trap. | `NFTTreasury.spec.ts`: SEC-01, Refund excess test (`PASSED`) |
| **3. Trần chi tiêu đơn lệnh (`maxPerCallLimit`)** | `IMPLEMENTED` | [`NFTTreasury.sol:133`](file:///d:/Visual%20studio%20code/Blockchain/contracts/core/NFTTreasury.sol#L133): `require(maxPrice <= maxPerCallLimit, "Treasury: Max call limit exceeded");` | `NFTTreasury.spec.ts`: Buy pre-condition checks (`PASSED`) |
| **4. Hạn mức chi tiêu ngày (`dailySpendingLimit`)** | `IMPLEMENTED` | [`NFTTreasury.sol:203-207`](file:///d:/Visual%20studio%20code/Blockchain/contracts/core/NFTTreasury.sol#L203-L207): `_recordDailySpending` gom nhóm `block.timestamp / 1 days`. | `NFTTreasury.spec.ts`: SEC-04 Daily limit exceeded (`PASSED`) |
| **5. Đối chiếu số dư thực chi (`netSpent == actualPrice`)** | `IMPLEMENTED` | [`NFTTreasury.sol:144-147`](file:///d:/Visual%20studio%20code/Blockchain/contracts/core/NFTTreasury.sol#L144-L147): `uint256 netSpent = balanceBefore - address(this).balance; require(netSpent == actualPrice, ...);` | `NFTTreasury.spec.ts`: SEC-01, SEC-11 (`PASSED`) |
| **6. Xác thực quyền sở hữu NFT sau mua/bán** | `IMPLEMENTED` | [`NFTTreasury.sol:143`](file:///d:/Visual%20studio%20code/Blockchain/contracts/core/NFTTreasury.sol#L143) (Mua: `ownerOf == address(this)`), [`NFTTreasury.sol:186`](file:///d:/Visual%20studio%20code/Blockchain/contracts/core/NFTTreasury.sol#L186) (Bán: `ownerOf != address(this)`). | `NFTTreasury.spec.ts`: SEC-02 wrong token, Sell test (`PASSED`) |
| **7. Phê duyệt chuyển nhượng tối thiểu (Scoped Approval)** | `IMPLEMENTED` | [`NFTTreasury.sol:179`](file:///d:/Visual%20studio%20code/Blockchain/contracts/core/NFTTreasury.sol#L179): `IERC721(collection).approve(adapter, tokenId);` chỉ approve đúng 1 tokenId cho adapter. | `NFTTreasury.spec.ts`: Happy Path Sell NFT (`PASSED`) |
| **8. Cơ chế Pause khẩn cấp có thời hạn (`pausedUntil`)** | `IMPLEMENTED` | [`NFTTreasury.sol:87-91`](file:///d:/Visual%20studio%20code/Blockchain/contracts/core/NFTTreasury.sol#L87-L91): `pauseTrading(uint256 duration)` chặn `<= 7 days`. Modifier `whenNotPaused` tự mở khi qua hạn. | `NFTTreasury.spec.ts`: SEC-05 Pause trading (`PASSED`) |
| **9. Danh sách trắng Adapter & Collection** | `IMPLEMENTED` | [`NFTTreasury.sol:96-109`](file:///d:/Visual%20studio%20code/Blockchain/contracts/core/NFTTreasury.sol#L96-L109): `setWhitelistAdapter`, `setWhitelistCollection` chỉ cho phép `TIMELOCK_ROLE`. | `NFTTreasury.spec.ts`: Access control, Whitelist checks (`PASSED`) |
| **10. Chống Reentrancy đa tầng** | `IMPLEMENTED` | [`NFTTreasury.sol:129, 172`](file:///d:/Visual%20studio%20code/Blockchain/contracts/core/NFTTreasury.sol#L129): `nonReentrant` là modifier ngoài cùng của `executeBuyNFT` và `executeSellNFT`. | `NFTTreasury.spec.ts`: SEC-03 Reentrancy test (`PASSED`) |
| **11. Chống thực thi quá hạn (`deadline`)** | `IMPLEMENTED` | [`NFTTreasury.sol:130, 173`](file:///d:/Visual%20studio%20code/Blockchain/contracts/core/NFTTreasury.sol#L130): `require(block.timestamp <= deadline, "Treasury: Transaction expired");` | `NFTTreasury.spec.ts`: SEC-06 Deadline expired (`PASSED`) |
| **12. Token Quản trị Snapshot (`GovToken`)** | `IMPLEMENTED` | [`GovToken.sol:13`](file:///d:/Visual%20studio%20code/Blockchain/contracts/governance/GovToken.sol#L13): Kế thừa `ERC20`, `ERC20Permit`, `ERC20Votes`. | `GovernanceSecurity.spec.ts`: SEC-07, Token minting (`PASSED`) |
| **13. Chuẩn đo lường thời gian ERC-6372** | `IMPLEMENTED` | [`GovToken.sol:34-45`](file:///d:/Visual%20studio%20code/Blockchain/contracts/governance/GovToken.sol#L34-L45): Override `clock()` trả về `block.timestamp` và `CLOCK_MODE()` trả về `"mode=timestamp"`. | `GovernanceSecurity.spec.ts`: CLOCK_MODE test (`PASSED`) |
| **14. Cửa sổ quan sát Timelock 48h (`minDelay`)** | `IMPLEMENTED` | [`scripts/deploy.ts:24`](file:///d:/Visual%20studio%20code/Blockchain/scripts/deploy.ts#L24), [`GovernanceSecurity.spec.ts:32`](file:///d:/Visual%20studio%20code/Blockchain/test/GovernanceSecurity.spec.ts#L32): `minDelay = 2 * 86400` (48 giờ). | `GovernanceSecurity.spec.ts`: Timelock delay wait (`PASSED`) |
| **15. Quét trần Multi-Call trên Governor (`propose`)** | `IMPLEMENTED` | [`NFTDaoGovernor.sol:84-110`](file:///d:/Visual%20studio%20code/Blockchain/contracts/governance/NFTDaoGovernor.sol#L84-L110): Quét calldata gọi `executeBuyNFT`, giải mã `maxPrice`, kiểm tra $\sum maxPrice \le \text{MAX\_LIMIT}$. | `GovernanceSecurity.spec.ts`: SEC-09 Multi-call cap (`PASSED`) |
| **16. Quyền Veto của Security Council trong Timelock** | `IMPLEMENTED` | [`NFTDaoGovernor.sol:62-69`](file:///d:/Visual%20studio%20code/Blockchain/contracts/governance/NFTDaoGovernor.sol#L62-L69): Override `_validateCancel` cho phép `securityCouncil` hủy đề xuất; Timelock cấp `CANCELLER_ROLE`. | `GovernanceSecurity.spec.ts`: Security Council Veto (`PASSED`) |
| **17. Chống Replay Execution (Chạy lại lệnh đã thực thi)** | `IMPLEMENTED` | Kế thừa từ `GovernorTimelockControl` và `TimelockController`. | `GovernanceSecurity.spec.ts`: SEC-10 Replay reject (`PASSED`) |
| **18. Khép kín quyền Admin (Loại bỏ EOA Deployer)** | `IMPLEMENTED` | [`scripts/deploy.ts:79-87`](file:///d:/Visual%20studio%20code/Blockchain/scripts/deploy.ts#L79-L87): Timelock nhận Admin chính nó, Deployer `renounceRole` trên cả Timelock và Treasury. | `scripts/deploy.ts`: Chạy mô phỏng cục bộ (`PASSED`) |
| **19. Triển khai Testnet công khai (Sepolia/Arbitrum)** | `PLANNED` | Hiện dự án mới cấu hình môi trường Hardhat EVM cục bộ (`chainId: 31337`). Chưa cấu hình RPC/Private Key cho mạng công khai. | `[CHƯA CÓ BẰNG CHỨNG TRONG PROJECT]` |
| **20. Hợp đồng Giao thức Oracle Giá ngoài (Chainlink)** | `NOT_FOUND` | Thiết kế kiến trúc sử dụng mô hình Adapter trực tiếp khớp lệnh với Marketplace, không sử dụng Oracle đẩy giá từ bên ngoài. | Không có trong mã nguồn |

---

## C. MÔ TẢ KIẾN TRÚC THỰC TẾ, LUỒNG DỮ LIỆU VÀ PHÂN QUYỀN

Đối chiếu mã nguồn Solidity hiện có, kiến trúc hệ thống hoạt động theo mô hình 4 tầng phân lập trách nhiệm:

```mermaid
flowchart TD
    subgraph TANG_1["TẦNG 1: QUYẾT ĐỊNH & KIỂM SOÁT ĐỀ XUẤT"]
        Alice["Thành viên DAO (GovToken)"] -->|propose| Gov["NFTDaoGovernor.sol"]
        Gov -->|Kiểm tra 1| CheckCap{"Σ maxPrice <= 8 ETH ?"}
        CheckCap -->|Vượt| Rev1["Revert ngay tại propose()"]
        CheckCap -->|Hợp lệ| VoteState["Bỏ phiếu: Voting Delay 1 ngày, Voting Period 3 ngày, Quorum 4%"]
    end

    subgraph TANG_2["TẦNG 2: TRÌ HOÃN & CỬA SỔ QUAN SÁT"]
        VoteState -->|Passed| Queue["queue() vào TimelockController"]
        Queue --> TL["TimelockController (minDelay = 48 giờ)"]
        Council["Security Council"] -.->|Cửa sổ 48h: Veto/Cancel| TL
    end

    subgraph TANG_3["TẦNG 3: BẢO VỆ TÀI SẢN & KHO BẠC"]
        TL -->|execute sau 48h: onlyRole(TIMELOCK_ROLE)| Tre["NFTTreasury.sol"]
        Tre -->|Pre-conditions| PreChecks{"1. whenNotPaused<br>2. block.timestamp <= deadline<br>3. Whitelist Adapter và collection ở luồng mua (bán chỉ kiểm tra Adapter)<br>4. maxPrice <= maxPerCall (5 ETH)<br>5. dailySpent + actual <= 10 ETH"}
        PreChecks -->|Hợp lệ| SnapBefore["Ghi nhận: balanceBefore = address(this).balance"]
    end

    subgraph TANG_4["TẦNG 4: THỰC THI SÀN & HOÀN TIỀN"]
        SnapBefore -->|buyNFT{value: maxPrice}| Adapt["SafeMarketplaceAdapter.sol"]
        Adapt -->|Khớp lệnh mua| Market["MockMarketplace.sol"]
        Market -->|Chuyển NFT| Adapt
        Market -->|Hoàn tiền dư| Adapt
        Adapt -->|safeTransferFrom NFT| Tre
        Adapt -->|Hoàn trả msg.value - actualPrice| Tre
        Tre --> PostChecks{"HẬU KIỂM ATOMIC:<br>1. ownerOf(tokenId) == Treasury ?<br>2. balanceBefore - balanceAfter == actualPrice ?<br>3. actualPrice > 0 && actualPrice <= maxPrice ?"}
        PostChecks -->|Sai khác| RevTreasury["Revert toàn bộ: Rollback hoàn toàn"]
        PostChecks -->|Hợp lệ| UpdateDaily["_recordDailySpending(actualPrice)<br>Ghi nhận sở hữu NFT"]
    end
```

### Chi tiết Phân Quyền Hệ Thống (Access Control Matrix Thực Tế)

1. **`TIMELOCK_ROLE` (Nắm giữ bởi `TimelockController`)**:
   - Người gọi duy nhất được phép kích hoạt:
     - `NFTTreasury.executeBuyNFT(...)` ([`NFTTreasury.sol:129`](file:///d:/Visual%20studio%20code/Blockchain/contracts/core/NFTTreasury.sol#L129))
     - `NFTTreasury.executeSellNFT(...)` ([`NFTTreasury.sol:172`](file:///d:/Visual%20studio%20code/Blockchain/contracts/core/NFTTreasury.sol#L172))
     - `NFTTreasury.setWhitelistAdapter(...)` ([`NFTTreasury.sol:96`](file:///d:/Visual%20studio%20code/Blockchain/contracts/core/NFTTreasury.sol#L96))
     - `NFTTreasury.setWhitelistCollection(...)` ([`NFTTreasury.sol:105`](file:///d:/Visual%20studio%20code/Blockchain/contracts/core/NFTTreasury.sol#L105))
     - `NFTTreasury.setSpendingLimits(...)` ([`NFTTreasury.sol:114`](file:///d:/Visual%20studio%20code/Blockchain/contracts/core/NFTTreasury.sol#L114))

2. **SECURITY_COUNCIL_ROLE (script mẫu dùng địa chỉ deployer EOA)**:
   - Được phép gọi:
     - `NFTTreasury.pauseTrading(uint256 duration)` ([`NFTTreasury.sol:87`](file:///d:/Visual%20studio%20code/Blockchain/contracts/core/NFTTreasury.sol#L87)), giới hạn cứng $\le 7$ ngày.
     - `NFTDaoGovernor.cancel(...)` / Timelock `cancel` ([`NFTDaoGovernor.sol:62`](file:///d:/Visual%20studio%20code/Blockchain/contracts/governance/NFTDaoGovernor.sol#L62)): Quyền hủy bỏ đề xuất độc hại trong Timelock.
   - **Bị cấm hoàn toàn**: Không thể rút tiền, không thể gọi `executeBuyNFT`/`executeSellNFT`, và **không được phép can thiệp danh sách Whitelist**.

3. **`EXECUTOR_ROLE` (Cấp cho `address(0)`)**:
   - Bất kỳ ai trong cộng đồng đều có thể gửi transaction kích hoạt `execute` trên Timelock sau khi đã kết thúc thời gian chờ 48 giờ. Không ai có thể thay đổi payload giao dịch đã được biểu quyết thông qua.

---

## D. BẢNG TEST CASE CHI TIẾT VÀ KẾT QUẢ CHẠY THỰC TẾ

Tài liệu kết quả ghi nhận **19 test cases** đã thực thi trên môi trường Hardhat Network (EVM target: `cancun`). Không có test nào bị skip hoặc fail:

| STT | File Test | Tên Test Case | Mục Tiêu & Cơ Chế Kiểm Tra | Kết Quả Thực Tế | Trạng Thái |
| :---: | :--- | :--- | :--- | :--- | :---: |
| 1 | [`GovernanceSecurity.spec.ts`](file:///d:/Visual%20studio%20code/Blockchain/test/GovernanceSecurity.spec.ts#L133) | `SEC-07: Member holds token but does not delegate before Snapshot` | Kiểm tra điểm voting power tại snapshot của Bob (người không gọi `delegate()`). Kỳ vọng = 0. | `getPastVotes == 0` | **PASSED** |
| 2 | [`GovernanceSecurity.spec.ts`](file:///d:/Visual%20studio%20code/Blockchain/test/GovernanceSecurity.spec.ts#L150) | `SEC-09: Proposal containing multiple buy calls whose sum exceeds limit` | Tạo proposal gom 2 lệnh mua (5 ETH + 4 ETH = 9 ETH > 8 ETH trần). Hàm `propose()` phải từ chối. | Revert: `"Governor: Total maxPrice exceeds proposal spending limit"` | **PASSED** |
| 3 | [`GovernanceSecurity.spec.ts`](file:///d:/Visual%20studio%20code/Blockchain/test/GovernanceSecurity.spec.ts#L189) | `Full DAO Lifecycle & SEC-10 Replay Protection` | Chạy trọn vẹn luồng Propose ➔ Vote ➔ Queue (48h) ➔ Execute. Sau đó gọi `execute` lần 2. | Lần 1 thành công (NFT vào kho). Lần 2 Revert: `GovernorUnexpectedProposalState`. | **PASSED** |
| 4 | [`GovernanceSecurity.spec.ts`](file:///d:/Visual%20studio%20code/Blockchain/test/GovernanceSecurity.spec.ts#L320) | `Security Council Veto / Cancellation in Timelock` | Security Council được Governor cho phép hủy proposal; mã hiện tại không giới hạn quyền này chỉ trong cửa sổ 48 giờ. | Hủy thành công, trạng thái thành `Canceled`, lệnh sau đó không thể execute. | **PASSED** |
| 5 | [`GovernanceSecurity.spec.ts`](file:///d:/Visual%20studio%20code/Blockchain/test/GovernanceSecurity.spec.ts#L368) | `GovToken & Governor Constructor & Parameter Validations` | Kiểm tra các hàm `clock()`, `CLOCK_MODE()`, `nonces()`, và các require chặn tham số 0 trong constructor. | Các tham số không hợp lệ đều bị revert chính xác. | **PASSED** |
| 6 | [`NFTTreasury.spec.ts`](file:///d:/Visual%20studio%20code/Blockchain/test/NFTTreasury.spec.ts#L70) | `Happy Path: Buy NFT with refund and daily spend update` | Mua NFT giá niêm yết 2.0 ETH với `maxPrice = 3.0 ETH`. | Nhận đúng NFT, Treasury chỉ giảm đúng 2.0 ETH (nhận 1.0 ETH refund), `dailySpent` tăng 2.0 ETH. | **PASSED** |
| 7 | [`NFTTreasury.spec.ts`](file:///d:/Visual%20studio%20code/Blockchain/test/NFTTreasury.spec.ts#L112) | `Happy Path: Sell NFT and credit revenue` | Bán NFT sở hữu cho sàn với giá tối thiểu 2.5 ETH. | NFT rời Treasury, số dư Treasury tăng chính xác 2.5 ETH. | **PASSED** |
| 8 | [`NFTTreasury.spec.ts`](file:///d:/Visual%20studio%20code/Blockchain/test/NFTTreasury.spec.ts#L149) | `SEC-01: Revert if adapter steals excess ETH refund` | `MaliciousAdapter` cố tình giữ 1.5 ETH tiền thừa không trả về. | Revert: `"Treasury: Revenue/Refund mismatch"`. Treasury không mất tiền. | **PASSED** |
| 9 | [`NFTTreasury.spec.ts`](file:///d:/Visual%20studio%20code/Blockchain/test/NFTTreasury.spec.ts#L182) | `SEC-02: Revert if adapter sends wrong NFT tokenId` | `MaliciousAdapter` giao token lạ (`tokenId + 999999`) về Treasury. | Revert: `"Treasury: NFT not received"`. Giao dịch rollback. | **PASSED** |
| 10 | [`NFTTreasury.spec.ts`](file:///d:/Visual%20studio%20code/Blockchain/test/NFTTreasury.spec.ts#L210) | `SEC-03: Revert if adapter attempts reentrancy attack` | `MaliciousAdapter` gọi đệ quy ngược lại `executeBuyNFT` trong lúc mua. | Bị chặn bởi OpenZeppelin: Reverted với `ReentrancyGuardReentrantCall`. | **PASSED** |
| 11 | [`NFTTreasury.spec.ts`](file:///d:/Visual%20studio%20code/Blockchain/test/NFTTreasury.spec.ts#L239) | `SEC-04: Revert when total spending in 24h exceeds DAILY_SPENDING_LIMIT` | Mua 2 lần 4.5 ETH = 9.0 ETH (thành công). Mua lần 3 thêm 2.0 ETH = 11.0 ETH (> 10 ETH hạn mức ngày). | Lần 3 bị Revert: `"Treasury: Daily spending limit exceeded"`. Sau 24h hạn mức tự phục hồi. | **PASSED** |
| 12 | [`NFTTreasury.spec.ts`](file:///d:/Visual%20studio%20code/Blockchain/test/NFTTreasury.spec.ts#L309) | `SEC-05: Time-bounded emergency pause by Security Council` | Council pause 3 ngày. Trong 3 ngày không thể mua. Sau 3 ngày + 1s tự động mua lại được. | Revert `"Treasury: Trading paused"`, tự mở khóa sau thời hạn mà không cần unpause tx. | **PASSED** |
| 13 | [`NFTTreasury.spec.ts`](file:///d:/Visual%20studio%20code/Blockchain/test/NFTTreasury.spec.ts#L361) | `SEC-06: Revert when transaction deadline is exceeded` | Thực thi với timestamp `deadline` nằm trong quá khứ. | Revert: `"Treasury: Transaction expired"`. | **PASSED** |
| 14 | [`NFTTreasury.spec.ts`](file:///d:/Visual%20studio%20code/Blockchain/test/NFTTreasury.spec.ts#L383) | `SEC-08: Roll back entire transaction if adapter refund reverts` | Adapter giả lập bị crash/revert khi gọi lệnh refund ETH. | Toàn bộ giao dịch hoàn tác an toàn: `"MaliciousAdapter: Simulated refund crash"`. | **PASSED** |
| 15 | [`NFTTreasury.spec.ts`](file:///d:/Visual%20studio%20code/Blockchain/test/NFTTreasury.spec.ts#L410) | `SEC-11: Revert if adapter reports fraudulent actualPrice` | Adapter trả 2 ETH nhưng khai man `actualPrice = 1 ETH`. | Đối chiếu chênh lệch số dư phát hiện sai khác: Revert: `"Treasury: Revenue/Refund mismatch"`. | **PASSED** |
| 16 | [`NFTTreasury.spec.ts`](file:///d:/Visual%20studio%20code/Blockchain/test/NFTTreasury.spec.ts#L439) | `Access Control: non-timelock cannot execute trades or modify whitelists` | Attacker (EOA ngẫu nhiên) cố tình gọi `setWhitelistAdapter`, `setWhitelistCollection`, `executeBuyNFT`. | Bị chặn bởi OpenZeppelin: Reverted với `AccessControlUnauthorizedAccount`. | **PASSED** |
| 17 | [`NFTTreasury.spec.ts`](file:///d:/Visual%20studio%20code/Blockchain/test/NFTTreasury.spec.ts#L465) | `Constructor & Parameter Validations` | Kiểm tra khởi tạo Treasury với địa chỉ 0 hoặc `dailyLimit < maxPerCall`. | Revert chính xác với các lỗi require tương ứng. | **PASSED** |
| 18 | [`NFTTreasury.spec.ts`](file:///d:/Visual%20studio%20code/Blockchain/test/NFTTreasury.spec.ts#L494) | `Limit setters and zero address whitelist validations` | Timelock cập nhật hạn mức và kiểm tra chặn địa chỉ 0 khi set whitelist. | Revert: `"Treasury: Zero address"`, cập nhật limits thành công khi tham số hợp lệ. | **PASSED** |
| 19 | [`NFTTreasury.spec.ts`](file:///d:/Visual%20studio%20code/Blockchain/test/NFTTreasury.spec.ts#L521) | `Buy and Sell pre-condition checks` | Kiểm tra mua collection chưa whitelist, adapter chưa whitelist, bán NFT không thuộc sở hữu. | Toàn bộ các require tiền điều kiện đều revert chính xác. | **PASSED** |

---

## E. DANH SÁCH VẤN ĐỀ BẢO MẬT PHÁT HIỆN ĐƯỢC

Trong quá trình rà soát chi tiết mã nguồn theo tiêu chuẩn bảo mật Smart Contract, nhóm kỹ sư ghi nhận các phát hiện sau:

### Phát hiện 1: Tính Cố Định Của Chu Kỳ Hạn Mức Ngày (Fixed Window vs Sliding Window)
- **Mức độ nghiêm trọng**: `THẤP` (Low / Informational)
- **Vị trí mã nguồn**: [`NFTTreasury.sol:204`](file:///d:/Visual%20studio%20code/Blockchain/contracts/core/NFTTreasury.sol#L204):
  ```solidity
  uint256 currentDay = block.timestamp / 1 days;
  dailySpent[currentDay] += amount;
  ```
- **Điều kiện khai thác**:
  - Hạn mức được reset tại mốc $00:00$ UTC hàng ngày (`timestamp % 86400 == 0`).
  - Kẻ tấn công hoặc DAO bị chiếm quyền có thể thực hiện 1 lệnh mua sát $23:59$ UTC (chi 10 ETH) và tiếp tục mua thêm 1 lệnh lúc $00:01$ UTC hôm sau (chi tiếp 10 ETH).
- **Đánh giá rủi ro**: Thiệt hại tối đa trong cửa sổ 2 phút bị giới hạn ở mức $2 \times \text{DAILY\_SPENDING\_LIMIT} = 20$ ETH, không thể vét cạn toàn bộ quỹ. Đây là đánh đổi thiết kế tiêu chuẩn để tiết kiệm Gas so với cấu trúc mảng trượt (Sliding Window Queue).

### Phát hiện 2: Kỹ Thuật Giải Mã Calldata Phụ Thuộc Vào Cấu Trúc Hàm Cố Định
- **Mức độ nghiêm trọng**: `TRUNG BÌNH` (Medium)
- **Vị trí mã nguồn**: [`NFTDaoGovernor.sol:84-100`](file:///d:/Visual%20studio%20code/Blockchain/contracts/governance/NFTDaoGovernor.sol#L84-L100):
  ```solidity
  (, , , uint256 maxPrice, ) = abi.decode(
      _slice(cd, 4, cd.length - 4),
      (address, address, uint256, uint256, uint256)
  );
  ```
- **Điều kiện khai thác**:
  - Governor quét `targets[i] == treasury` và so sánh 4 bytes đầu với `INFTTreasury.executeBuyNFT.selector`.
  - Nếu trong tương lai DAO bổ sung hàm mua mới hoặc sử dụng hợp đồng Multicall trung gian ủy quyền (`delegatecall`), bộ quét calldata của Governor hiện tại sẽ bỏ qua kiểm tra này.
- **Khuyến nghị**: Duy trì tính bất biến của chữ ký hàm `executeBuyNFT` trên Treasury và không thêm hàm chi tiền phụ nếu chưa nâng cấp Governor tương ứng.

### Phát hiện 3: Tác Động Của Lệnh `receive()` Đối Với Phí Chuyển ETH
- **Mức độ nghiêm trọng**: `THÔNG TIN` (Informational / Best Practice)
- **Vị trí mã nguồn**: [`NFTTreasury.sol:78`](file:///d:/Visual%20studio%20code/Blockchain/contracts/core/NFTTreasury.sol#L78):
  ```solidity
  receive() external payable {}
  ```
- **Đánh giá**: Hàm `receive()` hoàn toàn rỗng, tiêu thụ dưới 2,300 gas. Điều này đảm bảo các lệnh `call{value: excess}("")` hoặc `transfer()` từ Adapter không bao giờ gặp lỗi Out-of-gas, đảm bảo tính nguyên tử của giao dịch refund.

---

## F. BẢN GHI MÔI TRƯỜNG VÀ LỆNH KIỂM TRA

### 1. Ghi nhận về Foundry (không phải toolchain dự án)
Báo cáo khảo sát trước ghi nhận đã thử các lệnh Foundry; dự án hiện cấu hình Hardhat trong package.json và hardhat.config.ts:
```powershell
forge --version; forge build; forge test -vvv
```
**Nguyên văn kết quả thực thi:**
```
forge : The term 'forge' is not recognized as the name of a cmdlet, function, script file, or operable program. Check 
the spelling of the name, or if a path was included, verify that the path is correct and try again.
At line:1 char:1
+ forge --version; forge build; forge test -vvv
+ ~~~~~
    + CategoryInfo          : ObjectNotFound: (forge:String) [], CommandNotFoundException
    + FullyQualifiedErrorId : CommandNotFoundException
```
*Kết luận*: Hệ máy Windows hiện tại chưa cài đặt bộ công cụ Foundry CLI (`forge`/`cast`). Cấu hình dự án hiện dùng **Hardhat 2** cho biên dịch và kiểm thử.

### 2. Thông Tin Phiên Bản Môi Trường Thực Tế
- **Node.js**: `v24.19.0` (Đường dẫn: `C:\Program Files\nodejs\node.exe`)
- **NPM**: `11.17.0`
- **Hardhat**: `v2.29.1`
- **Hardhat-Toolbox**: `v6.1.2`
- **Solidity Compiler (`solc`)**: `0.8.24` (EVM Target: `cancun`, `optimizer: { enabled: true, runs: 200 }`)
- **OpenZeppelin Contracts**: `v5.6.1`
- **TypeScript**: `5.4.5`
- **Vite (Frontend)**: `v8.3.5`

### 3. Kết Quả Chạy Biên Dịch & Kiểm Thử Hardhat
Lệnh thực thi:
```powershell
npx hardhat compile; npx hardhat test
```
**Nguyên văn kết quả thực thi:**
```
Nothing to compile
No need to generate any newer typings.

  Governance & Timelock Security Test Suite
    Governance Unit & Security Scenarios
      √ SEC-07: Member holds token but does not delegate before Snapshot -> voting power is 0
      √ SEC-09: Proposal containing multiple buy calls whose sum exceeds MAX_PER_PROPOSAL_LIMIT is rejected by propose()
      √ Full DAO Lifecycle & SEC-10 Replay Protection: Propose -> Vote -> Queue -> Execute -> Re-execute reverts (71ms)
      √ Security Council Veto / Cancellation in Timelock
      √ GovToken & Governor Constructor & Parameter Validations (55ms)

  NFTTreasury & Adapter Security Test Suite
    Happy Path Operations
      √ should successfully buy an NFT, refund excess ETH, and update daily spending
      √ should successfully sell an NFT and credit net revenue to Treasury
    Security Test Cases (SEC-01 to SEC-11)
      √ SEC-01: should revert if adapter steals excess ETH refund
      √ SEC-02: should revert if adapter sends wrong NFT tokenId to Treasury
      √ SEC-03: should revert if adapter attempts reentrancy attack against Treasury
      √ SEC-04: should revert when total spending in 24h exceeds DAILY_SPENDING_LIMIT (38ms)
      √ SEC-05: should enforce time-bounded emergency pause by Security Council
      √ SEC-06: should revert when transaction deadline is exceeded
      √ SEC-08: should roll back entire transaction safely if adapter refund reverts
      √ SEC-11: should revert if adapter reports fraudulent actualPrice
      √ Access Control: non-timelock cannot execute trades or modify whitelists
      √ Constructor & Parameter Validations
      √ Limit setters and zero address whitelist validations
      √ Buy and Sell pre-condition checks

  19 passing (2s)
```

---

## G. NHỮNG CÂU HỎI CẦN NHÀ PHÁT TRIỂN XÁC NHẬN

Trước khi triển khai lên mạng Testnet hoặc Mainnet công khai, nhóm phát triển cần làm rõ và xác nhận các nội dung sau:

1. **Địa chỉ ví Đa chữ ký (Multi-Sig) của Security Council**:
   - Trong script triển khai hiện tại ([`scripts/deploy.ts:32`](file:///d:/Visual%20studio%20code/Blockchain/scripts/deploy.ts#L32)), `securityCouncilAddress` đang tạm thời gán bằng địa chỉ EOA của deployer (`deployer.address`) để kiểm thử cục bộ.
   - *Cần xác nhận*: Địa chỉ Security Council thực tế cần được xác định trước khi triển khai công khai; script mẫu hiện gán vai trò này cho deployer EOA.

2. **Cơ chế Cập nhật Ngưỡng Quorum và Thời Gian Bỏ Phiếu**:
   - Hiện tại `votingDelay` đặt là 1 ngày, `votingPeriod` là 3 ngày, và `quorum` là 4%.
   - *Cần xác nhận*: Các tham số này đã tối ưu cho mô hình cộng đồng ban đầu hay cần tăng votingPeriod lên 5-7 ngày để tránh nguy cơ bỏ phiếu áp đảo vào ban đêm?

3. **Cơ chế Nạp/Rút Thanh Khoản Sàn (Marketplace Liquidity)**:
   - Trong `executeSellNFT`, Treasury nhận thanh toán trực tiếp bằng ETH. Có cần hỗ trợ thêm việc nhận thanh toán qua WETH hoặc stablecoin (USDC/USDT) không?

---
*Báo cáo được lập tự động từ kết quả kiểm toán mã nguồn thực tế và đã được lưu trữ trong dự án.*

## Ghi chú đối chiếu mã nguồn hiện tại

- Script triển khai mẫu đặt proposalThreshold là 1.000 SCT (không phải 1% tổng cung), votingDelay 1 ngày, votingPeriod 3 ngày, quorum 4%, trần mỗi proposal 8 ETH, mỗi lệnh mua 5 ETH và hạn mức ngày 10 ETH.
- GovToken.mint(address,uint256) hiện không có kiểm tra role hoặc quyền truy cập; không mô tả nguồn cung là cố định hoặc mint chỉ do admin kiểm soát.
- NFTTreasury.executeBuyNFT kiểm tra whitelist Adapter và collection; executeSellNFT chỉ kiểm tra whitelist Adapter và quyền sở hữu NFT.
- Script triển khai dùng MockMarketplace, gán Security Council cho deployer EOA, và cấu hình Hardhat hiện chỉ có mạng local chainId 31337. Không xem đây là triển khai testnet/mainnet hoặc multisig thực tế.
- Số liệu 19 test và coverage trong tài liệu là kết quả đã ghi nhận trước đó; cần chạy lại bộ lệnh hiện hành nếu cần xác nhận trạng thái mới nhất.
