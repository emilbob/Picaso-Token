import { ethers } from "hardhat";
async function main() {
  const factory = await ethers.getContractFactory("PicasoToken");
  let contract = await factory.deploy(
    "0xFD95E724962fCfC269010A0c6700Aa09D5de3074"
  );
  await contract.deployed();

  console.log(contract.address);
  console.log(contract.deployTransaction.hash);
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
