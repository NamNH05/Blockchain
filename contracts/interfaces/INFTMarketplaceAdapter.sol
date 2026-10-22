// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title INFTMarketplaceAdapter
 * @notice Standard interface connecting Secure Collector DAO Treasury to NFT Marketplaces.
 */
interface INFTMarketplaceAdapter {
    /**
     * @notice Purchases an NFT from marketplace on behalf of the Treasury.
     * @dev Excess ETH (msg.value - actualPrice) MUST be refunded to msg.sender.
     * @param nftContract Address of the ERC-721 token contract.
     * @param tokenId Token ID to purchase.
     * @param maxPrice Maximum price the Treasury is willing to pay.
     * @return actualPrice The exact price paid for the NFT.
     */
    function buyNFT(
        address nftContract,
        uint256 tokenId,
        uint256 maxPrice
    ) external payable returns (uint256 actualPrice);

    /**
     * @notice Sells an NFT on marketplace on behalf of the Treasury.
     * @dev Net revenue in ETH MUST be sent to msg.sender.
     * @param nftContract Address of the ERC-721 token contract.
     * @param tokenId Token ID to sell.
     * @param minRevenue Minimum net ETH revenue expected by the Treasury.
     * @return netRevenue The exact ETH revenue sent back to the Treasury.
     */
    function sellNFT(
        address nftContract,
        uint256 tokenId,
        uint256 minRevenue
    ) external returns (uint256 netRevenue);
}
