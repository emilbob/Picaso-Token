import { network } from "hardhat";

/**
 * Deploys PicasoToken against a Bancor contract registry.
 *
 * Pass the registry address for the target network via CONTRACT_REGISTRY. The
 * old hardcoded mainnet address is gone deliberately — deploying a demo
 * contract against live Bancor by default is not a sensible default.
 */
async function main() {
  const registryAddress = process.env.CONTRACT_REGISTRY;
  if (registryAddress === undefined || registryAddress === "") {
    throw new Error(
      "Set CONTRACT_REGISTRY to the Bancor IContractRegistry address for the target network.",
    );
  }

  const { ethers } = await network.getOrCreate();

  const picaso = await ethers.deployContract("PicasoToken", [registryAddress]);
  await picaso.waitForDeployment();

  console.log("PicasoToken deployed to:", await picaso.getAddress());
  console.log("deployment tx:", picaso.deploymentTransaction()?.hash);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
