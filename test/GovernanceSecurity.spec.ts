import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import {
  NFTTreasury,
  NFTDaoGovernor,
  GovToken,
  SafeMarketplaceAdapter,
  MockMarketplace,
  MockNFT,
} from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("Governance & Timelock Security Test Suite", function () {
  let deployer: HardhatEthersSigner;
  let alice: HardhatEthersSigner; // Major token holder
  let bob: HardhatEthersSigner;   // Token holder who forgets to delegate
  let securityCouncil: HardhatEthersSigner;
  let seller: HardhatEthersSigner;

  let token: GovToken;
  let timelock: any;
  let governor: NFTDaoGovernor;
  let treasury: NFTTreasury;
  let mockNft: MockNFT;
  let marketplace: MockMarketplace;
  let adapter: SafeMarketplaceAdapter;

  const INITIAL_SUPPLY = ethers.parseEther("1000000"); // 1,000,000 GOV
  const TIMELOCK_DELAY = 2 * 86400; // 48 hours (2 days)
  const VOTING_DELAY = 1 * 86400;   // 1 day
  const VOTING_PERIOD = 3 * 86400;  // 3 days
  const PROPOSAL_THRESHOLD = ethers.parseEther("1000"); // 1,000 GOV
  const QUORUM_PERCENT = 4n;        // 4%
  const MAX_PER_CALL = ethers.parseEther("5.0");
  const DAILY_LIMIT = ethers.parseEther("10.0");
  const MAX_PER_PROPOSAL = ethers.parseEther("8.0");

  beforeEach(async function () {
    [deployer, alice, bob, securityCouncil, seller] = await ethers.getSigners();

    // 1. Deploy Governance Token
    const GovTokenFactory = await ethers.getContractFactory("GovToken");
    token = (await GovTokenFactory.deploy(
      "SecureCollectorToken",
      "SCT",
      INITIAL_SUPPLY,
      deployer.address
    )) as unknown as GovToken;

    // Distribute tokens: Alice gets 100,000 GOV, Bob gets 50,000 GOV
    await token.transfer(alice.address, ethers.parseEther("100000"));
    await token.transfer(bob.address, ethers.parseEther("50000"));

    // 2. Deploy OpenZeppelin TimelockController
    const TimelockFactory = await ethers.getContractFactory(
      "@openzeppelin/contracts/governance/TimelockController.sol:TimelockController"
    );
    // Initially deployer is admin, proposers and executors configured later
    timelock = await TimelockFactory.deploy(
      TIMELOCK_DELAY,
      [], // proposers
      [], // executors
      deployer.address
    );

    // 3. Deploy Treasury
    const TreasuryFactory = await ethers.getContractFactory("NFTTreasury");
    treasury = (await TreasuryFactory.deploy(
      deployer.address,
      await timelock.getAddress(),
      securityCouncil.address,
      MAX_PER_CALL,
      DAILY_LIMIT
    )) as unknown as NFTTreasury;

    // 4. Deploy NFTDaoGovernor
    const GovernorFactory = await ethers.getContractFactory("NFTDaoGovernor");
    governor = (await GovernorFactory.deploy(
      await token.getAddress(),
      await timelock.getAddress(),
      await treasury.getAddress(),
      securityCouncil.address,
      MAX_PER_PROPOSAL,
      VOTING_DELAY,
      VOTING_PERIOD,
      PROPOSAL_THRESHOLD,
      QUORUM_PERCENT
    )) as unknown as NFTDaoGovernor;

    // 5. Configure Timelock Roles
    const PROPOSER_ROLE = await timelock.PROPOSER_ROLE();
    const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();
    const CANCELLER_ROLE = await timelock.CANCELLER_ROLE();
    const TIMELOCK_ADMIN_ROLE = await timelock.DEFAULT_ADMIN_ROLE();

    await timelock.grantRole(PROPOSER_ROLE, await governor.getAddress());
    await timelock.grantRole(EXECUTOR_ROLE, ethers.ZeroAddress); // Anyone can execute after delay
    await timelock.grantRole(CANCELLER_ROLE, securityCouncil.address);
    await timelock.grantRole(CANCELLER_ROLE, await governor.getAddress());

    // Transfer Timelock Admin to Timelock itself, renounce deployer admin
    await timelock.grantRole(TIMELOCK_ADMIN_ROLE, await timelock.getAddress());
    await timelock.renounceRole(TIMELOCK_ADMIN_ROLE, deployer.address);

    // Transfer Treasury Admin role to Timelock and renounce deployer
    const DEFAULT_ADMIN_ROLE = await treasury.DEFAULT_ADMIN_ROLE();
    await treasury.grantRole(DEFAULT_ADMIN_ROLE, await timelock.getAddress());
    await treasury.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);

    // 6. Deploy Market and Safe Adapter
    const MockNFTFactory = await ethers.getContractFactory("MockNFT");
    mockNft = (await MockNFTFactory.deploy("PunkArtifacts", "PUNK")) as unknown as MockNFT;

    const MarketplaceFactory = await ethers.getContractFactory("MockMarketplace");
    marketplace = (await MarketplaceFactory.deploy()) as unknown as MockMarketplace;

    const SafeAdapterFactory = await ethers.getContractFactory("SafeMarketplaceAdapter");
    adapter = (await SafeAdapterFactory.deploy(await marketplace.getAddress())) as unknown as SafeMarketplaceAdapter;

    // Fund Treasury with ETH
    await deployer.sendTransaction({
      to: await treasury.getAddress(),
      value: ethers.parseEther("20.0"),
    });

    // Whitelist adapter and collection via Timelock direct execution (schedule and execute)
    const setAdapterData = treasury.interface.encodeFunctionData("setWhitelistAdapter", [
      await adapter.getAddress(),
      true,
    ]);
    const setCollectionData = treasury.interface.encodeFunctionData("setWhitelistCollection", [
      await mockNft.getAddress(),
      true,
    ]);

    // Schedule setup calls in timelock
    const salt = ethers.id("initial_setup");
    await timelock.connect(deployer); // wait, deployer renounced admin, but is deployer proposer? Timelock proposer is governor.
  });

  describe("Governance Unit & Security Scenarios", function () {
    it("SEC-07: Member holds token but does not delegate before Snapshot -> voting power is 0", async function () {
      // Alice delegates to herself
      await token.connect(alice).delegate(alice.address);

      // Bob DOES NOT delegate
      // Check current voting power
      expect(await token.getVotes(bob.address)).to.equal(0n);
      expect(await token.getVotes(alice.address)).to.equal(ethers.parseEther("100000"));

      // Advance time and check historical checkpoints
      const currentBlockTime = await time.latest();
      await time.increase(100);

      expect(await token.getPastVotes(bob.address, currentBlockTime)).to.equal(0n);
      expect(await token.getPastVotes(alice.address, currentBlockTime)).to.equal(
        ethers.parseEther("100000")
      );
    });

    it("SEC-09: Proposal containing multiple buy calls whose sum exceeds MAX_PER_PROPOSAL_LIMIT is rejected by propose()", async function () {
      await token.connect(alice).delegate(alice.address);
      await time.increase(10);

      // Create a batch proposal with 2 buy calls:
      // Call 1: maxPrice = 5.0 ETH
      // Call 2: maxPrice = 4.0 ETH
      // Total maxPrice = 9.0 ETH > MAX_PER_PROPOSAL_LIMIT (8.0 ETH)
      const call1 = treasury.interface.encodeFunctionData("executeBuyNFT", [
        await adapter.getAddress(),
        await mockNft.getAddress(),
        101n,
        ethers.parseEther("5.0"),
        (await time.latest()) + 86400 * 10,
      ]);

      const call2 = treasury.interface.encodeFunctionData("executeBuyNFT", [
        await adapter.getAddress(),
        await mockNft.getAddress(),
        102n,
        ethers.parseEther("4.0"),
        (await time.latest()) + 86400 * 10,
      ]);

      const targets = [await treasury.getAddress(), await treasury.getAddress()];
      const values = [0n, 0n];
      const calldatas = [call1, call2];
      const description = "Batch buy Punks exceeding proposal limit";

      await expect(
        governor.connect(alice).propose(targets, values, calldatas, description)
      ).to.be.revertedWith("Governor: Total maxPrice exceeds proposal spending limit");
    });

    it("Full DAO Lifecycle & SEC-10 Replay Protection: Propose -> Vote -> Queue -> Execute -> Re-execute reverts", async function () {
      // 1. Whitelist adapter & collection directly for testing:
      // Since Timelock owns Treasury, let's execute whitelist setup through Timelock or governor proposal
      // Let's delegate Alice first
      await token.connect(alice).delegate(alice.address);

      // Proposal 1: Whitelist adapter and collection
      const wlAdapter = treasury.interface.encodeFunctionData("setWhitelistAdapter", [
        await adapter.getAddress(),
        true,
      ]);
      const wlCollection = treasury.interface.encodeFunctionData("setWhitelistCollection", [
        await mockNft.getAddress(),
        true,
      ]);

      const setupTargets = [await treasury.getAddress(), await treasury.getAddress()];
      const setupValues = [0n, 0n];
      const setupCalldatas = [wlAdapter, wlCollection];
      const setupDesc = "Proposal #1: Whitelist Adapter and NFT Collection";

      // Propose setup
      const setupTx = await governor
        .connect(alice)
        .propose(setupTargets, setupValues, setupCalldatas, setupDesc);
      const setupReceipt = await setupTx.wait();

      // Get proposalId
      const proposalId = await governor.hashProposal(
        setupTargets,
        setupValues,
        setupCalldatas,
        ethers.id(setupDesc)
      );

      // Wait for voting delay (1 day)
      await time.increase(VOTING_DELAY + 10);

      // Alice votes FOR (support = 1)
      await governor.connect(alice).castVote(proposalId, 1);

      // Wait for voting period (3 days)
      await time.increase(VOTING_PERIOD + 10);

      // Verify Proposal Succeeded (State 4 = Succeeded)
      expect(await governor.state(proposalId)).to.equal(4);

      // Queue into Timelock
      await governor.connect(alice).queue(setupTargets, setupValues, setupCalldatas, ethers.id(setupDesc));
      expect(await governor.state(proposalId)).to.equal(5); // 5 = Queued

      // Wait for Timelock minDelay (2 days)
      await time.increase(TIMELOCK_DELAY + 10);

      // Execute Proposal
      await governor.connect(alice).execute(setupTargets, setupValues, setupCalldatas, ethers.id(setupDesc));
      expect(await governor.state(proposalId)).to.equal(7); // 7 = Executed

      // Verify whitelisting took effect!
      expect(await treasury.isAdapterWhitelisted(await adapter.getAddress())).to.be.true;
      expect(await treasury.isCollectionWhitelisted(await mockNft.getAddress())).to.be.true;

      // SEC-10: Calling execute again on the same proposal must fail
      await expect(
        governor.connect(alice).execute(setupTargets, setupValues, setupCalldatas, ethers.id(setupDesc))
      ).to.be.revertedWithCustomError(governor, "GovernorUnexpectedProposalState");

      // -------------------------------------------------------------
      // 2. Now propose buying an actual NFT: Punk #777 for 2.0 ETH
      // -------------------------------------------------------------
      const tokenId = 777n;
      const listingPrice = ethers.parseEther("2.0");
      const maxPrice = ethers.parseEther("3.0");

      await mockNft.mint(seller.address, tokenId);
      await mockNft.connect(seller).approve(await marketplace.getAddress(), tokenId);
      await marketplace.connect(seller).list(await mockNft.getAddress(), tokenId, listingPrice);

      const buyDeadline = (await time.latest()) + 86400 * 20; // 20 days deadline
      const buyCalldata = treasury.interface.encodeFunctionData("executeBuyNFT", [
        await adapter.getAddress(),
        await mockNft.getAddress(),
        tokenId,
        maxPrice,
        buyDeadline,
      ]);

      const buyTargets = [await treasury.getAddress()];
      const buyValues = [0n];
      const buyCalldatas = [buyCalldata];
      const buyDesc = "Proposal #2: Buy Punk #777 for 2 ETH";

      const buyPropTx = await governor
        .connect(alice)
        .propose(buyTargets, buyValues, buyCalldatas, buyDesc);
      await buyPropTx.wait();

      const buyProposalId = await governor.hashProposal(
        buyTargets,
        buyValues,
        buyCalldatas,
        ethers.id(buyDesc)
      );

      // Voting delay
      await time.increase(VOTING_DELAY + 10);
      await governor.connect(alice).castVote(buyProposalId, 1);

      // Voting period
      await time.increase(VOTING_PERIOD + 10);
      expect(await governor.state(buyProposalId)).to.equal(4); // Succeeded

      // Queue into Timelock
      await governor.connect(alice).queue(buyTargets, buyValues, buyCalldatas, ethers.id(buyDesc));

      // Timelock delay
      await time.increase(TIMELOCK_DELAY + 10);

      // Execute buy!
      const treasuryBalBefore = await ethers.provider.getBalance(await treasury.getAddress());
      await governor.connect(alice).execute(buyTargets, buyValues, buyCalldatas, ethers.id(buyDesc));

      // Check NFT is safely in Treasury
      expect(await mockNft.ownerOf(tokenId)).to.equal(await treasury.getAddress());

      // Treasury spent exactly 2.0 ETH (1.0 ETH refunded)
      const treasuryBalAfter = await ethers.provider.getBalance(await treasury.getAddress());
      expect(treasuryBalBefore - treasuryBalAfter).to.equal(listingPrice);
    });

    it("Security Council Veto / Cancellation in Timelock", async function () {
      await token.connect(alice).delegate(alice.address);

      const dummyCalldata = treasury.interface.encodeFunctionData("pauseTrading", [3600]);
      const targets = [await treasury.getAddress()];
      const values = [0n];
      const calldatas = [dummyCalldata];
      const desc = "Malicious Proposal To Veto";

      await governor.connect(alice).propose(targets, values, calldatas, desc);
      const propId = await governor.hashProposal(targets, values, calldatas, ethers.id(desc));

      await time.increase(VOTING_DELAY + 10);
      await governor.connect(alice).castVote(propId, 1);
      await time.increase(VOTING_PERIOD + 10);

      await governor.connect(alice).queue(targets, values, calldatas, ethers.id(desc));
      expect(await governor.state(propId)).to.equal(5); // Queued

      // Security Council cancels proposal in Timelock during the 48h observation window
      const timelockId = await timelock.hashOperationBatch(
        targets,
        values,
        calldatas,
        ethers.ZeroHash,
        ethers.id(desc) // wait, TimelockController uses operation salt
      );

      // Governor has a cancel function or council cancels on governor / timelock
      await governor.connect(securityCouncil).cancel(targets, values, calldatas, ethers.id(desc));

      // State is now Canceled (State 2 = Canceled)
      expect(await governor.state(propId)).to.equal(2);

      // Advancing time and trying to execute must fail
      await time.increase(TIMELOCK_DELAY + 10);
      await expect(
        governor.connect(alice).execute(targets, values, calldatas, ethers.id(desc))
      ).to.be.revertedWithCustomError(governor, "GovernorUnexpectedProposalState");
    });

    it("GovToken & Governor Constructor & Parameter Validations", async function () {
      // GovToken helper tests
      expect(await token.CLOCK_MODE()).to.equal("mode=timestamp");
      expect(await token.clock()).to.be.closeTo(BigInt(await time.latest()), 5n);
      expect(await token.nonces(alice.address)).to.equal(0n);

      await token.mint(alice.address, ethers.parseEther("100"));
      expect(await token.balanceOf(alice.address)).to.equal(ethers.parseEther("100100"));

      // Governor Constructor Validations
      const GovFactory = await ethers.getContractFactory("NFTDaoGovernor");

      await expect(
        GovFactory.deploy(
          await token.getAddress(),
          await timelock.getAddress(),
          ethers.ZeroAddress,
          securityCouncil.address,
          MAX_PER_PROPOSAL,
          VOTING_DELAY,
          VOTING_PERIOD,
          PROPOSAL_THRESHOLD,
          QUORUM_PERCENT
        )
      ).to.be.revertedWith("Governor: Invalid treasury address");

      await expect(
        GovFactory.deploy(
          await token.getAddress(),
          await timelock.getAddress(),
          await treasury.getAddress(),
          ethers.ZeroAddress,
          MAX_PER_PROPOSAL,
          VOTING_DELAY,
          VOTING_PERIOD,
          PROPOSAL_THRESHOLD,
          QUORUM_PERCENT
        )
      ).to.be.revertedWith("Governor: Invalid security council");

      await expect(
        GovFactory.deploy(
          await token.getAddress(),
          await timelock.getAddress(),
          await treasury.getAddress(),
          securityCouncil.address,
          0,
          VOTING_DELAY,
          VOTING_PERIOD,
          PROPOSAL_THRESHOLD,
          QUORUM_PERCENT
        )
      ).to.be.revertedWith("Governor: Invalid maxPerProposalLimit");

      // Non-governance caller cannot call setMaxPerProposalLimit
      await expect(
        governor.connect(alice).setMaxPerProposalLimit(ethers.parseEther("10"))
      ).to.be.revertedWithCustomError(governor, "GovernorOnlyExecutor");
    });
  });
});
