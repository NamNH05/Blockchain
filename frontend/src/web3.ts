import { BrowserProvider, Contract, formatEther, JsonRpcProvider, parseEther } from 'ethers';
import {
  ADAPTER_ABI,
  getContractAddresses,
  GOV_TOKEN_ABI,
  GOVERNOR_ABI,
  TIMELOCK_ABI,
  TREASURY_ABI
} from './contracts/config';

export interface Web3State {
  isSupported: boolean;
  isConnected: boolean;
  account: string;
  chainId: number;
  ethBalance: string;
  govBalance: string;
  votingPower: string;
  isDelegated: boolean;
  delegatee: string;
  // Treasury On-chain stats
  treasuryBalance: string;
  isPaused: boolean;
  pausedUntil: number;
  dailySpent: string;
  dailySpendingLimit: string;
  maxPerCallLimit: string;
}

export const INITIAL_WEB3_STATE: Web3State = {
  isSupported: typeof window !== 'undefined' && !!(window as any).ethereum,
  isConnected: false,
  account: '',
  chainId: 0,
  ethBalance: '0.0',
  govBalance: '0',
  votingPower: '0',
  isDelegated: false,
  delegatee: '',
  treasuryBalance: '0.0',
  isPaused: false,
  pausedUntil: 0,
  dailySpent: '0.0',
  dailySpendingLimit: '10.0',
  maxPerCallLimit: '5.0',
};

class Web3Service {
  private browserProvider: BrowserProvider | null = null;
  private readOnlyProvider: JsonRpcProvider | null = null;
  public state: Web3State = { ...INITIAL_WEB3_STATE };
  private listeners: ((state: Web3State) => void)[] = [];

  constructor() {
    this.initProviders();
  }

