import { ethers } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { PicasoToken } from "../typechain/PicasoToken";
import { IERC20 } from "../typechain/IERC20";

chai.use(solidity);
const { expect } = chai;

const hre = require("hardhat");

describe("PicasoToken", () => {
  let signers: any;

  let picasoToken: PicasoToken;

  let mainNetAddress: string = "0x52ae12abe5d8bd778bd5397f99ca900624cfadd4";
  let usdtAddress: string = "0xdAC17F958D2ee523a2206206994597C13D831ec7";

  let erc20Interface = JSON.parse(
    require("fs").readFileSync(
      "./artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json"
    )
  )["abi"];

  beforeEach(async () => {
    signers = await ethers.getSigners();

    const picasoTokenFactory = await ethers.getContractFactory(
      "PicasoToken",
      signers[0]
    );

    picasoToken = (await picasoTokenFactory.deploy(
      mainNetAddress
    )) as PicasoToken;
    await picasoToken.deployed();

    expect(await picasoToken.address).to.properAddress;
    expect(await picasoToken.name()).to.be.eq("Picaso Token");
    expect(await picasoToken.symbol()).to.be.eq("PCT");
  });

  describe("Creating a NFT", () => {
    it("should create a NFT", async () => {
      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: ["0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503"],
      });

      const richUser = await ethers.getSigner(
        "0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503"
      );

      await signers[0].sendTransaction({
        to: richUser.address,
        value: ethers.constants.WeiPerEther.mul(10),
      });

      let USDT: IERC20 = new ethers.Contract(
        usdtAddress,
        erc20Interface,
        richUser
      ) as IERC20;

      await USDT.approve(picasoToken.address, 20 * 1000000);

      picasoToken = await picasoToken.connect(richUser);

      await expect(() =>
        picasoToken.createNft(usdtAddress, 20 * 1000000)
      ).to.changeTokenBalances(
        USDT,
        [richUser, picasoToken],
        [-20000000, 20000000]
      );

      expect(await picasoToken.exists(0)).to.be.true;

      expect(await picasoToken.balanceOf(richUser.address)).to.eq(1);

      expect(await picasoToken.getTokenAmountForToken(0)).to.eq(20000000);

      expect(await picasoToken.getTokenAddressForToken(0)).to.eq(usdtAddress);
    });

    it("should fail creating NFT with incuficient balance", async () => {
      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: ["0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503"],
      });

      const richUser = await ethers.getSigner(
        "0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503"
      );

      await signers[0].sendTransaction({
        to: richUser.address,
        value: ethers.constants.WeiPerEther.mul(10),
      });

      let USDT: IERC20 = new ethers.Contract(
        usdtAddress,
        erc20Interface,
        richUser
      ) as IERC20;

      await USDT.approve(picasoToken.address, 20 * 1000000);

      picasoToken = await picasoToken.connect(richUser);

      await expect(picasoToken.createNft(usdtAddress, 50 * 1000000)).to.be
        .reverted;
    });
    it("should fail creating NFT for  approval not givenn", async () => {
      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: ["0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503"],
      });

      const richUser = await ethers.getSigner(
        "0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503"
      );

      await signers[0].sendTransaction({
        to: richUser.address,
        value: ethers.constants.WeiPerEther.mul(10),
      });

      let USDT: IERC20 = new ethers.Contract(
        usdtAddress,
        erc20Interface,
        richUser
      ) as IERC20;

      picasoToken = await picasoToken.connect(richUser);

      await expect(picasoToken.createNft(usdtAddress, 50 * 1000000)).to.be
        .reverted;
    });
  });

  describe("Liquidating an NFT", async () => {
    it("should liquidate a NFT", async () => {
      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: ["0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503"],
      });

      const richUser = await ethers.getSigner(
        "0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503"
      );

      await signers[0].sendTransaction({
        to: richUser.address,
        value: ethers.constants.WeiPerEther.mul(10),
      });

      let USDT: IERC20 = new ethers.Contract(
        usdtAddress,
        erc20Interface,
        richUser
      ) as IERC20;

      let SUSHI: IERC20 = new ethers.Contract(
        "0x6b3595068778dd592e39a122f4f5a5cf09c90fe2",
        erc20Interface,
        richUser
      ) as IERC20;

      await USDT.approve(picasoToken.address, 20 * 1000000);

      picasoToken = await picasoToken.connect(richUser);

      await picasoToken.createNft(usdtAddress, 20 * 1000000);

      await expect(() =>
        picasoToken.liquidateNft(0, SUSHI.address, 3226865747798533)
      ).to.changeTokenBalance(USDT, picasoToken, -20000000);

      expect(await picasoToken.balanceOf(richUser.address)).to.eq(0);

      expect(await picasoToken.exists(0)).to.be.false;

      expect(await SUSHI.balanceOf(richUser.address)).to.be.gte(
        3226865747798533
      );
    });

    it("should fail liquidating a non existing NFT", async () => {
      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: ["0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503"],
      });

      const richUser = await ethers.getSigner(
        "0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503"
      );

      await signers[0].sendTransaction({
        to: richUser.address,
        value: ethers.constants.WeiPerEther.mul(10),
      });

      let USDT: IERC20 = new ethers.Contract(
        usdtAddress,
        erc20Interface,
        richUser
      ) as IERC20;

      let SUSHI: IERC20 = new ethers.Contract(
        "0x6b3595068778dd592e39a122f4f5a5cf09c90fe2",
        erc20Interface,
        richUser
      ) as IERC20;

      await USDT.approve(picasoToken.address, 20 * 1000000);

      picasoToken = await picasoToken.connect(richUser);

      await picasoToken.createNft(usdtAddress, 20 * 1000000);

      await expect(picasoToken.liquidateNft(1, SUSHI.address, 3226865747798533))
        .to.be.reverted;
    });
    it("should fail liquidating NFT on to high expectedReturns", async () => {
      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: ["0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503"],
      });

      const richUser = await ethers.getSigner(
        "0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503"
      );

      await signers[0].sendTransaction({
        to: richUser.address,
        value: ethers.constants.WeiPerEther.mul(10),
      });

      let USDT: IERC20 = new ethers.Contract(
        usdtAddress,
        erc20Interface,
        richUser
      ) as IERC20;

      let SUSHI: IERC20 = new ethers.Contract(
        "0x6b3595068778dd592e39a122f4f5a5cf09c90fe2",
        erc20Interface,
        richUser
      ) as IERC20;

      await USDT.approve(picasoToken.address, 20 * 1000000);

      picasoToken = await picasoToken.connect(richUser);

      await picasoToken.createNft(usdtAddress, 20 * 1000000);

      await expect(
        picasoToken.liquidateNft(0, SUSHI.address, 322686574779853399)
      ).to.be.reverted;
    });
  });
});
