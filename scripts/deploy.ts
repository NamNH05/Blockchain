import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("=============================================================");
  console.log("SECURE COLLECTOR DAO - SYSTEM DEPLOYMENT");
  console.log("Deployer Address:", deployer.address);
  console.log("=============================================================");

  // 1. Deploy Governance Token (GovToken)
  console.log("\n[1/6] Deploying GovToken...");
  const initialSupply = ethers.parseEther("1000000"); // 1,000,000 SCT
  const GovTokenFactory = await ethers.getContractFactory("GovToken");
  const token = await GovTokenFactory.deploy(
    "Secure Collector Token",
    "SCT",
    initialSupply,
    deployer.address
  );
  await token.waitForDeployment();
  console.log("✓ GovToken deployed at:", await token.getAddress());

  // 2. Deploy OpenZeppelin TimelockController
  console.log("\n[2/6] Deploying TimelockController (minDelay: 48 hours)...");
  const minDelay = 2 * 86400; // 48h
  const TimelockFactory = await ethers.getContractFactory(
    "@openzeppelin/contracts/governance/TimelockController.sol:TimelockController"
  );
  const timelock = await TimelockFactory.deploy(minDelay, [], [], deployer.address);
  await timelock.waitForDeployment();
  console.log("✓ TimelockController deployed at:", await timelock.getAddress());

  // 3. Deploy NFTTreasury
  console.log("\n[3/6] Deploying NFTTreasury...");
  const maxPerCallLimit = ethers.parseEther("5.0"); // 5 ETH
  const dailySpendingLimit = ethers.parseEther("10.0"); // 10 ETH
  const securityCouncilAddress = deployer.address; // For demo/local deployment

  const TreasuryFactory = await ethers.getContractFactory("NFTTreasury");
  const treasury = await TreasuryFactory.deploy(
    deployer.address,
    await timelock.getAddress(),
    securityCouncilAddress,
    maxPerCallLimit,
    dailySpendingLimit
  );
  await treasury.waitForDeployment();
  console.log("✓ NFTTreasury deployed at:", await treasury.getAddress());

  // 4. Deploy NFTDaoGovernor
  console.log("\n[4/6] Deploying NFTDaoGovernor...");
  const maxPerProposalLimit = ethers.parseEther("8.0"); // 8 ETH
  const votingDelay = 1 * 86400; // 1 day
  const votingPeriod = 3 * 86400; // 3 days
  const proposalThreshold = ethers.parseEther("1000"); // 1,000 SCT
  const quorumPercent = 4n; // 4%

  const GovernorFactory = await ethers.getContractFactory("NFTDaoGovernor");
  const governor = await GovernorFactory.deploy(
    await token.getAddress(),
    await timelock.getAddress(),
    await treasury.getAddress(),
    securityCouncilAddress,
    maxPerProposalLimit,
    votingDelay,
    votingPeriod,
    proposalThreshold,
    quorumPercent
  );
  await governor.waitForDeployment();
  console.log("✓ NFTDaoGovernor deployed at:", await governor.getAddress());

  // 5. Deploy Mock Marketplace & Safe Adapter
  console.log("\n[5/6] Deploying MockMarketplace and SafeMarketplaceAdapter...");
  const MarketplaceFactory = await ethers.getContractFactory("MockMarketplace");
  const marketplace = await MarketplaceFactory.deploy();
  await marketplace.waitForDeployment();
  console.log("✓ MockMarketplace deployed at:", await marketplace.getAddress());

  const AdapterFactory = await ethers.getContractFactory("SafeMarketplaceAdapter");
  const adapter = await AdapterFactory.deploy(await marketplace.getAddress());
  await adapter.waitForDeployment();
  console.log("✓ SafeMarketplaceAdapter deployed at:", await adapter.getAddress());

  // 6. Role Handover and Closing Admin Privileges
  console.log("\n[6/6] Handing over roles and securing permissions...");
  const PROPOSER_ROLE = await timelock.PROPOSER_ROLE();
  const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();
  const CANCELLER_ROLE = await timelock.CANCELLER_ROLE();
  const TIMELOCK_ADMIN_ROLE = await timelock.DEFAULT_ADMIN_ROLE();

  // Grant proposer to Governor
  await (await timelock.grantRole(PROPOSER_ROLE, await governor.getAddress())).wait();
  // Grant executor to open community
  await (await timelock.grantRole(EXECUTOR_ROLE, ethers.ZeroAddress)).wait();
  // Grant canceller to Security Council and Governor
  await (await timelock.grantRole(CANCELLER_ROLE, securityCouncilAddress)).wait();
  await (await timelock.grantRole(CANCELLER_ROLE, await governor.getAddress())).wait();

  // Transfer Timelock Admin to Timelock self and revoke from deployer
  await (await timelock.grantRole(TIMELOCK_ADMIN_ROLE, await timelock.getAddress())).wait();
  await (await timelock.renounceRole(TIMELOCK_ADMIN_ROLE, deployer.address)).wait();

  // Transfer Treasury Admin to Timelock self and revoke from deployer
  const TREASURY_ADMIN_ROLE = await treasury.DEFAULT_ADMIN_ROLE();
  await (await treasury.grantRole(TREASURY_ADMIN_ROLE, await timelock.getAddress())).wait();
  await (await treasury.renounceRole(TREASURY_ADMIN_ROLE, deployer.address)).wait();

  console.log("✓ Permissions secured: Timelock and Treasury are now purely community-governed!");

  // Export addresses to frontend
  const deployedAddresses = {
    GovToken: await token.getAddress(),
    TimelockController: await timelock.getAddress(),
    NFTTreasury: await treasury.getAddress(),
    NFTDaoGovernor: await governor.getAddress(),
    MockMarketplace: await marketplace.getAddress(),
    SafeMarketplaceAdapter: await adapter.getAddress(),
  };

  const contractsDir = path.join(__dirname, "..", "frontend", "src", "contracts");
  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(contractsDir, "deployed.json"),
    JSON.stringify(deployedAddresses, null, 2)
  );
  console.log("✓ Deployed contract addresses exported to frontend/src/contracts/deployed.json");

  console.log("\nDeployment completed successfully!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
