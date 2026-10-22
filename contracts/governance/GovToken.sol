// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";

/**
 * @title GovToken
 * @notice Pure governance token utilizing ERC-20, ERC-20 Permit, and ERC-20 Votes.
 * @dev Conforms to ERC-6372 (Timestamp-based clock mode) for cross-L2 compatibility.
 */
contract GovToken is ERC20, ERC20Permit, ERC20Votes {
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        address initialHolder
    ) ERC20(name, symbol) ERC20Permit(name) {
        if (initialSupply > 0 && initialHolder != address(0)) {
            _mint(initialHolder, initialSupply);
        }
    }

    /**
     * @notice Mint helper for testing distribution.
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /**
     * @notice Clock used for voting checkpoints (ERC-6372).
     */
    function clock() public view override returns (uint48) {
        return uint48(block.timestamp);
    }

    /**
     * @notice Machine-readable description of the clock mode (ERC-6372).
     */
    // solhint-disable-next-line func-name-mixedcase
    function CLOCK_MODE() public pure override returns (string memory) {
        return "mode=timestamp";
    }

    // The following functions are overrides required by Solidity:

    function _update(
        address from,
        address to,
        uint256 value
    ) internal override(ERC20, ERC20Votes) {
        super._update(from, to, value);
    }

    function nonces(
        address owner
    ) public view override(ERC20Permit, Nonces) returns (uint256) {
        return super.nonces(owner);
    }
}
