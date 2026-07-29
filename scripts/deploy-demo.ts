import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { network } from "hardhat";

/**
 * Deploys a complete demo world — two ERC20s, a funded mock Bancor network, a
 * registry and PicasoToken — and records the addresses for the frontend.
 *
 * Bancor's real IContractRegistry only exists on mainnet, and this contract is
 * unaudited, so a mock is the only responsible target. That makes this script
 * the way to get a working chain on localhost or a testnet.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outFile = join(root, "frontend", "src", "generated", "deployment.json");

const BANCOR_NETWORK_NAME = "BancorNetwork";

async function main() {
  const { ethers } = await network.getOrCreate();
  const [deployer] = await ethers.getSigners();
  const chainId = Number((await ethers.provider.getNetwork()).chainId);

  console.log(`Deploying from ${deployer.address} on chain ${chainId}`);

  // Each deployment is awaited before the next is sent. Issuing two and awaiting
  // them afterwards works against the local node but not a real network: both
  // transactions are built against the same "latest" nonce, so the second comes
  // back as `replacement transaction underpriced`.
  const usdc = await ethers.deployContract("MockERC20", ["USD Coin", "USDC", 6]);
  await usdc.waitForDeployment();
  const sushi = await ethers.deployContract("MockERC20", ["Sushi", "SUSHI", 18]);
  await sushi.waitForDeployment();

  const bancor = await ethers.deployContract("MockBancorNetwork");
  await bancor.waitForDeployment();
  // Liquidity for the mock to pay conversions out of.
  await (await sushi.mint(await bancor.getAddress(), ethers.parseEther("1000000"))).wait();

  const registry = await ethers.deployContract("MockContractRegistry");
  await registry.waitForDeployment();
  await (
    await registry.setAddress(
      ethers.encodeBytes32String(BANCOR_NETWORK_NAME),
      await bancor.getAddress(),
    )
  ).wait();

  const picaso = await ethers.deployContract("PicasoToken", [await registry.getAddress()]);
  await picaso.waitForDeployment();

  // Seed the first few local accounts so the UI has something to spend.
  const signers = (await ethers.getSigners()).slice(0, 5);
  for (const signer of signers) {
    await (await usdc.mint(signer.address, 10_000_000_000n)).wait(); // 10,000 USDC
  }

  const deployment = {
    chainId,
    deployedAt: new Date().toISOString(),
    contracts: {
      picasoToken: await picaso.getAddress(),
      bancorNetwork: await bancor.getAddress(),
      contractRegistry: await registry.getAddress(),
    },
    tokens: [
      { symbol: "USDC", address: await usdc.getAddress(), decimals: 6 },
      { symbol: "SUSHI", address: await sushi.getAddress(), decimals: 18 },
    ],
  };

  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(outFile, `${JSON.stringify(deployment, null, 2)}\n`);

  console.log(JSON.stringify(deployment, null, 2));
  console.log(`\nWrote ${outFile}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
