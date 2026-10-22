// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721Holder} from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {INFTTreasury} from "../interfaces/INFTTreasury.sol";
import {INFTMarketplaceAdapter} from "../interfaces/INFTMarketplaceAdapter.sol";

/**
 * @title NFTTreasury
 * @notice Agnostic vault responsible for safe custody of ETH and ERC-721 NFTs.
 * @dev Enforces daily spending limits, per-call limits, whitelist controls,
 *      strict balance post-verification, and bounded emergency pausing.
 */
contract NFTTreasury is ERC721Holder, ReentrancyGuard, AccessControl, INFTTreasury {
    bytes32 public constant TIMELOCK_ROLE = keccak256("TIMELOCK_ROLE");
    bytes32 public constant SECURITY_COUNCIL_ROLE = keccak256("SECURITY_COUNCIL_ROLE");

    uint256 public constant MAX_PAUSE_DURATION = 7 days;

    uint256 public pausedUntil;
    uint256 public maxPerCallLimit;
    uint256 public dailySpendingLimit;

    mapping(uint256 => uint256) public dailySpent;
    mapping(address => bool) public isAdapterWhitelisted;
    mapping(address => bool) public isCollectionWhitelisted;

    modifier whenNotPaused() {
        require(block.timestamp > pausedUntil, "Treasury: Trading paused");
        _;
    }

    /**
     * @notice Initializes the Treasury with governance roles and default spending limits.
     * @param admin Initial administrator (transferable to Timelock).
     * @param timelock Address of TimelockController allowed to execute trades and configure whitelists.
     * @param securityCouncil Address of Security Council multi-sig for emergency pausing.
     * @param _maxPerCallLimit Maximum ETH allowed per single buy execution.
     * @param _dailySpendingLimit Maximum cumulative ETH allowed to be spent per 24-hour day.
     */
    constructor(
        address admin,
        address timelock,
        address securityCouncil,
        uint256 _maxPerCallLimit,
        uint256 _dailySpendingLimit
    ) {
        require(admin != address(0), "Treasury: Invalid admin");
        require(timelock != address(0), "Treasury: Invalid timelock");
        require(securityCouncil != address(0), "Treasury: Invalid security council");
        require(_maxPerCallLimit > 0, "Treasury: Invalid maxPerCallLimit");
        require(_dailySpendingLimit >= _maxPerCallLimit, "Treasury: Daily limit must be >= call limit");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(TIMELOCK_ROLE, timelock);
        _grantRole(SECURITY_COUNCIL_ROLE, securityCouncil);

        maxPerCallLimit = _maxPerCallLimit;
        dailySpendingLimit = _dailySpendingLimit;

        emit SpendingLimitsUpdated(_maxPerCallLimit, _dailySpendingLimit);
    }

    /**
     * @notice Empty receive function to safely accept ETH refunds from adapters and deposits.
     * @dev MUST remain empty without state updates or external calls to prevent out-of-gas errors.
     */
    receive() external payable {}

    /**
     * @notice Pauses trading operations until a future timestamp.
     * @dev Can only be called by Security Council, bounded by MAX_PAUSE_DURATION (7 days).
     *      No unpause transaction is required once block.timestamp > pausedUntil.
     * @param duration Time in seconds to pause operations.
     */
    function pauseTrading(uint256 duration) external onlyRole(SECURITY_COUNCIL_ROLE) {
        require(duration > 0 && duration <= MAX_PAUSE_DURATION, "Treasury: Invalid pause duration");
        pausedUntil = block.timestamp + duration;
        emit TradingPausedUntil(pausedUntil);
    }

    /**
     * @notice Whitelists or removes an execution adapter.
     * @dev Restricted strictly to TIMELOCK_ROLE (Security Council cannot alter whitelists).
     */
    function setWhitelistAdapter(address adapter, bool status) external onlyRole(TIMELOCK_ROLE) {
        require(adapter != address(0), "Treasury: Zero address");
        isAdapterWhitelisted[adapter] = status;
        emit AdapterWhitelistUpdated(adapter, status);
    }

    /**
     * @notice Whitelists or removes an eligible NFT collection.
     * @dev Restricted strictly to TIMELOCK_ROLE.
     */
    function setWhitelistCollection(address collection, bool status) external onlyRole(TIMELOCK_ROLE) {
        require(collection != address(0), "Treasury: Zero address");
        isCollectionWhitelisted[collection] = status;
        emit CollectionWhitelistUpdated(collection, status);
    }

    /**
     * @notice Updates per-call and daily spending limits.
     * @dev Restricted strictly to TIMELOCK_ROLE.
     */
    function setSpendingLimits(uint256 newMaxPerCall, uint256 newDailyLimit) external onlyRole(TIMELOCK_ROLE) {
        require(newMaxPerCall > 0, "Treasury: Invalid maxPerCall");
        require(newDailyLimit >= newMaxPerCall, "Treasury: Daily limit must be >= call limit");
        maxPerCallLimit = newMaxPerCall;
        dailySpendingLimit = newDailyLimit;
        emit SpendingLimitsUpdated(newMaxPerCall, newDailyLimit);
    }

    /**
     * @notice Purchases an NFT through an authorized adapter with atomic balance verification.
     * @param adapter Address of the whitelisted adapter.
     * @param collection Address of the whitelisted ERC-721 collection.
     * @param tokenId ID of the token to purchase.
     * @param maxPrice Maximum ETH allocated for this transaction.
     * @param deadline Unix timestamp after which execution must revert.
     * @return actualPrice The exact amount of ETH spent.
     */
    function executeBuyNFT(
        address adapter,
        address collection,
        uint256 tokenId,
        uint256 maxPrice,
        uint256 deadline
    ) external nonReentrant onlyRole(TIMELOCK_ROLE) whenNotPaused returns (uint256 actualPrice) {
        require(block.timestamp <= deadline, "Treasury: Transaction expired");
        require(isAdapterWhitelisted[adapter], "Treasury: Adapter not whitelisted");
        require(isCollectionWhitelisted[collection], "Treasury: Collection not whitelisted");
        require(maxPrice <= maxPerCallLimit, "Treasury: Max call limit exceeded");
        require(address(this).balance >= maxPrice, "Treasury: Insufficient ETH balance");
        require(IERC721(collection).ownerOf(tokenId) != address(this), "Treasury: NFT already owned");

        uint256 balanceBefore = address(this).balance;

        actualPrice = INFTMarketplaceAdapter(adapter).buyNFT{value: maxPrice}(
            collection,
            tokenId,
            maxPrice
        );

        require(IERC721(collection).ownerOf(tokenId) == address(this), "Treasury: NFT not received");

        uint256 netSpent = balanceBefore - address(this).balance;
        require(actualPrice > 0, "Treasury: Zero spend invalid");
        require(actualPrice <= maxPrice, "Treasury: Price exceeded max limit");
        require(netSpent == actualPrice, "Treasury: Revenue/Refund mismatch");

        _recordDailySpending(actualPrice);

        emit NFTPurchased(collection, tokenId, actualPrice, adapter);
    }

    /**
     * @notice Sells an NFT through an authorized adapter with scoped approval and atomic balance verification.
     * @param adapter Address of the whitelisted adapter.
     * @param collection Address of the whitelisted ERC-721 collection.
     * @param tokenId ID of the token to sell.
     * @param minRevenue Minimum net ETH revenue required.
     * @param deadline Unix timestamp after which execution must revert.
     * @return netRevenue The exact amount of net ETH revenue received.
     */
    function executeSellNFT(
        address adapter,
        address collection,
        uint256 tokenId,
        uint256 minRevenue,
        uint256 deadline
    ) external nonReentrant onlyRole(TIMELOCK_ROLE) whenNotPaused returns (uint256 netRevenue) {
        require(block.timestamp <= deadline, "Treasury: Transaction expired");
        require(isAdapterWhitelisted[adapter], "Treasury: Adapter not whitelisted");
        require(IERC721(collection).ownerOf(tokenId) == address(this), "Treasury: NFT not owned");

        // Scoped approval: approve only this single token for the adapter
        IERC721(collection).approve(adapter, tokenId);

        uint256 balanceBefore = address(this).balance;

        netRevenue = INFTMarketplaceAdapter(adapter).sellNFT(collection, tokenId, minRevenue);

        require(IERC721(collection).ownerOf(tokenId) != address(this), "Treasury: NFT still in Treasury");

        uint256 actualReceived = address(this).balance - balanceBefore;
        require(actualReceived >= minRevenue, "Treasury: Revenue below minRevenue");
        require(actualReceived == netRevenue, "Treasury: Reported revenue mismatch");

        emit NFTSold(collection, tokenId, actualReceived, adapter);
    }

    /**
     * @notice Records daily spending in the current 24-hour cycle.
     * @dev Reverts if the cumulative daily spend exceeds dailySpendingLimit.
     */
    function _recordDailySpending(uint256 amount) internal {
        uint256 currentDay = block.timestamp / 1 days;
        dailySpent[currentDay] += amount;
        require(dailySpent[currentDay] <= dailySpendingLimit, "Treasury: Daily spending limit exceeded");
    }

    /**
     * @notice Returns cumulative ETH spent for a given timestamp's 24-hour day.
     */
    function getDailySpent(uint256 timestamp) external view returns (uint256) {
        return dailySpent[timestamp / 1 days];
    }
}
