# CHI TIẾT CÁC CƠ CHẾ XỬ LÝ NGHIỆP VỤ & BẢO MẬT (HANDLERS & SECURITY)

Tài liệu này đặc tả chi tiết cách xử lý từng luồng nghiệp vụ, các trường hợp ngoại lệ (Edge Cases), giải pháp phòng chống các vector tấn công và các bất biến bảo mật (Security Invariants) của hệ thống.

---

## 1. CÁC LUỒNG XỬ LÝ NGHIỆP VỤ CỐT LÕI (CORE HANDLERS)

### 1.1. Xử lý Mua NFT (`executeBuyNFT`)
Hàm này chịu trách nhiệm chi tiền từ Treasury để mua NFT thông qua Adapter được phê duyệt.

#### Thuật toán thực thi từng bước:
1. **Kiểm tra điều kiện tiên quyết (Pre-conditions)**:
   - `msg.sender` phải có vai trò `TIMELOCK_ROLE`.
   - `block.timestamp <= deadline`: Đảm bảo lệnh chưa hết hạn thực thi.
   - `block.timestamp > pausedUntil`: Đảm bảo hệ thống không trong trạng thái Pause khẩn cấp.
   - `isAdapterWhitelisted[adapter] == true`.
   - `isCollectionWhitelisted[collection] == true`.
   - `maxPrice <= MAX_PER_CALL_LIMIT`.
   - `address(this).balance >= maxPrice`.
   - `IERC721(collection).ownerOf(tokenId) != address(this)`: Không mua NFT đã sở hữu.
2. **Ghi nhận trạng thái tiền xử lý (Pre-state)**:
   - `uint256 balanceBefore = address(this).balance;`
3. **Kích hoạt Adapter**:
   - Gọi `INFTMarketplaceAdapter(adapter).buyNFT{value: maxPrice}(collection, tokenId, maxPrice)`.
   - Nhận về `uint256 actualPrice`.
4. **Hậu kiểm tra tính nguyên tử (Post-state Verification)**:
   - **Kiểm tra quyền sở hữu**: `require(IERC721(collection).ownerOf(tokenId) == address(this), "NFT not received");`
   - **Tính lượng tiền thực chi**: `uint256 netSpent = balanceBefore - address(this).balance;`
   - **Kiểm tra gian lận tiền thừa**:
     $$\text{require}(netSpent == actualPrice, \text{"Revenue/Refund mismatch"});$$
     $$\text{require}(actualPrice \le maxPrice, \text{"Price exceeded max limit"});$$
     $$\text{require}(actualPrice > 0, \text{"Zero spend invalid"});$$
5. **Ghi nhận hạn mức ngày**:
   - `_recordDailySpending(actualPrice);`
6. **Phát sự kiện**:
   - `emit NFTPurchased(collection, tokenId, actualPrice, adapter);`

---

### 1.2. Xử lý Bán NFT (`executeSellNFT`)
Hàm này niêm yết hoặc bán trực tiếp một NFT đang thuộc quyền sở hữu của Treasury để thu về ETH.

#### Thuật toán thực thi từng bước:
1. **Kiểm tra điều kiện tiên quyết**:
   - Chỉ Timelock được gọi, không bị Pause, chưa quá deadline.
   - Adapter nằm trong Whitelist.
   - `IERC721(collection).ownerOf(tokenId) == address(this)`: Treasury bắt buộc phải đang sở hữu NFT.
2. **Cấp quyền chuyển nhượng tối thiểu (Scoped Approval)**:
   - `IERC721(collection).approve(adapter, tokenId);`
   - Chỉ phê duyệt đúng 1 `tokenId` cho duy nhất Adapter thực hiện.
3. **Ghi nhận số dư trước giao dịch**:
   - `uint256 balanceBefore = address(this).balance;`
4. **Kích hoạt Adapter bán NFT**:
   - `uint256 netRevenue = INFTMarketplaceAdapter(adapter).sellNFT(collection, tokenId, minRevenue);`
