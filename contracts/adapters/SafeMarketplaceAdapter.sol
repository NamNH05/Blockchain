// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ERC721Holder} from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import {INFTMarketplaceAdapter} from "../interfaces/INFTMarketplaceAdapter.sol";
import {MockMarketplace} from "../mocks/MockMarketplace.sol";

/**
 * @title SafeMarketplaceAdapter
 * @notice Trusted adapter contract that interfaces with MockMarketplace.
 * @dev Properly transfers NFTs, returns exact actual prices, and refunds all excess ETH to the Treasury.
 */
contract SafeMarketplaceAdapter is INFTMarketplaceAdapter, ERC721Holder {
    MockMarketplace public immutable marketplace;

    constructor(address _marketplace) {
        require(_marketplace != address(0), "Invalid marketplace");
        marketplace = MockMarketplace(payable(_marketplace));
    }

    receive() external payable {}

    function buyNFT(
        address nftContract,
        uint256 tokenId,
        uint256 maxPrice
    ) external payable override returns (uint256 actualPrice) {
        require(msg.value == maxPrice, "Incorrect ETH sent");

        // Forward purchase to marketplace
        actualPrice = marketplace.buy{value: msg.value}(nftContract, tokenId);

        // Ensure NFT was received by adapter, then forward to caller (Treasury)
        IERC721(nftContract).safeTransferFrom(address(this), msg.sender, tokenId);

        // Refund any remaining excess ETH in the adapter back to caller (Treasury)
        uint256 excess = address(this).balance;
        if (excess > 0) {
            (bool successRefund, ) = payable(msg.sender).call{value: excess}("");
            require(successRefund, "Adapter: Excess refund failed");
        }

        return actualPrice;
    }

    function sellNFT(
        address nftContract,
        uint256 tokenId,
        uint256 minRevenue
    ) external override returns (uint256 netRevenue) {
        // Pull approved NFT from caller (Treasury)
        IERC721(nftContract).safeTransferFrom(msg.sender, address(this), tokenId);

        // Approve marketplace to transfer NFT
        IERC721(nftContract).approve(address(marketplace), tokenId);

        // Execute sale on marketplace
        netRevenue = marketplace.sell(nftContract, tokenId, minRevenue);

        // Forward all proceeds to caller (Treasury)
        (bool successForward, ) = payable(msg.sender).call{value: netRevenue}("");
        require(successForward, "Adapter: Forwarding revenue failed");

        return netRevenue;
    }
}
