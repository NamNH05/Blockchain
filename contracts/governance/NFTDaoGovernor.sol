// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Governor} from "@openzeppelin/contracts/governance/Governor.sol";
import {GovernorSettings} from "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import {GovernorCountingSimple} from "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import {GovernorVotes} from "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import {GovernorVotesQuorumFraction} from "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";
import {GovernorTimelockControl} from "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";
import {INFTTreasury} from "../interfaces/INFTTreasury.sol";

/**
 * @title NFTDaoGovernor
 * @notice Governance engine enforcing multi-call cumulative spending checks.
 * @dev Inspects calldatas targeted at NFTTreasury to ensure the sum of maxPrices
 *      within a single proposal does not exceed MAX_PER_PROPOSAL_LIMIT.
 */
contract NFTDaoGovernor is
    Governor,
    GovernorSettings,
    GovernorCountingSimple,
    GovernorVotes,
    GovernorVotesQuorumFraction,
    GovernorTimelockControl
{
    address public immutable treasury;
    uint256 public maxPerProposalLimit;

    address public immutable securityCouncil;

    event MaxPerProposalLimitUpdated(uint256 oldLimit, uint256 newLimit);

    constructor(
        IVotes _token,
        TimelockController _timelock,
        address _treasury,
        address _securityCouncil,
        uint256 _maxPerProposalLimit,
        uint48 _initialVotingDelay,
        uint32 _initialVotingPeriod,
        uint256 _initialProposalThreshold,
        uint256 _quorumPercentage
    )
        Governor("NFTDaoGovernor")
        GovernorSettings(_initialVotingDelay, _initialVotingPeriod, _initialProposalThreshold)
        GovernorVotes(_token)
        GovernorVotesQuorumFraction(_quorumPercentage)
        GovernorTimelockControl(_timelock)
    {
        require(_treasury != address(0), "Governor: Invalid treasury address");
        require(_securityCouncil != address(0), "Governor: Invalid security council");
        require(_maxPerProposalLimit > 0, "Governor: Invalid maxPerProposalLimit");

        treasury = _treasury;
        securityCouncil = _securityCouncil;
        maxPerProposalLimit = _maxPerProposalLimit;
    }

    /**
     * @notice Allows Security Council to veto/cancel proposals across all active states.
     */
    function _validateCancel(
        uint256 proposalId,
        address caller
    ) internal view override returns (bool) {
        if (caller == securityCouncil) {
            return true;
        }
        return super._validateCancel(proposalId, caller);
    }

    /**
     * @notice Allows DAO governance to update the per-proposal spending limit.
     */
    function setMaxPerProposalLimit(uint256 newLimit) external onlyGovernance {
        require(newLimit > 0, "Governor: Invalid limit");
        uint256 oldLimit = maxPerProposalLimit;
        maxPerProposalLimit = newLimit;
        emit MaxPerProposalLimitUpdated(oldLimit, newLimit);
    }

    /**
     * @notice Overrides propose to scan calldatas aimed at Treasury.
     * @dev Prevents multi-call evasion where attackers batch small calls to drain funds.
     */
    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) public override(Governor) returns (uint256) {
        uint256 totalProposalMaxPrice = 0;
        bytes4 buySelector = INFTTreasury.executeBuyNFT.selector;

        for (uint256 i = 0; i < targets.length; i++) {
            if (targets[i] == treasury && calldatas[i].length >= 4) {
                bytes4 selector;
                bytes memory cd = calldatas[i];
                assembly {
                    selector := mload(add(cd, 32))
                }

                if (selector == buySelector) {
                    require(cd.length >= 4 + (32 * 5), "Governor: Malformed buy calldata");
                    (, , , uint256 maxPrice, ) = abi.decode(
                        _slice(cd, 4, cd.length - 4),
                        (address, address, uint256, uint256, uint256)
                    );
                    totalProposalMaxPrice += maxPrice;
                }
            }
        }

        require(
            totalProposalMaxPrice <= maxPerProposalLimit,
            "Governor: Total maxPrice exceeds proposal spending limit"
        );

        return super.propose(targets, values, calldatas, description);
    }

    function _slice(
        bytes memory data,
        uint256 start,
        uint256 length
    ) internal pure returns (bytes memory) {
        bytes memory result = new bytes(length);
        for (uint256 i = 0; i < length; i++) {
            result[i] = data[start + i];
        }
        return result;
    }

    // Required overrides for OpenZeppelin Governor modules:

    function votingDelay()
        public
        view
        override(Governor, GovernorSettings)
        returns (uint256)
    {
        return super.votingDelay();
    }

    function votingPeriod()
        public
        view
        override(Governor, GovernorSettings)
        returns (uint256)
    {
        return super.votingPeriod();
    }

    function quorum(
        uint256 timepoint
    )
        public
        view
        override(Governor, GovernorVotesQuorumFraction)
        returns (uint256)
    {
        return super.quorum(timepoint);
    }

    function state(
        uint256 proposalId
    )
        public
        view
        override(Governor, GovernorTimelockControl)
        returns (ProposalState)
    {
        return super.state(proposalId);
    }

    function proposalNeedsQueuing(
        uint256 proposalId
    )
        public
        view
        override(Governor, GovernorTimelockControl)
        returns (bool)
    {
        return super.proposalNeedsQueuing(proposalId);
    }

    function proposalThreshold()
        public
        view
        override(Governor, GovernorSettings)
        returns (uint256)
    {
        return super.proposalThreshold();
    }

    function _queueOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    )
        internal
        override(Governor, GovernorTimelockControl)
        returns (uint48)
    {
        return super._queueOperations(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _executeOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    )
        internal
        override(Governor, GovernorTimelockControl)
    {
        super._executeOperations(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    )
        internal
        override(Governor, GovernorTimelockControl)
        returns (uint256)
    {
        return super._cancel(targets, values, calldatas, descriptionHash);
    }

    function _executor()
        internal
        view
        override(Governor, GovernorTimelockControl)
        returns (address)
    {
        return super._executor();
    }


}
