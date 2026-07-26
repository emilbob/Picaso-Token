import { configVariable, defineConfig } from "hardhat/config";
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";

export default defineConfig({
  plugins: [hardhatToolboxMochaEthers],

  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },

  networks: {
    // Default in-process chain the test suite runs against. The suite is
    // hermetic — it deploys its own mock Bancor and ERC20s — so no fork,
    // no archive node, and no credentials are involved.
    hardhat: {
      type: "edr-simulated",
      chainType: "l1",
    },

    // Optional live network. `configVariable` resolves lazily from the
    // environment or the Hardhat keystore, so an unset value costs nothing
    // until you actually target this network — unlike the Hardhat 2 config
    // this replaces, which failed to load at all when .env was blank.
    sepolia: {
      type: "http",
      chainType: "l1",
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
    },
  },

  verify: {
    etherscan: {
      apiKey: configVariable("ETHERSCAN_API_KEY"),
    },
  },
});
