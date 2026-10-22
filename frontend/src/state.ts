export interface NFTItem {
  id: bigint;
  name: string;
  collection: string;
  collectionAddress: string;
  price: string; // in ETH
  image: string;
  owner: string;
  acquiredAt?: string;
}

export interface Proposal {
  id: string;
  title: string;
  proposer: string;
  targets: string[];
  values: string[];
  calldatas: string[];
  maxPriceSum: number;
  description: string;
  status: 'Pending' | 'Active' | 'Succeeded' | 'Queued' | 'Executed' | 'Canceled';
  forVotes: number;
  againstVotes: number;
  abstainVotes: number;
  quorum: number;
  eta: number; // timestamp when timelock expires
  voters: Set<string>;
}

export interface Persona {
  id: string;
  name: string;
  role: string;
  address: string;
  tokenBalance: string;
  votingPower: string;
  isDelegated: boolean;
}

export const PERSONAS: Persona[] = [
  {
    id: 'alice',
    name: 'Alice (DAO Whale)',
    role: 'Voter & Proposer (Delegated)',
    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    tokenBalance: '100,000 SCT',
    votingPower: '100,000 SCT',
    isDelegated: true,
  },
  {
    id: 'bob',
    name: 'Bob (Passive Holder)',
    role: 'Quên delegate (SEC-07)',
    address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    tokenBalance: '50,000 SCT',
    votingPower: '0 SCT (Chưa Delegate)',
    isDelegated: false,
  },
  {
    id: 'securityCouncil',
    name: 'Security Council (3/5 Multi-Sig)',
    role: 'Emergency Pause & Timelock Veto',
    address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    tokenBalance: '0 SCT',
    votingPower: '0 SCT',
    isDelegated: false,
  },
  {
    id: 'executor',
    name: 'Community Executor (Anyone)',
    role: 'Address(0) Timelock Executor',
    address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    tokenBalance: '500 SCT',
    votingPower: '500 SCT',
    isDelegated: true,
  },
];

export interface SystemState {
  treasuryBalance: number; // in ETH
  maxPerCallLimit: number; // 5.0 ETH
  dailySpendingLimit: number; // 10.0 ETH
  dailySpent: number; // current day spend
  maxPerProposalLimit: number; // 8.0 ETH
  isPaused: boolean;
  pausedUntil: number; // timestamp
  currentPersona: Persona;
  vaultNFTs: NFTItem[];
  marketNFTs: NFTItem[];
  proposals: Proposal[];
  logs: { time: string; type: 'info' | 'success' | 'error'; message: string }[];
}

export const INITIAL_STATE: SystemState = {
  treasuryBalance: 20.0,
  maxPerCallLimit: 5.0,
  dailySpendingLimit: 10.0,
  dailySpent: 0.0,
  maxPerProposalLimit: 8.0,
  isPaused: false,
  pausedUntil: 0,
  currentPersona: PERSONAS[0],
  vaultNFTs: [
    {
      id: 101n,
      name: 'CyberPunk Genesis #101',
      collection: 'CryptoArtifacts VIP',
      collectionAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
      price: '2.0',
      image: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=500&auto=format&fit=crop&q=60',
      owner: 'NFTTreasury Vault',
      acquiredAt: 'Khởi tạo hệ thống',
    },
  ],
  marketNFTs: [
    {
      id: 777n,
      name: 'Punk Samurai #777',
      collection: 'CryptoArtifacts VIP',
      collectionAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
      price: '2.0',
      image: 'https://images.unsplash.com/photo-1634973357973-f2ed2657db3c?w=500&auto=format&fit=crop&q=60',
      owner: 'Marketplace Listing (Seller: Alice)',
    },
    {
      id: 42n,
      name: 'Neo Kongz #42',
      collection: 'CryptoArtifacts VIP',
      collectionAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
      price: '1.5',
      image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=60',
      owner: 'Marketplace Listing (Seller: Bob)',
    },
    {
      id: 1337n,
      name: 'Bored Android #1337',
      collection: 'CryptoArtifacts VIP',
      collectionAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
      price: '3.5',
      image: 'https://images.unsplash.com/photo-1638803040283-7a5ffd48dad5?w=500&auto=format&fit=crop&q=60',
      owner: 'Marketplace Listing (Seller: VIP Collector)',
    },
    {
      id: 88n,
      name: 'Glacial Penguin #88',
      collection: 'CryptoArtifacts VIP',
      collectionAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
      price: '4.8',
      image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=60',
      owner: 'Marketplace Listing (Seller: Whale)',
    },
  ],
  proposals: [
    {
      id: 'PROP-01',
      title: 'Đề xuất #1: Mua Punk Samurai #777 (Giá 2.0 ETH)',
      proposer: '0x7099...79C8 (Alice)',
      targets: ['NFTTreasury'],
      values: ['0 ETH'],
      calldatas: ['executeBuyNFT(SafeAdapter, PunkArtifacts, #777, maxPrice: 3.0 ETH)'],
      maxPriceSum: 3.0,
      description: 'Dùng SafeAdapter để mua Punk #777, trần maxPrice 3.0 ETH, hoàn trả 1.0 ETH thừa.',
      status: 'Active',
      forVotes: 100000,
      againstVotes: 0,
      abstainVotes: 0,
      quorum: 40000,
      eta: 0,
      voters: new Set(['alice']),
    },
    {
      id: 'PROP-02',
      title: 'Đề xuất #2: Mua Neo Kongz #42 (Đã sẵn sàng trong Timelock)',
      proposer: '0x7099...79C8 (Alice)',
      targets: ['NFTTreasury'],
      values: ['0 ETH'],
      calldatas: ['executeBuyNFT(SafeAdapter, PunkArtifacts, #42, maxPrice: 2.0 ETH)'],
      maxPriceSum: 2.0,
      description: 'Đã bỏ phiếu thành công 100,000 For, hiện đang ở trong cửa sổ quan sát 48h của Timelock.',
      status: 'Queued',
      forVotes: 100000,
      againstVotes: 0,
      abstainVotes: 0,
      quorum: 40000,
      eta: Date.now() + 86400 * 1000, // 24h còn lại
      voters: new Set(['alice']),
    },
  ],
  logs: [
    {
      time: new Date().toLocaleTimeString(),
      type: 'info',
      message: 'Khởi tạo hệ thống Secure Collector DAO. Đã kết nối với Hardhat Node.',
    },
    {
      time: new Date().toLocaleTimeString(),
      type: 'success',
      message: 'Quyền TimelockController & AccessControl đã được cấu hình khép kín.',
    },
  ],
};
