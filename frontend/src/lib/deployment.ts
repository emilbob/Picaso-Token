import raw from "@/generated/deployment.json";

export type TokenInfo = {
  symbol: string;
  address: `0x${string}`;
  decimals: number;
};

export type Deployment = {
  chainId: number;
  deployedAt: string | null;
  picasoToken: `0x${string}` | null;
  bancorNetwork: `0x${string}` | null;
  tokens: TokenInfo[];
};

/**
 * Addresses written by `scripts/deploy-demo.ts`. The checked-in file points at
 * the **Sepolia** demo deployment, which is what the hosted build serves.
 *
 * `npm run deploy:local` overwrites it with local-chain addresses — useful for
 * development, but do not commit that: it would point the hosted app at a chain
 * nobody else can reach. `git checkout frontend/src/generated/deployment.json`
 * restores the Sepolia one.
 *
 * The shape still tolerates a blank file (`chainId: 0`, null addresses), and the
 * UI detects that and prints setup steps rather than failing.
 */
export const deployment: Deployment = {
  chainId: raw.chainId,
  deployedAt: raw.deployedAt,
  picasoToken: (raw.contracts.picasoToken as `0x${string}` | null) ?? null,
  bancorNetwork: (raw.contracts.bancorNetwork as `0x${string}` | null) ?? null,
  tokens: (raw.tokens as TokenInfo[]) ?? [],
};

export const isDeployed = deployment.picasoToken !== null;
