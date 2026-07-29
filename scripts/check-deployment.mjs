import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Guards the committed deployment.json against a local chain leaking into it.
 *
 * `npm run deploy:local` overwrites this file with localhost addresses, which is
 * correct while developing and catastrophic once committed: `main` deploys
 * itself, so the hosted app would quietly point every visitor at 127.0.0.1 and
 * reach nobody. The README asks you not to commit that; this makes forgetting a
 * red check instead of a dead site.
 *
 * Deliberately not part of `npm run build` — building against a local chain is
 * the whole point of the local flow. It is the *committed* state that must be
 * Sepolia, so this runs in CI and on demand.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const file = join(root, "frontend", "src", "generated", "deployment.json");
const SEPOLIA = 11155111;

const relative = "frontend/src/generated/deployment.json";
const fix = `Restore it with:  git checkout ${relative}`;

const problems = [];
const deployment = JSON.parse(await readFile(file, "utf8"));

if (deployment.chainId !== SEPOLIA) {
  problems.push(
    `chainId is ${deployment.chainId}, expected ${SEPOLIA} (Sepolia).` +
      (deployment.chainId === 31337 ? " This is a local Hardhat deployment." : ""),
  );
}

const addresses = [
  ...Object.entries(deployment.contracts ?? {}),
  ...(deployment.tokens ?? []).map((t) => [t.symbol, t.address]),
];

if (addresses.length === 0) {
  problems.push("no contract or token addresses recorded.");
}

for (const [name, address] of addresses) {
  if (typeof address !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    problems.push(`${name} has a malformed address: ${JSON.stringify(address)}`);
  } else if (/^0x0+$/.test(address)) {
    problems.push(`${name} is the zero address.`);
  }
}

if (problems.length > 0) {
  console.error(`${relative} would break the hosted app:\n`);
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error(`\n${fix}`);
  process.exit(1);
}

console.log(`${relative}: chain ${deployment.chainId}, ${addresses.length} addresses, all well-formed.`);