5. **Hậu kiểm tra dòng tiền và quyền sở hữu**:
   - **Xác nhận NFT đã rời Treasury**: `require(IERC721(collection).ownerOf(tokenId) != address(this), "NFT still in Treasury");`
   - **Tính doanh thu ETH thực tế tăng thêm**:
     $$\text{uint256 actualReceived} = \text{address(this).balance} - balanceBefore;$$
     $$\text{require}(actualReceived \ge minRevenue, \text{"Revenue below minRevenue"});$$
     $$\text{require}(actualReceived == netRevenue, \text{"Reported revenue mismatch"});$$
6. **Phát sự kiện**:
   - `emit NFTSold(collection, tokenId, actualReceived, adapter);`

---

### 1.3. Xử lý Quét Hạn mức Đề xuất trên Governor (`propose` Override)
Để ngăn chặn tấn công chia nhỏ lệnh mua trong cùng 1 đề xuất:

```solidity
function propose(
    address[] memory targets,
    uint256[] memory values,
    bytes[] memory calldatas,
    string memory description
) public override returns (uint256) {
    uint256 totalProposalMaxPrice = 0;
    bytes4 buySelector = INFTTreasury.executeBuyNFT.selector;

    for (uint256 i = 0; i < targets.length; i++) {
        if (targets[i] == address(treasury)) {
            if (bytes4(calldatas[i]) == buySelector) {
                // Giải mã tham số maxPrice (nằm ở vị trí thứ 4 trong signature)
                (, , , uint256 maxPrice, ) = abi.decode(
                    calldatas[i][4:],
                    (address, address, uint256, uint256, uint256)
                );
                totalProposalMaxPrice += maxPrice;
            }
        }
    }

    require(
        totalProposalMaxPrice <= MAX_PER_PROPOSAL_LIMIT,
        "Governor: Total maxPrice exceeds proposal spending limit"
    );

    return super.propose(targets, values, calldatas, description);
}
```

---

### 1.4. Xử lý Tạm dừng có Thời hạn trên EVM (`pausedUntil`)
Do EVM không có cơ chế cron job tự động đổi cờ boolean sau thời gian trôi qua:

- **Khai báo biến**: `uint256 public pausedUntil;` (Lưu mốc timestamp).
- **Hạn mức tối đa**: `MAX_PAUSE_DURATION = 7 days;`
- **Kích hoạt Pause**:
  ```solidity
  function pauseTrading(uint256 duration) external onlyRole(SECURITY_COUNCIL_ROLE) {
      require(duration > 0 && duration <= MAX_PAUSE_DURATION, "Invalid duration");
      pausedUntil = block.timestamp + duration;
      emit TradingPausedUntil(pausedUntil);
  }
  ```
- **Kiểm tra trạng thái**:
  ```solidity
  modifier whenNotPaused() {
      require(block.timestamp > pausedUntil, "Treasury: Trading paused");
      _;
  }
  ```
- **Hành vi tự động**: Khi `block.timestamp > pausedUntil`, modifier tự động cho phép giao dịch tiếp tục mà **không cần bất kỳ ai phải gửi transaction unpause**.

---

### 1.5. Xử lý Hàm nhận tiền rỗng (`receive()`)
- Khai báo bắt buộc:
  ```solidity
  // Rỗng hoàn toàn để nhận refund an toàn từ Adapter
  receive() external payable {}
  ```
- **Bất biến kỹ thuật**: Tuyệt đối không chứa logic, không thay đổi state, không gọi contract khác để đảm bảo lệnh `call{value: excess}("")` từ Adapter không bao giờ bị lỗi Out-of-gas hoặc Reentrancy.

---

## 2. PHÂN TÍCH VÀ XỬ LÝ CÁC VECTOR TẤN CÔNG (THREAT MODEL & MITIGATION)

