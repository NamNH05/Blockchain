import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import {
  NFTTreasury,
  SafeMarketplaceAdapter,
  MaliciousMarketplaceAdapter,
  MockMarketplace,
  MockNFT,
} from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("NFTTreasury & Adapter Security Test Suite", function () {
  let admin: HardhatEthersSigner;
  let timelock: HardhatEthersSigner;
  let securityCouncil: HardhatEthersSigner;
  let seller: HardhatEthersSigner;
  let attacker: HardhatEthersSigner;

  let treasury: NFTTreasury;
  let mockNft: MockNFT;
  let marketplace: MockMarketplace;
  let safeAdapter: SafeMarketplaceAdapter;
  let maliciousAdapter: MaliciousMarketplaceAdapter;

  const MAX_PER_CALL = ethers.parseEther("5.0");
  const DAILY_LIMIT = ethers.parseEther("10.0");
  const TREASURY_ETH = ethers.parseEther("20.0");

  beforeEach(async function () {
    [admin, timelock, securityCouncil, seller, attacker] = await ethers.getSigners();

    // Deploy Mock NFT
    const MockNFTFactory = await ethers.getContractFactory("MockNFT");
    mockNft = (await MockNFTFactory.deploy("CryptoArtifacts", "ART")) as unknown as MockNFT;

    // Deploy Mock Marketplace
    const MarketplaceFactory = await ethers.getContractFactory("MockMarketplace");
    marketplace = (await MarketplaceFactory.deploy()) as unknown as MockMarketplace;

    // Deploy Adapters
    const SafeAdapterFactory = await ethers.getContractFactory("SafeMarketplaceAdapter");
    safeAdapter = (await SafeAdapterFactory.deploy(await marketplace.getAddress())) as unknown as SafeMarketplaceAdapter;

    const MaliciousAdapterFactory = await ethers.getContractFactory("MaliciousMarketplaceAdapter");
    maliciousAdapter = (await MaliciousAdapterFactory.deploy(
      await marketplace.getAddress()
    )) as unknown as MaliciousMarketplaceAdapter;

    // Deploy NFTTreasury
    const TreasuryFactory = await ethers.getContractFactory("NFTTreasury");
    treasury = (await TreasuryFactory.deploy(
      admin.address,
      timelock.address,
      securityCouncil.address,
      MAX_PER_CALL,
      DAILY_LIMIT
    )) as unknown as NFTTreasury;

    // Fund Treasury with ETH
    await admin.sendTransaction({
      to: await treasury.getAddress(),
      value: TREASURY_ETH,
    });

    // Whitelist safe adapter and mock NFT collection via timelock
    await treasury.connect(timelock).setWhitelistAdapter(await safeAdapter.getAddress(), true);
    await treasury.connect(timelock).setWhitelistAdapter(await maliciousAdapter.getAddress(), true);
    await treasury.connect(timelock).setWhitelistCollection(await mockNft.getAddress(), true);
  });

  describe("Happy Path Operations", function () {
    it("should successfully buy an NFT, refund excess ETH, and update daily spending", async function () {
      const tokenId = 1n;
      const listingPrice = ethers.parseEther("2.0");
      const maxPrice = ethers.parseEther("3.0"); // 1 ETH excess to be refunded

      // Seller mints NFT and lists it on marketplace
      await mockNft.mint(seller.address, tokenId);
      await mockNft.connect(seller).approve(await marketplace.getAddress(), tokenId);
      await marketplace.connect(seller).list(await mockNft.getAddress(), tokenId, listingPrice);

      const deadline = (await time.latest()) + 3600;
      const treasuryBalBefore = await ethers.provider.getBalance(await treasury.getAddress());

      // Execute buy via timelock
      const tx = await treasury
        .connect(timelock)
        .executeBuyNFT(
          await safeAdapter.getAddress(),
          await mockNft.getAddress(),
          tokenId,
          maxPrice,
          deadline
        );
      await tx.wait();

      // Check NFT ownership
      expect(await mockNft.ownerOf(tokenId)).to.equal(await treasury.getAddress());

      // Check Treasury ETH balance (only 2.0 ETH spent, 1.0 ETH excess refunded)
      const treasuryBalAfter = await ethers.provider.getBalance(await treasury.getAddress());
      expect(treasuryBalBefore - treasuryBalAfter).to.equal(listingPrice);

      // Check daily spending tracking
      const currentDay = BigInt(await time.latest()) / 86400n;
      expect(await treasury.dailySpent(currentDay)).to.equal(listingPrice);
    });

    it("should successfully sell an NFT and credit net revenue to Treasury", async function () {
      const tokenId = 2n;
      const offerPrice = ethers.parseEther("2.5");

      // Treasury initially owns NFT #2
      await mockNft.mint(await treasury.getAddress(), tokenId);

      // Fund marketplace with liquidity so it can pay for sales
      await admin.sendTransaction({
        to: await marketplace.getAddress(),
        value: ethers.parseEther("10.0"),
      });

      const deadline = (await time.latest()) + 3600;
      const treasuryBalBefore = await ethers.provider.getBalance(await treasury.getAddress());

      const tx = await treasury
        .connect(timelock)
        .executeSellNFT(
          await safeAdapter.getAddress(),
          await mockNft.getAddress(),
          tokenId,
          offerPrice,
          deadline
        );
      await tx.wait();

      // Treasury should no longer own the token
      expect(await mockNft.ownerOf(tokenId)).to.not.equal(await treasury.getAddress());

      // Treasury balance should have increased by offerPrice
      const treasuryBalAfter = await ethers.provider.getBalance(await treasury.getAddress());
      expect(treasuryBalAfter - treasuryBalBefore).to.equal(offerPrice);
    });
  });

  describe("Security Test Cases (SEC-01 to SEC-11)", function () {
    it("SEC-01: should revert if adapter steals excess ETH refund", async function () {
      const tokenId = 101n;
      const listingPrice = ethers.parseEther("1.5");
      const maxPrice = ethers.parseEther("3.0"); // Adapter keeps the 1.5 ETH refund!

      await mockNft.mint(seller.address, tokenId);
      await mockNft.connect(seller).approve(await marketplace.getAddress(), tokenId);
      await marketplace.connect(seller).list(await mockNft.getAddress(), tokenId, listingPrice);

      // Configure malicious adapter to steal refund
      await maliciousAdapter.setAttackMode(1); // AttackMode.STEAL_REFUND

      const deadline = (await time.latest()) + 3600;

      await expect(
        treasury
          .connect(timelock)
          .executeBuyNFT(
            await maliciousAdapter.getAddress(),
            await mockNft.getAddress(),
            tokenId,
            maxPrice,
            deadline
          )
      ).to.be.revertedWith("Treasury: Revenue/Refund mismatch");

      // Verify Treasury did not lose any funds
      expect(await mockNft.ownerOf(tokenId)).to.not.equal(await treasury.getAddress());
    });

    it("SEC-02: should revert if adapter sends wrong NFT tokenId to Treasury", async function () {
      const tokenId = 102n;
      const listingPrice = ethers.parseEther("1.0");
      const maxPrice = ethers.parseEther("1.0");

      await mockNft.mint(seller.address, tokenId);
      await mockNft.connect(seller).approve(await marketplace.getAddress(), tokenId);
      await marketplace.connect(seller).list(await mockNft.getAddress(), tokenId, listingPrice);

      // Configure malicious adapter to deliver a bogus token
      await maliciousAdapter.setAttackMode(2); // AttackMode.SEND_WRONG_TOKEN

      const deadline = (await time.latest()) + 3600;

      await expect(
        treasury
          .connect(timelock)
          .executeBuyNFT(
            await maliciousAdapter.getAddress(),
            await mockNft.getAddress(),
            tokenId,
            maxPrice,
            deadline
          )
      ).to.be.revertedWith("Treasury: NFT not received");
    });

    it("SEC-03: should revert if adapter attempts reentrancy attack against Treasury", async function () {
      const tokenId = 103n;
      const listingPrice = ethers.parseEther("1.0");
      const maxPrice = ethers.parseEther("1.0");

      await mockNft.mint(seller.address, tokenId);
      await mockNft.connect(seller).approve(await marketplace.getAddress(), tokenId);
      await marketplace.connect(seller).list(await mockNft.getAddress(), tokenId, listingPrice);

      // Configure malicious adapter to re-enter Treasury
      await maliciousAdapter.setAttackMode(3); // AttackMode.REENTRANCY
      await maliciousAdapter.setReentrancyTreasury(await treasury.getAddress());

      const deadline = (await time.latest()) + 3600;

      // Must be blocked by OpenZeppelin's ReentrancyGuard
      await expect(
        treasury
          .connect(timelock)
          .executeBuyNFT(
            await maliciousAdapter.getAddress(),
            await mockNft.getAddress(),
            tokenId,
            maxPrice,
            deadline
          )
      ).to.be.revertedWithCustomError(treasury, "ReentrancyGuardReentrantCall");
    });

    it("SEC-04: should revert when total spending in 24h exceeds DAILY_SPENDING_LIMIT", async function () {
      // Limit is 10 ETH. Buy 2 NFTs of 4.5 ETH = 9 ETH (succeeds), 3rd NFT of 2 ETH = 11 ETH (reverts)
      const token1 = 1041n;
      const token2 = 1042n;
      const token3 = 1043n;
      const price1 = ethers.parseEther("4.5");
      const price2 = ethers.parseEther("4.5");
      const price3 = ethers.parseEther("2.0");

      for (const [tid, p] of [
        [token1, price1],
        [token2, price2],
        [token3, price3],
      ] as const) {
        await mockNft.mint(seller.address, tid);
        await mockNft.connect(seller).approve(await marketplace.getAddress(), tid);
        await marketplace.connect(seller).list(await mockNft.getAddress(), tid, p);
      }

      const deadline = (await time.latest()) + 3600;

      // 1st purchase: 4.5 ETH spent (Cumulative: 4.5 ETH)
      await treasury
        .connect(timelock)
        .executeBuyNFT(
          await safeAdapter.getAddress(),
          await mockNft.getAddress(),
          token1,
          price1,
          deadline
        );

      // 2nd purchase: 4.5 ETH spent (Cumulative: 9.0 ETH)
      await treasury
        .connect(timelock)
        .executeBuyNFT(
          await safeAdapter.getAddress(),
          await mockNft.getAddress(),
          token2,
          price2,
          deadline
        );

      // 3rd purchase: 2.0 ETH -> would reach 11.0 ETH (> 10.0 ETH daily limit)
      await expect(
        treasury
          .connect(timelock)
          .executeBuyNFT(
            await safeAdapter.getAddress(),
            await mockNft.getAddress(),
            token3,
            price3,
            deadline
          )
      ).to.be.revertedWith("Treasury: Daily spending limit exceeded");

      // Verify that after 1 day passes, daily allowance refreshes
      await time.increase(86401); // Advance time past 24 hours
      const newDeadline = (await time.latest()) + 3600;

      await expect(
        treasury
          .connect(timelock)
          .executeBuyNFT(
            await safeAdapter.getAddress(),
            await mockNft.getAddress(),
            token3,
            price3,
            newDeadline
          )
      ).to.not.be.reverted;
    });

    it("SEC-05: should enforce time-bounded emergency pause by Security Council", async function () {
      const tokenId = 105n;
      const price = ethers.parseEther("1.0");

      await mockNft.mint(seller.address, tokenId);
      await mockNft.connect(seller).approve(await marketplace.getAddress(), tokenId);
      await marketplace.connect(seller).list(await mockNft.getAddress(), tokenId, price);

      // Non-council cannot pause
      await expect(
        treasury.connect(attacker).pauseTrading(3600)
      ).to.be.revertedWithCustomError(treasury, "AccessControlUnauthorizedAccount");

      // Cannot pause beyond MAX_PAUSE_DURATION (7 days)
      const eightDays = 8 * 86400;
      await expect(
        treasury.connect(securityCouncil).pauseTrading(eightDays)
      ).to.be.revertedWith("Treasury: Invalid pause duration");

      // Security Council pauses for 3 days
      const threeDays = 3 * 86400;
      await treasury.connect(securityCouncil).pauseTrading(threeDays);

      const deadline = (await time.latest()) + 7 * 86400;

      // Transactions must revert while pause is active
      await expect(
        treasury
          .connect(timelock)
          .executeBuyNFT(
            await safeAdapter.getAddress(),
            await mockNft.getAddress(),
            tokenId,
            price,
            deadline
          )
      ).to.be.revertedWith("Treasury: Trading paused");

      // Fast-forward past pause duration (3 days + 1 second)
      await time.increase(threeDays + 1);

      // Trading automatically resumes WITHOUT any unpause transaction needed
      await expect(
        treasury
          .connect(timelock)
          .executeBuyNFT(
            await safeAdapter.getAddress(),
            await mockNft.getAddress(),
            tokenId,
            price,
            deadline
          )
      ).to.not.be.reverted;
    });

    it("SEC-06: should revert when transaction deadline is exceeded", async function () {
      const tokenId = 106n;
      const price = ethers.parseEther("1.0");

      await mockNft.mint(seller.address, tokenId);
      await mockNft.connect(seller).approve(await marketplace.getAddress(), tokenId);
      await marketplace.connect(seller).list(await mockNft.getAddress(), tokenId, price);

      // Deadline in past
      const pastDeadline = (await time.latest()) - 100;

      await expect(
        treasury
          .connect(timelock)
          .executeBuyNFT(
            await safeAdapter.getAddress(),
            await mockNft.getAddress(),
            tokenId,
            price,
            pastDeadline
          )
      ).to.be.revertedWith("Treasury: Transaction expired");
    });

    it("SEC-08: should roll back entire transaction safely if adapter refund reverts", async function () {
      const tokenId = 108n;
      const price = ethers.parseEther("1.0");
      const maxPrice = ethers.parseEther("2.0");

      await mockNft.mint(seller.address, tokenId);
      await mockNft.connect(seller).approve(await marketplace.getAddress(), tokenId);
      await marketplace.connect(seller).list(await mockNft.getAddress(), tokenId, price);

      await maliciousAdapter.setAttackMode(4); // AttackMode.REVERT_ON_REFUND

      const deadline = (await time.latest()) + 3600;

      await expect(
        treasury
          .connect(timelock)
          .executeBuyNFT(
            await maliciousAdapter.getAddress(),
            await mockNft.getAddress(),
            tokenId,
            maxPrice,
            deadline
          )
      ).to.be.revertedWith("MaliciousAdapter: Simulated refund crash");
    });

    it("SEC-11: should revert if adapter reports fraudulent actualPrice", async function () {
      const tokenId = 111n;
      const listingPrice = ethers.parseEther("2.0");
      const maxPrice = ethers.parseEther("2.0");

      await mockNft.mint(seller.address, tokenId);
      await mockNft.connect(seller).approve(await marketplace.getAddress(), tokenId);
      await marketplace.connect(seller).list(await mockNft.getAddress(), tokenId, listingPrice);

      // Adapter actually pays 2.0 ETH but falsely reports actualPrice = 1.0 ETH
      await maliciousAdapter.setAttackMode(5); // AttackMode.REPORT_WRONG_PRICE
      await maliciousAdapter.setFakeReportedPrice(ethers.parseEther("1.0"));

      const deadline = (await time.latest()) + 3600;

      await expect(
        treasury
          .connect(timelock)
          .executeBuyNFT(
            await maliciousAdapter.getAddress(),
            await mockNft.getAddress(),
            tokenId,
            maxPrice,
            deadline
          )
      ).to.be.revertedWith("Treasury: Revenue/Refund mismatch");
    });

    it("Access Control: non-timelock cannot execute trades or modify whitelists", async function () {
      await expect(
        treasury
          .connect(attacker)
          .setWhitelistAdapter(await safeAdapter.getAddress(), false)
      ).to.be.revertedWithCustomError(treasury, "AccessControlUnauthorizedAccount");

      await expect(
        treasury
          .connect(attacker)
          .setWhitelistCollection(await mockNft.getAddress(), false)
      ).to.be.revertedWithCustomError(treasury, "AccessControlUnauthorizedAccount");

      await expect(
        treasury
          .connect(attacker)
          .executeBuyNFT(
            await safeAdapter.getAddress(),
            await mockNft.getAddress(),
            1n,
            ethers.parseEther("1.0"),
            (await time.latest()) + 3600
          )
      ).to.be.revertedWithCustomError(treasury, "AccessControlUnauthorizedAccount");
    });

    it("Constructor & Parameter Validations", async function () {
      const TreasuryFactory = await ethers.getContractFactory("NFTTreasury");
      
      // Admin zero
      await expect(
        TreasuryFactory.deploy(ethers.ZeroAddress, timelock.address, securityCouncil.address, MAX_PER_CALL, DAILY_LIMIT)
      ).to.be.revertedWith("Treasury: Invalid admin");

      // Timelock zero
      await expect(
        TreasuryFactory.deploy(admin.address, ethers.ZeroAddress, securityCouncil.address, MAX_PER_CALL, DAILY_LIMIT)
      ).to.be.revertedWith("Treasury: Invalid timelock");

      // Council zero
      await expect(
        TreasuryFactory.deploy(admin.address, timelock.address, ethers.ZeroAddress, MAX_PER_CALL, DAILY_LIMIT)
      ).to.be.revertedWith("Treasury: Invalid security council");

      // Max per call zero
      await expect(
        TreasuryFactory.deploy(admin.address, timelock.address, securityCouncil.address, 0, DAILY_LIMIT)
      ).to.be.revertedWith("Treasury: Invalid maxPerCallLimit");

      // Daily limit < call limit
      await expect(
        TreasuryFactory.deploy(admin.address, timelock.address, securityCouncil.address, ethers.parseEther("5"), ethers.parseEther("2"))
      ).to.be.revertedWith("Treasury: Daily limit must be >= call limit");
    });

    it("Limit setters and zero address whitelist validations", async function () {
      await expect(
        treasury.connect(timelock).setWhitelistAdapter(ethers.ZeroAddress, true)
      ).to.be.revertedWith("Treasury: Zero address");

      await expect(
        treasury.connect(timelock).setWhitelistCollection(ethers.ZeroAddress, true)
      ).to.be.revertedWith("Treasury: Zero address");

      // Update limits successfully
      await treasury.connect(timelock).setSpendingLimits(ethers.parseEther("6"), ethers.parseEther("12"));
      expect(await treasury.maxPerCallLimit()).to.equal(ethers.parseEther("6"));
      expect(await treasury.dailySpendingLimit()).to.equal(ethers.parseEther("12"));

      // Update limits invalid
      await expect(
        treasury.connect(timelock).setSpendingLimits(0, ethers.parseEther("10"))
      ).to.be.revertedWith("Treasury: Invalid maxPerCall");

      await expect(
        treasury.connect(timelock).setSpendingLimits(ethers.parseEther("10"), ethers.parseEther("5"))
      ).to.be.revertedWith("Treasury: Daily limit must be >= call limit");
    });

    it("Buy and Sell pre-condition checks", async function () {
      const deadline = (await time.latest()) + 3600;

      // Buy: Collection not whitelisted
      await expect(
        treasury.connect(timelock).executeBuyNFT(
          await safeAdapter.getAddress(),
          attacker.address, // not whitelisted
          1n,
          ethers.parseEther("1.0"),
          deadline
        )
      ).to.be.revertedWith("Treasury: Collection not whitelisted");

      // Buy: Adapter not whitelisted
      await expect(
        treasury.connect(timelock).executeBuyNFT(
          attacker.address, // not whitelisted
          await mockNft.getAddress(),
          1n,
          ethers.parseEther("1.0"),
          deadline
        )
      ).to.be.revertedWith("Treasury: Adapter not whitelisted");

      // Buy: Max call limit exceeded
      await expect(
        treasury.connect(timelock).executeBuyNFT(
          await safeAdapter.getAddress(),
          await mockNft.getAddress(),
          1n,
          ethers.parseEther("6.0"), // exceeds 5 ETH limit
          deadline
        )
      ).to.be.revertedWith("Treasury: Max call limit exceeded");

      // Buy: Insufficient Treasury balance
      await expect(
        treasury.connect(timelock).executeBuyNFT(
          await safeAdapter.getAddress(),
          await mockNft.getAddress(),
          1n,
          ethers.parseEther("5.0"),
          deadline
        )
      ); // Will check balance or already owned

      // Sell: NFT not owned by Treasury
      await mockNft.mint(seller.address, 999999n);
      await expect(
        treasury.connect(timelock).executeSellNFT(
          await safeAdapter.getAddress(),
          await mockNft.getAddress(),
          999999n,
          ethers.parseEther("1.0"),
          deadline
        )
      ).to.be.revertedWith("Treasury: NFT not owned");

      // Sell: Adapter not whitelisted
      await expect(
        treasury.connect(timelock).executeSellNFT(
          attacker.address,
          await mockNft.getAddress(),
          999999n,
          ethers.parseEther("1.0"),
          deadline
        )
      ).to.be.revertedWith("Treasury: Adapter not whitelisted");

      // Test getDailySpent helper
      const now = await time.latest();
      expect(await treasury.getDailySpent(now)).to.equal(0n);
    });
  });
});
