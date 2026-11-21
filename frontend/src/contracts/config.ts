export interface ContractAddresses {
  GovToken: string;
  TimelockController: string;
  NFTTreasury: string;
  NFTDaoGovernor: string;
  MockMarketplace: string;
  SafeMarketplaceAdapter: string;
}

// Địa chỉ mặc định triển khai trên Hardhat Local Node (với deployer là account #0)
export const DEFAULT_CONTRACT_ADDRESSES: ContractAddresses = {
  GovToken: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  TimelockController: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
  NFTTreasury: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
  NFTDaoGovernor: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
  MockMarketplace: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
  SafeMarketplaceAdapter: '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707',
};

const STORAGE_KEY = 'secure_collector_dao_contracts_v1';

export function getContractAddresses(): ContractAddresses {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_CONTRACT_ADDRESSES, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.warn('Lỗi đọc địa chỉ từ localStorage, sử dụng mặc định:', e);
  }
  return { ...DEFAULT_CONTRACT_ADDRESSES };
}

export function saveContractAddresses(addresses: Partial<ContractAddresses>) {
  const current = getContractAddresses();
  const updated = { ...current, ...addresses };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export const GOV_TOKEN_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function getVotes(address account) view returns (uint256)',
  'function delegates(address account) view returns (address)',
  'function delegate(address delegatee) external',
  'function transfer(address to, uint256 amount) external returns (bool)',
  'event DelegateChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate)',
  'event DelegateVotesChanged(address indexed delegate, uint256 previousVotes, uint256 newVotes)'
];

export const TREASURY_ABI = [
  'function pausedUntil() view returns (uint256)',
  'function maxPerCallLimit() view returns (uint256)',
  'function dailySpendingLimit() view returns (uint256)',
  'function dailySpent(uint256 day) view returns (uint256)',
  'function isAdapterWhitelisted(address) view returns (bool)',
  'function isCollectionWhitelisted(address) view returns (bool)',
  'function pauseTrading(uint256 duration) external',
  'function executeBuyNFT(address adapter, address collection, uint256 tokenId, uint256 maxPrice, uint256 deadline) external returns (uint256)',
  'function hasRole(bytes32 role, address account) view returns (bool)',
  'function SECURITY_COUNCIL_ROLE() view returns (bytes32)',
  'function TIMELOCK_ROLE() view returns (bytes32)',
  'function DEFAULT_ADMIN_ROLE() view returns (bytes32)',
  'event TradingPausedUntil(uint256 indexed pausedUntil)',
  'event SpendingLimitsUpdated(uint256 maxPerCall, uint256 dailyLimit)'
];

export const GOVERNOR_ABI = [
  'function name() view returns (string)',
  'function votingDelay() view returns (uint256)',
  'function votingPeriod() view returns (uint256)',
  'function proposalThreshold() view returns (uint256)',
  'function quorum(uint256 timepoint) view returns (uint256)',
  'function state(uint256 proposalId) view returns (uint8)',
  'function proposalVotes(uint256 proposalId) view returns (uint256 againstVotes, uint256 forVotes, uint256 abstainVotes)',
  'function propose(address[] targets, uint256[] values, bytes[] calldatas, string description) returns (uint256)',
  'function castVote(uint256 proposalId, uint8 support) returns (uint256)',
  'function queue(address[] targets, uint256[] values, bytes[] calldatas, bytes32 descriptionHash) returns (uint256)',
  'function execute(address[] targets, uint256[] values, bytes[] calldatas, bytes32 descriptionHash) payable returns (uint256)',
  'function maxPerProposalLimit() view returns (uint256)',
  'event ProposalCreated(uint256 proposalId, address proposer, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 voteStart, uint256 voteEnd, string description)',
  'event VoteCast(address indexed voter, uint256 proposalId, uint8 support, uint256 weight, string reason)'
];

export const TIMELOCK_ABI = [
  'function getMinDelay() view returns (uint256)',
  'function isOperation(bytes32 id) view returns (bool)',
  'function isOperationDone(bytes32 id) view returns (bool)',
  'function isOperationReady(bytes32 id) view returns (bool)',
  'function isOperationPending(bytes32 id) view returns (bool)',
  'function cancel(bytes32 id) external',
  'function CANCELLER_ROLE() view returns (bytes32)',
  'function PROPOSER_ROLE() view returns (bytes32)',
  'function EXECUTOR_ROLE() view returns (bytes32)'
];

export const ADAPTER_ABI = [
  'function buyNFT(address nftContract, uint256 tokenId, uint256 maxPrice) payable returns (uint256)',
  'function sellNFT(address nftContract, uint256 tokenId, uint256 minRevenue) returns (uint256)'
];
