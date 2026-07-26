import assert from "node:assert/strict";
import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.getOrCreate();

const BANCOR_NETWORK_NAME = ethers.encodeBytes32String("BancorNetwork");

const USDC_DECIMALS = 6;
const DEPOSIT = 20_000_000n; // 20 USDC
const TARGET_LIQUIDITY = ethers.parseEther("1000");

/**
 * Deploys a self-contained world: two ERC20s, a mock Bancor network pre-funded
 * with the target token, a registry pointing at it, and the PicasoToken under
 * test. No fork, no impersonation, no live protocol.
 */
async function deployFixture() {
  const [deployer, holder, stranger] = await ethers.getSigners();

  const source = await ethers.deployContract("MockERC20", ["USD Coin", "USDC", USDC_DECIMALS]);
  const target = await ethers.deployContract("MockERC20", ["Sushi", "SUSHI", 18]);

  const bancor = await ethers.deployContract("MockBancorNetwork");
  await target.mint(await bancor.getAddress(), TARGET_LIQUIDITY);

  const registry = await ethers.deployContract("MockContractRegistry");
  await registry.setAddress(BANCOR_NETWORK_NAME, await bancor.getAddress());

  const picaso = await ethers.deployContract("PicasoToken", [await registry.getAddress()]);

  await source.mint(holder.address, DEPOSIT * 10n);
  await source.connect(holder).approve(await picaso.getAddress(), DEPOSIT * 10n);

  return { deployer, holder, stranger, source, target, bancor, registry, picaso };
}

/**
 * Runs `action` and returns each account's balance delta for `token`.
 *
 * Used in place of the `changeTokenBalance` chai matchers, which reject an
 * ethers v6 contract instance ("must be the contract instance of the token") —
 * their `"interface" in token` check does not see through the contract proxy.
 */
async function balanceDeltas(
  token: { balanceOf: (account: string) => Promise<bigint> },
  accounts: string[],
  action: () => Promise<{ wait: () => Promise<unknown> }>,
): Promise<bigint[]> {
  const before = await Promise.all(accounts.map((account) => token.balanceOf(account)));
  await (await action()).wait();
  const after = await Promise.all(accounts.map((account) => token.balanceOf(account)));
  return after.map((balance, index) => balance - before[index]);
}

