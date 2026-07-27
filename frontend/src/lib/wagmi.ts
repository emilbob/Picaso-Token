import { createConfig, http } from "wagmi";
import { hardhat, sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

/**
 * Injected connector only — no WalletConnect project id, so this runs with no
 * external account or API key. Chains are deliberately limited to the local
 * node and Sepolia: PicasoToken is unaudited and its real Bancor dependency is
 * mainnet-only, so there is nowhere responsible to point it at in production.
 */
export const config = createConfig({
  chains: [hardhat, sepolia],
  connectors: [injected()],
  transports: {
    [hardhat.id]: http("http://127.0.0.1:8545"),
    [sepolia.id]: http(),
  },
  ssr: false,
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
