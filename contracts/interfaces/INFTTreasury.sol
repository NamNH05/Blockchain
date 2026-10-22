// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title INFTTreasury
 * @notice Interface defining core Treasury functions for the Secure Collector DAO.
 */
interface INFTTreasury {
    event NFTPurchased(
        address indexed collection,
        uint256 indexed tokenId,
        uint256 actualPrice,
        address indexed adapter
    );

    event NFTSold(
        address indexed collection,
        uint256 indexed tokenId,
        uint256 netRevenue,
        address indexed adapter
    );

    event TradingPausedUntil(uint256 pausedUntil);
    event AdapterWhitelistUpdated(address indexed adapter, bool status);
    event CollectionWhitelistUpdated(address indexed collection, bool status);
    event SpendingLimitsUpdated(uint256 maxPerCallLimit, uint256 dailySpendingLimit);

    function executeBuyNFT(
        address adapter,
        address collection,
        uint256 tokenId,
        uint256 maxPrice,
        uint256 deadline
    ) external returns (uint256 actualPrice);

    function executeSellNFT(
        address adapter,
        address collection,
        uint256 tokenId,
        uint256 minRevenue,
        uint256 deadline
    ) external returns (uint256 netRevenue);

    function pauseTrading(uint256 duration) external;

    function isAdapterWhitelisted(address adapter) external view returns (bool);
    function isCollectionWhitelisted(address collection) external view returns (bool);
    function pausedUntil() external view returns (uint256);
    function maxPerCallLimit() external view returns (uint256);
    function dailySpendingLimit() external view returns (uint256);
    function getDailySpent(uint256 dayTimestamp) external view returns (uint256);
}
