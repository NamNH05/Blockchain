// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ERC721Holder} from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import {INFTMarketplaceAdapter} from "../interfaces/INFTMarketplaceAdapter.sol";
import {INFTTreasury} from "../interfaces/INFTTreasury.sol";
import {MockMarketplace} from "./MockMarketplace.sol";
import {MockNFT} from "./MockNFT.sol";

/**
 * @title MaliciousMarketplaceAdapter
 * @notice Adversarial adapter designed to execute various exploit attempts against NFTTreasury.
 * @dev Used specifically for SEC-01, SEC-02, SEC-03, SEC-08, and SEC-11 security tests.
 */
contract MaliciousMarketplaceAdapter is INFTMarketplaceAdapter, ERC721Holder {
    enum AttackMode {
        NONE,
        STEAL_REFUND,         // SEC-01: Keeps excess refund ETH instead of returning to Treasury
        SEND_WRONG_TOKEN,     // SEC-02: Transfers wrong tokenId to Treasury
        REENTRANCY,           // SEC-03: Calls back into Treasury executeBuyNFT
        REVERT_ON_REFUND,     // SEC-08: Reverts during refund logic
        REPORT_WRONG_PRICE    // SEC-11: Reports fraudulent actualPrice
    }

    MockMarketplace public immutable marketplace;
    AttackMode public attackMode;
    uint256 public fakeReportedPrice;
    address public reentrancyTreasury;

    constructor(address _marketplace) {
        marketplace = MockMarketplace(payable(_marketplace));
        attackMode = AttackMode.NONE;
    }

    receive() external payable {}

    function setAttackMode(AttackMode _mode) external {
        attackMode = _mode;
    }

    function setFakeReportedPrice(uint256 _price) external {
        fakeReportedPrice = _price;
    }

    function setReentrancyTreasury(address _treasury) external {
        reentrancyTreasury = _treasury;
    }

    function buyNFT(
        address nftContract,
        uint256 tokenId,
        uint256 maxPrice
    ) external payable override returns (uint256 actualPrice) {
        if (attackMode == AttackMode.REENTRANCY && reentrancyTreasury != address(0)) {
            // Attempt to re-enter Treasury's executeBuyNFT
            INFTTreasury(reentrancyTreasury).executeBuyNFT(
                address(this),
                nftContract,
                tokenId,
                maxPrice,
                block.timestamp + 1000
            );
        }

        // Buy from marketplace
        actualPrice = marketplace.buy{value: msg.value}(nftContract, tokenId);

        if (attackMode == AttackMode.SEND_WRONG_TOKEN) {
            // Transfer an entirely different token to Treasury
            uint256 wrongTokenId = tokenId + 999999;
            MockNFT(nftContract).mint(address(this), wrongTokenId);
            IERC721(nftContract).safeTransferFrom(address(this), msg.sender, wrongTokenId);
        } else {
            // Send the correct token
            IERC721(nftContract).safeTransferFrom(address(this), msg.sender, tokenId);
        }

        if (attackMode == AttackMode.STEAL_REFUND) {
            // Retain excess funds in the adapter, do NOT refund Treasury
            return actualPrice;
        }

        if (attackMode == AttackMode.REVERT_ON_REFUND) {
            revert("MaliciousAdapter: Simulated refund crash");
        }

        // Safe refund if not stealing
        uint256 excess = address(this).balance;
        if (excess > 0) {
            (bool successRefund, ) = payable(msg.sender).call{value: excess}("");
            require(successRefund, "Refund failed");
        }

        if (attackMode == AttackMode.REPORT_WRONG_PRICE) {
            // Report manipulated price
            return fakeReportedPrice;
        }

        return actualPrice;
    }

    function sellNFT(
        address nftContract,
        uint256 tokenId,
        uint256 minRevenue
    ) external override returns (uint256 netRevenue) {
        IERC721(nftContract).safeTransferFrom(msg.sender, address(this), tokenId);
        IERC721(nftContract).approve(address(marketplace), tokenId);
        netRevenue = marketplace.sell(nftContract, tokenId, minRevenue);

        if (attackMode == AttackMode.STEAL_REFUND) {
            // Keep the sales revenue!
            return netRevenue;
        }

        if (attackMode == AttackMode.REPORT_WRONG_PRICE) {
            // Forward real revenue but report manipulated netRevenue
            (bool s, ) = payable(msg.sender).call{value: netRevenue}("");
            require(s, "Payout failed");
            return fakeReportedPrice;
        }

        (bool successForward, ) = payable(msg.sender).call{value: netRevenue}("");
        require(successForward, "Forwarding revenue failed");

        return netRevenue;
    }
}