| Kịch bản tấn công | Cơ chế kẻ tấn công sử dụng | Cách hệ thống xử lý triệt để |
| :--- | :--- | :--- |
| **1. Ăn chặn tiền thừa (Excess Theft)** | Adapter mua NFT giá 1 ETH nhưng giữ 1 ETH từ trần 2 ETH gửi sang | Treasury kiểm tra `balanceBefore - balanceAfter == actualPrice`. Nếu Adapter không gửi trả 1 ETH thừa, số dư bị giảm 2 ETH $\ne$ 1 ETH $\rightarrow$ Revert toàn bộ |
| **2. Gian lận báo cáo giá (Fake Price Reporting)** | Adapter mua giá 2 ETH nhưng báo `actualPrice = 1 ETH` | Lượng ETH thực mất là 2 ETH $\ne 1$ ETH đã báo $\rightarrow$ Revert do `netSpent != actualPrice` |
| **3. Lách trần chi tiêu bằng Multi-call** | Tạo proposal chứa 5 lệnh mua 4 ETH (tổng 20 ETH) để vượt trần 10 ETH | `NFTDaoGovernor.propose()` giải mã toàn bộ calldatas và cộng dồn $\sum maxPrice$. Nếu $> 10$ ETH $\rightarrow$ Revert ngay lúc tạo đề xuất |
| **4. Tấn công ranh giới ngày (Boundary Attack)** | Mua 10 ETH lúc 23:59 và mua tiếp 10 ETH lúc 00:01 hôm sau | Hạn ngạch chia theo chu kỳ 24h (`block.timestamp / 1 days`). Thiệt hại tối đa bị chặn ở $2 \times DAILY\_LIMIT$, không thể vét cạn toàn bộ quỹ |
| **5. Flash Loan Voting Power** | Vay lượng lớn token trong cùng block để bỏ phiếu thao túng | `ERC20Votes` chốt Snapshot tại `proposalSnapshot = proposalCreatedAt + votingDelay`. Lượng token vay sau đó không có điểm voting tại Snapshot |
| **6. Quên ủy quyền (No Delegation)** | Mua token nhưng không gọi `delegate()` trước Snapshot | `getPastVotes(account, snapshot)` trả về 0. Giao dịch biểu quyết bị Governor từ chối |
| **7. Reentrancy từ Marketplace / Adapter** | Hợp đồng bên ngoài gọi ngược lại Treasury khi đang thực hiện giao dịch | Toàn bộ hàm thay đổi tài sản đều được bảo vệ bởi `nonReentrant` của OpenZeppelin |
| **8. Thực thi sau khi hết hạn (Expired Execution)** | Đề xuất nằm trong Timelock bị lãng quên, thị trường biến động, kẻ xấu kích hoạt sau vài tháng | Hàm `executeBuyNFT` kiểm tra `require(block.timestamp <= deadline)`. Nếu quá hạn $\rightarrow$ Revert |
| **9. Chiếm đoạt quyền Admin** | Deployer bị lộ Private Key | Ngay sau khi khởi tạo xong, Deployer gọi `renounceRole` và `revokeRole`, chuyển quyền quản trị duy nhất về chính `TimelockController` |

---

## 3. TÍNH NGUYÊN TỬ VÀ KHẢ NĂNG PHỤC HỒI (ATOMICITY & ROLLBACK INVARIANTS)

1. **Khôi phục Hạn ngạch ngày (`dailySpent`)**: Do `_recordDailySpending` nằm ở cuối hàm `executeBuyNFT`, nếu giao dịch thất bại ở bất kỳ bước nào (mua thất bại, hoàn tiền lỗi, sai NFT), trạng thái `dailySpent` tự động được EVM hoàn tác (Rollback) về số dư cũ.
2. **Khôi phục Phê duyệt NFT (`Approval Rollback`)**: Khi bán NFT, nếu giao dịch revert, quyền `approve` cấp cho Adapter cũng bị hủy bỏ ngay lập tức theo tính nguyên tử của EVM.
