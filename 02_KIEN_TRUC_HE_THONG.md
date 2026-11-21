# KIẾN TRÚC HỆ THỐNG: SECURE COLLECTOR DAO

Tài liệu này mô tả kiến trúc theo mã nguồn hiện có. Các giá trị tham số được nêu là cấu hình trong scripts/deploy.ts, không phải giá trị bất biến của hợp đồng.

## 1. Sơ đồ tổng quát

Thành viên / giao diện Web3 → GovToken và NFTDaoGovernor → TimelockController (48 giờ) → NFTTreasury → SafeMarketplaceAdapter → MockMarketplace (trong script triển khai). Security Council có thể hủy proposal qua Governor và tạm dừng giao dịch tại Treasury. Adapter chuyển NFT và ETH hoàn lại về Treasury.

## 2. Các hợp đồng chính

### 2.1 GovToken

GovToken kế thừa ERC20, ERC20Votes và ERC20Permit. Cơ chế clock biểu quyết dùng block.timestamp theo dạng mode=timestamp.

Constructor có thể phát hành nguồn cung ban đầu, đồng thời mã hiện có hàm mint(address,uint256) công khai không giới hạn role. Vì vậy, nguồn cung không được đảm bảo cố định trong phiên bản hiện tại; đây là điểm cần cân nhắc trước khi dùng với tài sản thật.

### 2.2 NFTDaoGovernor

Governor điều phối đề xuất và biểu quyết. Hàm propose quét calldata nhắm trực tiếp tới Treasury, cộng maxPrice của các lệnh executeBuyNFT và từ chối proposal nếu tổng vượt maxPerProposalLimit.

Giá trị trong script triển khai mẫu: maxPerProposalLimit = 8 ETH, voting delay = 1 ngày, voting period = 3 ngày, proposal threshold = 1.000 SCT và quorum = 4%.

### 2.3 TimelockController

Script mẫu đặt minDelay là 48 giờ; cấp proposer cho Governor, executor cho address(0), canceller cho Governor và Security Council. Quyền admin được chuyển cho chính Timelock và deployer từ bỏ quyền admin sau khi cấu hình.

### 2.4 NFTTreasury

Treasury lưu giữ ETH và NFT ERC-721, nhận ETH qua hàm receive rỗng, đồng thời kiểm soát quyền giao dịch bằng TIMELOCK_ROLE. Council có thể gọi pauseTrading tối đa 7 ngày.

Luồng mua kiểm tra whitelist Adapter và collection, deadline, hạn mức mỗi giao dịch và hạn mức ngày. Luồng bán kiểm tra whitelist Adapter, quyền sở hữu NFT và doanh thu tối thiểu; mã hiện tại không kiểm tra whitelist collection trong hàm bán.

Giới hạn theo script mẫu: 5 ETH mỗi lệnh mua và 10 ETH chi tiêu mỗi ngày. Hạn mức ngày được tính theo ngày UTC dạng block.timestamp / 1 days.

### 2.5 Adapter và Marketplace

INFTMarketplaceAdapter chuẩn hóa hàm mua/bán. SafeMarketplaceAdapter là adapter có trong mã nguồn. Script triển khai mẫu kết nối adapter với MockMarketplace; không nên mô tả đây là tích hợp một sàn công khai.

## 3. Luồng mua NFT

1. Thành viên tạo proposal gọi Treasury; Governor kiểm tra tổng maxPrice của các lệnh mua trong proposal.
2. Thành viên biểu quyết bằng quyền biểu quyết của GovToken tại snapshot.
3. Nếu proposal được thông qua, Governor queue thao tác vào Timelock.
4. Khi đủ 48 giờ và thao tác sẵn sàng, executor có thể kích hoạt thực thi; Council có quyền hủy proposal qua cơ chế Governor.
5. Timelock gọi executeBuyNFT trên Treasury. Treasury kiểm tra role, pause, deadline, whitelist, số dư và giới hạn.
6. Treasury gửi tối đa maxPrice cho Adapter. Adapter tương tác với marketplace được cấu hình, chuyển NFT về Treasury và hoàn lại ETH dư.
7. Treasury xác nhận mình sở hữu đúng NFT và số ETH thực chi khớp actualPrice; sau đó ghi nhận chi tiêu ngày.

## 4. Phân quyền và cấu hình triển khai mẫu

| Vai trò | Quyền theo mã nguồn |
| --- | --- |
| Thành viên có quyền biểu quyết | Tạo proposal nếu đạt threshold và bỏ phiếu theo snapshot |
| Governor | Điều phối proposal và đưa thao tác được thông qua vào Timelock |
| Timelock | Gọi các hàm giao dịch và cấu hình của Treasury |
| Security Council | Tạm dừng giao dịch ở Treasury và hủy proposal qua Governor |
| Executor | Script cấp EXECUTOR_ROLE cho address(0), nên bất kỳ địa chỉ nào có thể kích hoạt thao tác sẵn sàng |

Trong script cục bộ, Security Council được gán là địa chỉ deployer EOA; không phải multisig. Cấu hình Hardhat hiện khai báo mạng Hardhat local với chainId 31337. Việc triển khai công khai chưa được chứng minh bởi cấu hình này.
