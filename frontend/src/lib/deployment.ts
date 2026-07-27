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
 * Addresses written by `npm run deploy:local`. The checked-in file is a blank
 * placeholder so the frontend always builds on a fresh clone — the UI detects
 * the missing deployment and says so rather than failing.
 */
export const deployment: Deployment = {
  chainId: raw.chainId,
  deployedAt: raw.deployedAt,
  picasoToken: (raw.contracts.picasoToken as `0x${string}` | null) ?? null,
  bancorNetwork: (raw.contracts.bancorNetwork as `0x${string}` | null) ?? null,
  tokens: (raw.tokens as TokenInfo[]) ?? [],
};

export const isDeployed = deployment.picasoToken !== null;
