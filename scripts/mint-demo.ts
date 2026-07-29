import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { network } from "hardhat";

/**
 * Tops up an address with the demo ERC20s recorded in deployment.json.
 *
 * `deploy-demo.ts` seeds the signers it happens to have, which on a local node
 * means the first five accounts but on a testnet means only the deployer — so a
 * wallet that did not do the deploying starts with nothing to spend. The mocks
 * mint permissionlessly, so any funded account can run this for any recipient.
 *
 *   MINT_TO=0xabc… npx hardhat run scripts/mint-demo.ts --network sepolia
 *
 * MINT_SYMBOL (default USDC) and MINT_AMOUNT (default 10000, in whole tokens)
 * override what and how much.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const deploymentFile = join(root, "frontend", "src", "generated", "deployment.json");

interface Deployment {
  chainId: number;
  tokens: Array<{ symbol: string; address: string; decimals: number }>;
}

async function main() {
  const to = process.env.MINT_TO;
  if (to === undefined || to === "") {
    throw new Error("Set MINT_TO to the recipient address.");
  }

  const symbol = process.env.MINT_SYMBOL ?? "USDC";
  const amount = process.env.MINT_AMOUNT ?? "10000";

  const deployment: Deployment = JSON.parse(await readFile(deploymentFile, "utf8"));

  const { ethers } = await network.getOrCreate();
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  if (chainId !== deployment.chainId) {
    throw new Error(
      `deployment.json records chain ${deployment.chainId} but the network is ${chainId}. ` +
        `Re-run deploy-demo.ts for this chain, or target the one it describes.`,
    );
  }

  const token = deployment.tokens.find((t) => t.symbol === symbol);
  if (token === undefined) {
    const known = deployment.tokens.map((t) => t.symbol).join(", ");
    throw new Error(`No token "${symbol}" in deployment.json — it records: ${known}.`);
  }

  const units = ethers.parseUnits(amount, token.decimals);
  const contract = await ethers.getContractAt("MockERC20", token.address);

  console.log(`Minting ${amount} ${symbol} to ${to} on chain ${chainId}…`);
  const tx = await contract.mint(to, units);
  await tx.wait();

  const balance = await contract.balanceOf(to);
  console.log(`Done in ${tx.hash}`);
  console.log(`${to} now holds ${ethers.formatUnits(balance, token.decimals)} ${symbol}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
