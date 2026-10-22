// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ERC721Holder} from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";

/**
 * @title MockMarketplace
 * @notice Simulates an external NFT marketplace where orders are listed and filled with ETH.
 */
contract MockMarketplace is ERC721Holder {
    struct Listing {
        address seller;
        uint256 price;
        bool active;
    }

    // (nftContract, tokenId) => Listing
    mapping(address => mapping(uint256 => Listing)) public listings;

    // (nftContract, tokenId) => bid price offered by marketplace to acquire NFT
    mapping(address => mapping(uint256 => uint256)) public instantBids;

    event NFTListed(address indexed nftContract, uint256 indexed tokenId, uint256 price, address indexed seller);
    event NFTPurchased(address indexed nftContract, uint256 indexed tokenId, uint256 price, address buyer);
    event NFTSoldToMarket(address indexed nftContract, uint256 indexed tokenId, uint256 price, address seller);

    receive() external payable {}

    function list(address nftContract, uint256 tokenId, uint256 price) external {
        require(price > 0, "Price must be > 0");
        IERC721(nftContract).transferFrom(msg.sender, address(this), tokenId);
        listings[nftContract][tokenId] = Listing({
            seller: msg.sender,
            price: price,
            active: true
        });
        emit NFTListed(nftContract, tokenId, price, msg.sender);
    }

    function setInstantBid(address nftContract, uint256 tokenId, uint256 bidPrice) external payable {
        instantBids[nftContract][tokenId] = bidPrice;
    }

    function buy(address nftContract, uint256 tokenId) external payable returns (uint256) {
        Listing memory item = listings[nftContract][tokenId];
        require(item.active, "Not listed");
        require(msg.value >= item.price, "Insufficient payment");

        listings[nftContract][tokenId].active = false;

        // Pay seller
        (bool successSeller, ) = payable(item.seller).call{value: item.price}("");
        require(successSeller, "Seller transfer failed");

        // Transfer NFT to buyer
        IERC721(nftContract).safeTransferFrom(address(this), msg.sender, tokenId);

        // Refund any excess payment to buyer
        uint256 excess = msg.value - item.price;
        if (excess > 0) {
            (bool successRefund, ) = payable(msg.sender).call{value: excess}("");
            require(successRefund, "Refund failed");
        }

        emit NFTPurchased(nftContract, tokenId, item.price, msg.sender);
        return item.price;
    }

    function sell(address nftContract, uint256 tokenId, uint256 minRevenue) external returns (uint256) {
        uint256 bid = instantBids[nftContract][tokenId];
        if (bid == 0) {
            bid = minRevenue; // Default to minRevenue if no explicit bid is set for testing
        }
        require(bid >= minRevenue, "Bid below minRevenue");
        require(address(this).balance >= bid, "Marketplace has insufficient liquidity");

        // Transfer NFT from seller to marketplace
        IERC721(nftContract).safeTransferFrom(msg.sender, address(this), tokenId);

        // Transfer payout in ETH to seller
        (bool success, ) = payable(msg.sender).call{value: bid}("");
        require(success, "Payout failed");

        emit NFTSoldToMarket(nftContract, tokenId, bid, msg.sender);
        return bid;
    }
}