  private initProviders() {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      this.browserProvider = new BrowserProvider((window as any).ethereum);
      this.setupWalletListeners();
    }
    // Fallback read-only provider kết nối đến Hardhat local node
    this.readOnlyProvider = new JsonRpcProvider('http://127.0.0.1:8545');
  }

  public subscribe(cb: (state: Web3State) => void) {
    this.listeners.push(cb);
    cb(this.state);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  private notify() {
    this.listeners.forEach((cb) => cb({ ...this.state }));
  }

  private setupWalletListeners() {
    const ethereum = (window as any).ethereum;
    if (!ethereum || !ethereum.on) return;

    ethereum.on('accountsChanged', async (accounts: string[]) => {
      if (accounts.length === 0) {
        this.state.isConnected = false;
        this.state.account = '';
      } else {
        this.state.account = accounts[0];
        this.state.isConnected = true;
        await this.syncAll();
      }
      this.notify();
    });

    ethereum.on('chainChanged', async () => {
      await this.syncAll();
      this.notify();
    });
  }

  public async connectWallet(): Promise<string> {
    if (!(window as any).ethereum) {
      throw new Error('Không tìm thấy tiện ích Web3 (MetaMask). Hãy cài đặt MetaMask extension.');
    }
    this.browserProvider = new BrowserProvider((window as any).ethereum);
    const accounts = await this.browserProvider.send('eth_requestAccounts', []);
    if (!accounts || accounts.length === 0) {
      throw new Error('Người dùng từ chối cấp quyền truy cập ví.');
    }

    const network = await this.browserProvider.getNetwork();
    this.state.isConnected = true;
    this.state.account = accounts[0];
    this.state.chainId = Number(network.chainId);

    await this.syncAll();
    this.notify();
    return accounts[0];
  }

  public disconnectWallet() {
    this.state.isConnected = false;
    this.state.account = '';
    this.state.ethBalance = '0.0';
    this.state.govBalance = '0';
    this.state.votingPower = '0';
    this.state.isDelegated = false;
    this.state.delegatee = '';
    this.notify();
  }

  public async getProvider() {
    if (this.browserProvider && this.state.isConnected) {
      return this.browserProvider;
    }
    return this.readOnlyProvider || new JsonRpcProvider('http://127.0.0.1:8545');
  }

  public async getSigner() {
    if (!this.browserProvider || !this.state.isConnected) {
      throw new Error('Vui lòng kết nối ví MetaMask trước khi thực hiện giao dịch!');
    }
    return await this.browserProvider.getSigner();
  }

  public async getContracts(signerOrProvider?: any) {
    const providerOrSigner = signerOrProvider || (await this.getProvider());
    const addresses = getContractAddresses();

    return {
      govToken: new Contract(addresses.GovToken, GOV_TOKEN_ABI, providerOrSigner),
      treasury: new Contract(addresses.NFTTreasury, TREASURY_ABI, providerOrSigner),
      governor: new Contract(addresses.NFTDaoGovernor, GOVERNOR_ABI, providerOrSigner),
      timelock: new Contract(addresses.TimelockController, TIMELOCK_ABI, providerOrSigner),
      adapter: new Contract(addresses.SafeMarketplaceAdapter, ADAPTER_ABI, providerOrSigner),
    };
  }

  // Đọc toàn bộ dữ liệu on-chain thực tế
  public async syncAll(): Promise<void> {
    const provider = await this.getProvider();
    const addresses = getContractAddresses();

    try {
      // 1. Đọc số dư Treasury
      const treasuryEth = await provider.getBalance(addresses.NFTTreasury);
      this.state.treasuryBalance = parseFloat(formatEther(treasuryEth)).toFixed(2);
    } catch (e) {
      console.warn('Không thể đọc số dư Treasury On-chain:', e);
    }

    try {
      // 2. Đọc thông số Treasury contract
      const contracts = await this.getContracts(provider);
      const [pausedUntilBn, maxPerCallBn, dailyLimitBn] = await Promise.all([
        contracts.treasury.pausedUntil().catch(() => 0n),
        contracts.treasury.maxPerCallLimit().catch(() => parseEther('5.0')),
        contracts.treasury.dailySpendingLimit().catch(() => parseEther('10.0')),
      ]);

      const nowSec = Math.floor(Date.now() / 1000);
      this.state.pausedUntil = Number(pausedUntilBn);
      this.state.isPaused = this.state.pausedUntil > nowSec;
      this.state.maxPerCallLimit = parseFloat(formatEther(maxPerCallBn)).toFixed(1);
      this.state.dailySpendingLimit = parseFloat(formatEther(dailyLimitBn)).toFixed(1);

      // Đọc chi tiêu ngày hiện tại
      const currentDay = Math.floor(nowSec / 86400);
      const spentTodayBn = await contracts.treasury.dailySpent(currentDay).catch(() => 0n);
      this.state.dailySpent = parseFloat(formatEther(spentTodayBn)).toFixed(2);
    } catch (e) {
      console.warn('Không thể đọc thông số Treasury contract:', e);
    }

    // 3. Đọc dữ liệu người dùng nếu đã kết nối ví
    if (this.state.isConnected && this.state.account) {
      try {
        const ethBal = await provider.getBalance(this.state.account);
        this.state.ethBalance = parseFloat(formatEther(ethBal)).toFixed(3);

        const contracts = await this.getContracts(provider);
        const [tokenBalBn, votesBn, delegatee] = await Promise.all([
          contracts.govToken.balanceOf(this.state.account).catch(() => 0n),
          contracts.govToken.getVotes(this.state.account).catch(() => 0n),
          contracts.govToken.delegates(this.state.account).catch(() => ''),
        ]);

        this.state.govBalance = parseFloat(formatEther(tokenBalBn)).toLocaleString();
        this.state.votingPower = parseFloat(formatEther(votesBn)).toLocaleString();
        this.state.delegatee = delegatee;
        this.state.isDelegated = delegatee !== '' && delegatee !== '0x0000000000000000000000000000000000000000';
      } catch (e) {
        console.warn('Không thể đọc thông tin tài khoản on-chain:', e);
      }
    }

    this.notify();
  }

  // --- ACTIONS ON-CHAIN ---

  // Kích hoạt Delegate cho chính ví mình hoặc một địa chỉ khác (SEC-07)
  public async liveDelegate(targetAddress?: string): Promise<string> {
    const signer = await this.getSigner();
    const contracts = await this.getContracts(signer);
    const delegatee = targetAddress || (await signer.getAddress());

    const tx = await contracts.govToken.delegate(delegatee);
    await tx.wait(1);
    await this.syncAll();
    return tx.hash;
  }

  // Pause khẩn cấp Treasury (chỉ Security Council mới thành công - SEC-05)
  public async livePauseTrading(durationSeconds: number): Promise<string> {
    const signer = await this.getSigner();
    const contracts = await this.getContracts(signer);

    const tx = await contracts.treasury.pauseTrading(durationSeconds);
    await tx.wait(1);
    await this.syncAll();
    return tx.hash;
  }

  // Tạo đề xuất Governor on-chain (SEC-09)
  public async livePropose(
    targets: string[],
    values: bigint[],
    calldatas: string[],
    description: string
  ): Promise<{ proposalId: string; txHash: string }> {
    const signer = await this.getSigner();
    const contracts = await this.getContracts(signer);

    const tx = await contracts.governor.propose(targets, values, calldatas, description);
    const receipt = await tx.wait(1);

    // Tìm ProposalId trong receipt logs
    let proposalId = '';
    for (const log of receipt.logs) {
      try {
        const parsed = contracts.governor.interface.parseLog(log);
        if (parsed && parsed.name === 'ProposalCreated') {
          proposalId = parsed.args.proposalId.toString();
          break;
        }
      } catch {}
    }

    await this.syncAll();
    return { proposalId, txHash: tx.hash };
  }

  // Bỏ phiếu Thuận (Support = 1) cho đề xuất on-chain
  public async liveCastVote(proposalId: string, support: number = 1): Promise<string> {
    const signer = await this.getSigner();
    const contracts = await this.getContracts(signer);

    const tx = await contracts.governor.castVote(proposalId, support);
    await tx.wait(1);
    await this.syncAll();
    return tx.hash;
  }

  // Đưa đề xuất vào Timelock queue
  public async liveQueue(
    targets: string[],
    values: bigint[],
    calldatas: string[],
    descriptionHash: string
  ): Promise<string> {
    const signer = await this.getSigner();
    const contracts = await this.getContracts(signer);

    const tx = await contracts.governor.queue(targets, values, calldatas, descriptionHash);
    await tx.wait(1);
    await this.syncAll();
    return tx.hash;
  }

  // Thực thi đề xuất qua Timelock
  public async liveExecute(
    targets: string[],
    values: bigint[],
    calldatas: string[],
    descriptionHash: string
  ): Promise<string> {
    const signer = await this.getSigner();
    const contracts = await this.getContracts(signer);

    const tx = await contracts.governor.execute(targets, values, calldatas, descriptionHash);
    await tx.wait(1);
    await this.syncAll();
    return tx.hash;
  }

  // Hàm tiện ích bóc tách lỗi Solidity Revert dễ đọc cho người dùng
  public parseContractError(error: any): string {
    if (error?.reason) return error.reason;
    if (error?.data?.message) return error.data.message;
    if (error?.message) {
      const match = error.message.match(/execution reverted(?:: (.*?))?(?:"|\n|$)/);
      if (match && match[1]) return match[1];
      if (error.message.includes('user rejected')) return 'Người dùng đã hủy xác nhận giao dịch trên ví.';
      if (error.message.includes('Internal JSON-RPC error')) {
        return 'Lỗi JSON-RPC Node: Kiểm tra lại quyền hạn hoặc ràng buộc điều kiện (Revert).';
      }
      return error.message.slice(0, 160);
    }
    return 'Giao dịch bị hoàn tác (Transaction reverted).';
  }
}

export const web3Service = new Web3Service();
