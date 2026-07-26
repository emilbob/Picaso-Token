import { HardhatUserConfig } from "hardhat/types";

import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "@nomiclabs/hardhat-etherscan";
import "hardhat-docgen";

require("dotenv").config();

const {
  ARCHIVENODE_API_KEY,
  INFURA_API_KEY,
  ROPSTEN_PRIVATE_KEY,
  ETHERSCAN_API_KEY,
} = process.env;

// The fork tests need an archive node. Without a key we leave forking off so
// that `hardhat compile` still works on a fresh clone — see README.md.
const forking = ARCHIVENODE_API_KEY
  ? { url: `https://api.archivenode.io/${ARCHIVENODE_API_KEY}` }
  : undefined;

// Ropsten was shut down in late 2022; this entry is kept only to record what
// the project was originally deployed against. It is registered only when both
// credentials are present, since Hardhat rejects an empty accounts entry.
const ropsten =
  INFURA_API_KEY && ROPSTEN_PRIVATE_KEY
    ? {
        url: `https://ropsten.infura.io/v3/${INFURA_API_KEY}`,
        accounts: [ROPSTEN_PRIVATE_KEY],
      }
    : undefined;

const config: HardhatUserConfig = {
  solidity: {
    compilers: [{ version: "0.8.2", settings: {} }],
  },
  typechain: {
    outDir: "typechain",
    target: "ethers-v5",
  },
  networks: {
    hardhat: { forking },
    ...(ropsten ? { ropsten } : {}),
  },

  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },
};

export default config;
