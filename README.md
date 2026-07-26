# Picaso Token

> **Archived, January 2023. Unaudited. Do not deploy.**
> This repository is preserved as a portfolio artifact, not maintained as a product.
> See [`ROADMAP.md`](ROADMAP.md) for the full assessment behind that decision.

A single-contract Solidity demo of a **collateralized-NFT** pattern:

- `createNft(tokenAddress, tokenAmount)` — transfers an ERC20 into the contract and mints
  a `PicasoToken` (PCT) ERC721 recording the deposited token and amount.
- `liquidateNft(tokenId, tokenAddress, expectedAmount)` — swaps the deposited ERC20 for a
  different one through Bancor's `IBancorNetwork` and burns the NFT.
- `getTokenAddressForToken` / `getTokenAmountForToken` / `exists` — read the position
  behind a token id.

```
contracts/PicasoToken.sol   the ERC721 + deposit/redeem logic
Interfaces/IBancor.sol      minimal IContractRegistry / IBancorNetwork interface
scripts/deploy.ts           deployment script
test/1.PicasoToken.ts       mainnet-fork tests (see "Running it" below)
```

## Known defects

These are recorded rather than fixed — the contract is frozen and was never audited.
Anyone reading this for the pattern rather than the code should know:

1. **`liquidateNft` has no ownership check.** It requires only that the token id exists,
   so any caller can burn any holder's NFT and trigger their swap.
2. **Swap proceeds never reach the user.** `convertByPath` is called with
   `_beneficiary = address(0)`, which Bancor resolves to `msg.sender` — the PicasoToken
   contract itself. There is no transfer to the caller and no withdrawal function, so
   redeemed tokens are stranded in the contract.
3. **`_expectedAmount` is not an effective slippage floor.** It is checked against the
   freshly quoted rate, and that quote — not the user's figure — is then passed as
   `_minReturn`, so any movement between quote and execution reverts.
4. **`safeApprove` reverts on a non-zero allowance** (OpenZeppelin 4.x), so a second
   liquidation of the same ERC20 fails.
5. **Positions are not cleared on burn** — `positions[tokenId]` outlives the NFT.

Reserve accounting was never audited, and there is no reentrancy guard on `liquidateNft`.

## Frozen toolchain

Pinned deliberately at the versions this was built and last verified against in 2023.
It has **not** been upgraded past this point, and Dependabot npm version-updates are
switched off in [`.github/dependabot.yml`](.github/dependabot.yml) for that reason.

| | Version |
|---|---|
| Solidity | 0.8.2 |
| Hardhat | ^2.6.6 |
| Test stack | `@nomiclabs/hardhat-waffle` ^2.0.1 + `ethereum-waffle` ^3.4.0 (both deprecated in favour of `hardhat-toolbox`) |
| ethers | ^5.3.0 |
| TypeChain | ^5.0.0, target `ethers-v5` |
| OpenZeppelin Contracts | ^4.3.3 |
| TypeScript | ^4.3.2 |

Modernizing (toolbox, ethers v6, OZ 5.x) would touch every file, and the fork tests would
still be exercising a Bancor interface that has changed substantially since 2023 — which is
why it wasn't done.

## Running it

```bash
npm ci
npm run build     # hardhat clean && hardhat compile — works with no configuration
```

`npm test` runs the build and then the suite in `test/1.PicasoToken.ts`. **Those tests are
skipped unless `ARCHIVENODE_API_KEY` is set**, because they run against a mainnet fork:
they impersonate a hardcoded whale address and call the live USDT, SUSHI and Bancor
contracts. Two caveats if you set a key anyway:

- Archivenode, the fork provider this was written against, no longer operates. You would
  need to point `hardhat.forking.url` at a different archive node.
- The liquidation tests assert against a Bancor conversion rate hardcoded at the time of
  writing, so they are unlikely to pass against current chain state regardless.

`networks.ropsten` is retained only to record the original deployment target. Ropsten was
shut down in late 2022 and is registered only when both `INFURA_API_KEY` and
`ROPSTEN_PRIVATE_KEY` are present.

Copy `.env.example` to `.env` to supply any of these. `.env` is gitignored.

## Credential rotation checklist

This repository is public, and `.env` was committed with **real values** in
`511634d` (2023-01-06); `d0405f0` blanked them but did not remove them from history.
The Archivenode key was additionally hardcoded in `hardhat.config.ts` on `main` until this
commit. All four should be treated as compromised:

- [ ] **Ropsten private key** — if that address was ever funded, or the key reused anywhere
      else (including mainnet), move any funds and stop using it. This is the one that
      matters; the rest are rate-limit keys.
- [ ] **Infura API key** — revoke/regenerate at https://app.infura.io
- [ ] **Etherscan API key** — revoke/regenerate at https://etherscan.io/myapikey
- [ ] **Archivenode API key** — no longer operable, but revoke if the account still exists.

Scrubbing the working tree does not scrub git history. A clean history would require
`git filter-repo` plus a GitHub cache-purge request — a manual operation, not done here.