/** Mints one position for `holder` and returns its token id. */
async function createPosition(
  ctx: Awaited<ReturnType<typeof deployFixture>>,
  amount = DEPOSIT,
): Promise<bigint> {
  const tx = await ctx.picaso.connect(ctx.holder).createNft(await ctx.source.getAddress(), amount);
  const receipt = await tx.wait();
  assert.ok(receipt, "transaction was not mined");

  const created = receipt.logs
    .map((log) => {
      try {
        return ctx.picaso.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((parsed) => parsed?.name === "NftCreated");

  assert.ok(created, "NftCreated was not emitted");
  return created.args.tokenId as bigint;
}

describe("PicasoToken", () => {
  describe("deployment", () => {
    it("exposes its name and symbol", async () => {
      const { picaso } = await deployFixture();
      expect(await picaso.name()).to.equal("Picaso Token");
      expect(await picaso.symbol()).to.equal("PCT");
    });

    it("rejects a zero registry address", async () => {
      const factory = await ethers.getContractFactory("PicasoToken");
      await expect(factory.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(
        factory,
        "ZeroAddress",
      );
    });

    it("resolves the Bancor network through the registry", async () => {
      const { picaso, bancor } = await deployFixture();
      expect(await picaso.getBancorNetworkContract()).to.equal(await bancor.getAddress());
    });
  });

  describe("createNft", () => {
    it("escrows the deposit and mints a position to the depositor", async () => {
      const ctx = await deployFixture();
      const { picaso, source, holder } = ctx;

      const deltas = await balanceDeltas(
        source,
        [holder.address, await picaso.getAddress()],
        () => picaso.connect(holder).createNft(source.getAddress(), DEPOSIT),
      );
      expect(deltas).to.deep.equal([-DEPOSIT, DEPOSIT]);

      expect(await picaso.balanceOf(holder.address)).to.equal(1n);
      expect(await picaso.ownerOf(0n)).to.equal(holder.address);
      expect(await picaso.exists(0n)).to.equal(true);
      expect(await picaso.getTokenAmountForToken(0n)).to.equal(DEPOSIT);
      expect(await picaso.getTokenAddressForToken(0n)).to.equal(await source.getAddress());
    });

    it("emits NftCreated", async () => {
      const { picaso, source, holder } = await deployFixture();
      await expect(picaso.connect(holder).createNft(await source.getAddress(), DEPOSIT))
        .to.emit(picaso, "NftCreated")
        .withArgs(0n, holder.address, await source.getAddress(), DEPOSIT);
    });

    it("issues sequential ids for successive positions", async () => {
      const ctx = await deployFixture();
      expect(await createPosition(ctx)).to.equal(0n);
      expect(await createPosition(ctx)).to.equal(1n);
      expect(await ctx.picaso.balanceOf(ctx.holder.address)).to.equal(2n);
    });

    it("reverts without an allowance", async () => {
      const { picaso, source, stranger } = await deployFixture();
      await source.mint(stranger.address, DEPOSIT);
      await expect(
        picaso.connect(stranger).createNft(await source.getAddress(), DEPOSIT),
      ).to.be.revertedWithCustomError(source, "ERC20InsufficientAllowance");
    });

    it("reverts when the balance is short", async () => {
      const { picaso, source, holder } = await deployFixture();
      const tooMuch = (await source.balanceOf(holder.address)) + 1n;
      await source.connect(holder).approve(await picaso.getAddress(), tooMuch);
      await expect(
        picaso.connect(holder).createNft(await source.getAddress(), tooMuch),
      ).to.be.revertedWithCustomError(source, "ERC20InsufficientBalance");
    });

    it("rejects a zero amount and a zero token address", async () => {
      const { picaso, source, holder } = await deployFixture();
      await expect(
        picaso.connect(holder).createNft(await source.getAddress(), 0n),
      ).to.be.revertedWithCustomError(picaso, "ZeroAmount");
      await expect(
        picaso.connect(holder).createNft(ethers.ZeroAddress, DEPOSIT),
      ).to.be.revertedWithCustomError(picaso, "ZeroAddress");
    });

    it("records only what actually arrived for a fee-on-transfer token", async () => {
      const { picaso, holder } = await deployFixture();
      const fee = await ethers.deployContract("MockFeeOnTransferERC20", [1000n]); // 10%
      await fee.mint(holder.address, DEPOSIT);
      await fee.connect(holder).approve(await picaso.getAddress(), DEPOSIT);

      await picaso.connect(holder).createNft(await fee.getAddress(), DEPOSIT);

      // 10% burned in transit — the position must not claim the full deposit.
      expect(await picaso.getTokenAmountForToken(0n)).to.equal((DEPOSIT * 9n) / 10n);
      expect(await fee.balanceOf(await picaso.getAddress())).to.equal((DEPOSIT * 9n) / 10n);
    });

    it("rejects a deposit where nothing survives the transfer", async () => {
      const { picaso, holder } = await deployFixture();
      const fee = await ethers.deployContract("MockFeeOnTransferERC20", [10_000n]); // 100%
      await fee.mint(holder.address, DEPOSIT);
      await fee.connect(holder).approve(await picaso.getAddress(), DEPOSIT);

      // A position collateralised by nothing must not be mintable.
      await expect(
        picaso.connect(holder).createNft(await fee.getAddress(), DEPOSIT),
      ).to.be.revertedWithCustomError(picaso, "ZeroAmount");
    });
  });

  describe("liquidateNft", () => {
    it("sends the swap proceeds to the holder, not the contract", async () => {
      const ctx = await deployFixture();
      const { picaso, target, holder } = ctx;
      const tokenId = await createPosition(ctx);

      // Mock rate is 1:1, so 20e6 source units convert to 20e6 target units.
      const deltas = await balanceDeltas(
        target,
        [holder.address, await picaso.getAddress()],
        () => picaso.connect(holder).liquidateNft(tokenId, target.getAddress(), DEPOSIT),
      );
      // The holder receives the proceeds; the contract keeps nothing.
      expect(deltas).to.deep.equal([DEPOSIT, 0n]);

      expect(await target.balanceOf(await picaso.getAddress())).to.equal(0n);
    });

    it("burns the position and clears its stored state", async () => {
      const ctx = await deployFixture();
      const { picaso, target, holder } = ctx;
      const tokenId = await createPosition(ctx);

      await picaso.connect(holder).liquidateNft(tokenId, await target.getAddress(), DEPOSIT);

      expect(await picaso.exists(tokenId)).to.equal(false);
      expect(await picaso.balanceOf(holder.address)).to.equal(0n);
      await expect(picaso.getTokenAmountForToken(tokenId)).to.be.revertedWithCustomError(
        picaso,
        "ERC721NonexistentToken",
      );
    });

    it("emits NftLiquidated with the amount returned", async () => {
      const ctx = await deployFixture();
      const { picaso, target, holder } = ctx;
      const tokenId = await createPosition(ctx);

      await expect(
        picaso.connect(holder).liquidateNft(tokenId, await target.getAddress(), DEPOSIT),
      )
        .to.emit(picaso, "NftLiquidated")
        .withArgs(tokenId, holder.address, await target.getAddress(), DEPOSIT);
    });

    it("refuses to let a non-owner liquidate someone else's position", async () => {
      const ctx = await deployFixture();
      const { picaso, target, holder, stranger } = ctx;
      const tokenId = await createPosition(ctx);

      await expect(
        picaso.connect(stranger).liquidateNft(tokenId, await target.getAddress(), DEPOSIT),
      )
        .to.be.revertedWithCustomError(picaso, "NotTokenOwner")
        .withArgs(tokenId, stranger.address);

      // The position survives the attempt intact.
      expect(await picaso.ownerOf(tokenId)).to.equal(holder.address);
      expect(await picaso.getTokenAmountForToken(tokenId)).to.equal(DEPOSIT);
    });

    it("honours the caller's slippage floor rather than the live quote", async () => {
      const ctx = await deployFixture();
      const { picaso, target, bancor, holder } = ctx;
      const tokenId = await createPosition(ctx);

      // Quote halves: 20e6 in now yields 10e6 out, below the caller's floor.
      await bancor.setRate(1n, 2n);

      await expect(
        picaso.connect(holder).liquidateNft(tokenId, await target.getAddress(), DEPOSIT),
      )
        .to.be.revertedWithCustomError(picaso, "InsufficientReturn")
        .withArgs(DEPOSIT / 2n, DEPOSIT);
    });

    it("accepts a floor below the quote and pays out the full quote", async () => {
      const ctx = await deployFixture();
      const { picaso, target, bancor, holder } = ctx;
      const tokenId = await createPosition(ctx);

      await bancor.setRate(2n, 1n); // quote doubles

      const deltas = await balanceDeltas(target, [holder.address], () =>
        picaso.connect(holder).liquidateNft(tokenId, target.getAddress(), DEPOSIT),
      );
      expect(deltas).to.deep.equal([DEPOSIT * 2n]);
    });

    it("reverts for a position that does not exist", async () => {
      const { picaso, target, holder } = await deployFixture();
      await expect(
        picaso.connect(holder).liquidateNft(999n, await target.getAddress(), DEPOSIT),
      ).to.be.revertedWithCustomError(picaso, "ERC721NonexistentToken");
    });

    it("reverts on a zero target token", async () => {
      const ctx = await deployFixture();
      const tokenId = await createPosition(ctx);
      await expect(
        ctx.picaso.connect(ctx.holder).liquidateNft(tokenId, ethers.ZeroAddress, DEPOSIT),
      ).to.be.revertedWithCustomError(ctx.picaso, "ZeroAddress");
    });

    it("leaves the position intact when the swap itself fails", async () => {
      const ctx = await deployFixture();
      const { picaso, target, bancor, holder } = ctx;
      const tokenId = await createPosition(ctx);

      await bancor.setFailNextConversion(true);

      await expect(
        picaso.connect(holder).liquidateNft(tokenId, await target.getAddress(), DEPOSIT),
      ).to.be.revertedWith("MockBancor: conversion failed");

      // The burn is rolled back with the rest of the transaction.
      expect(await picaso.exists(tokenId)).to.equal(true);
      expect(await picaso.ownerOf(tokenId)).to.equal(holder.address);
    });

    it("allows a second liquidation of the same ERC20", async () => {
      const ctx = await deployFixture();
      const { picaso, target, holder } = ctx;

      const first = await createPosition(ctx);
      const second = await createPosition(ctx);

      await picaso.connect(holder).liquidateNft(first, await target.getAddress(), DEPOSIT);

      // Under OZ 4.x's safeApprove this second call reverted on the leftover
      // non-zero allowance; forceApprove is what makes it work.
      const deltas = await balanceDeltas(target, [holder.address], () =>
        picaso.connect(holder).liquidateNft(second, target.getAddress(), DEPOSIT),
      );
      expect(deltas).to.deep.equal([DEPOSIT]);
    });

    it("lets a transferee liquidate, and the original owner no longer can", async () => {
      const ctx = await deployFixture();
      const { picaso, target, holder, stranger } = ctx;
      const tokenId = await createPosition(ctx);

      await picaso.connect(holder).transferFrom(holder.address, stranger.address, tokenId);

      await expect(
        picaso.connect(holder).liquidateNft(tokenId, await target.getAddress(), DEPOSIT),
      ).to.be.revertedWithCustomError(picaso, "NotTokenOwner");

      const deltas = await balanceDeltas(target, [stranger.address], () =>
        picaso.connect(stranger).liquidateNft(tokenId, target.getAddress(), DEPOSIT),
      );
      expect(deltas).to.deep.equal([DEPOSIT]);
    });
  });

  describe("views", () => {
    it("revert for a non-existent position", async () => {
      const { picaso } = await deployFixture();
      await expect(picaso.getTokenAddressForToken(1n)).to.be.revertedWithCustomError(
        picaso,
        "ERC721NonexistentToken",
      );
      await expect(picaso.getTokenAmountForToken(1n)).to.be.revertedWithCustomError(
        picaso,
        "ERC721NonexistentToken",
      );
      expect(await picaso.exists(1n)).to.equal(false);
    });
  });
});
