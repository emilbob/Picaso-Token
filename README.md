# Picaso Token

> **Unaudited demonstration code. Do not deploy to mainnet.**
> Modernized and corrected in 2026 (see [`ROADMAP.md`](ROADMAP.md) M2). The reserve
> accounting and the Bancor integration have never been audited.

An ERC721 position backed by an ERC20 deposit:

- **`createNft(tokenAddress, tokenAmount)`** — pulls the ERC20 into the contract and mints a
  `PicasoToken` (PCT) recording the position. The amount stored is what *actually arrived*,
  so a fee-on-transfer token cannot mint a position claiming more collateral than exists.
- **`liquidateNft(tokenId, targetToken, minReturn)`** — the position's **owner** burns it and
  the deposit is swapped through Bancor for `targetToken`, with the proceeds sent **to the
  caller**. `minReturn` is the caller's slippage floor and is passed straight to Bancor.
- **`getTokenAddressForToken` / `getTokenAmountForToken` / `exists`** — read a position.

```
contracts/PicasoToken.sol            the ERC721 + deposit/redeem logic
contracts/interfaces/IBancor.sol     minimal IContractRegistry / IBancorNetwork
contracts/mocks/                     test doubles: ERC20, fee-on-transfer ERC20, Bancor, registry
test/PicasoToken.test.ts             23 hermetic tests, 100% line coverage of PicasoToken.sol
scripts/deploy.ts                    deployment (registry address via CONTRACT_REGISTRY)
```

## Running it

```bash
npm ci
npm run build      # hardhat clean && hardhat compile
npm test           # 23 tests, no network access, no credentials
npm run coverage   # hardhat test --coverage
npm run lint       # solhint
```

Everything above works from a fresh clone with no configuration. The suite deploys its own
mock Bancor network and ERC20s, so there is no fork, no impersonated whale, and no
dependency on a live protocol or an archive node.

`.env` is only needed to touch a live network — copy `.env.example` if you do. Hardhat 3
resolves those values lazily via `configVariable`, so an unset variable costs nothing until
you actually target that network.

## Stack

| | Version |
|---|---|
| Solidity | 0.8.28, optimizer on (200 runs) |
| Hardhat | ^3.8 with `@nomicfoundation/hardhat-toolbox-mocha-ethers` |
| ethers | ^6.17 |
| OpenZeppelin Contracts | ^5.6 |
| TypeScript | ^5.6 (ESM) |
| Tests | mocha + chai, hermetic mocks |

## What was wrong before 2026

The original January 2023 version is preserved in git history. It had six defects worth
knowing about if you are reading this repository as an example of the pattern:

1. **`liquidateNft` had no ownership check** — any caller could burn any holder's NFT.
2. **Swap proceeds never reached the user.** `convertByPath` was called with
   `_beneficiary = address(0)`, which Bancor resolves to `msg.sender` — the contract itself.
   With no withdrawal function, redeemed tokens were stranded permanently.
3. **The slippage floor was inert.** The caller's `_expectedAmount` was checked against the
   quote and then discarded; the quote was passed as `_minReturn`, so any movement between
   quote and execution reverted.
4. **`safeApprove` reverted on a second liquidation** of the same ERC20 (non-zero allowance).
5. **Positions were never cleared on burn.**
6. **No reentrancy guard**, no events, and `createNft` was `payable` while ignoring
   `msg.value`, so any ETH sent was trapped.

All six are fixed and each has a regression test. The contract now uses custom errors,
emits `NftCreated`/`NftLiquidated`, and burns-and-clears before the external swap call.

## Security note

`.env` was tracked from 2023 until 2026 because `.gitignore` said `env` rather than `.env`,
and was committed with a real Ropsten private key plus Infura, Etherscan and Archivenode API
keys (`511634d`, blanked but not removed in `d0405f0`). An Archivenode key was also hardcoded
in `hardhat.config.ts`. **All four are burned and should be treated as compromised** —
scrubbing the working tree does not scrub history. Rotation is the repository owner's action:

- [ ] Ropsten private key — if that address was ever funded or the key reused anywhere
      (including mainnet), move funds and stop using it.
- [ ] Infura API key — https://app.infura.io
- [ ] Etherscan API key — https://etherscan.io/myapikey
- [ ] Archivenode API key — service defunct; revoke if the account still exists.
