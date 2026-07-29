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
test/PicasoToken.test.ts             24 hermetic tests, 100% line coverage of PicasoToken.sol
scripts/deploy.ts                    deployment (registry address via CONTRACT_REGISTRY)
scripts/deploy-demo.ts               deploys the whole mock world + writes addresses for the UI
scripts/export-abi.mjs               copies compiled ABIs into the frontend
frontend/                            Next.js dapp (npm workspace)
```

## Running it

```bash
npm ci
npm run build             # contracts -> ABI export -> frontend build
npm test                  # 24 tests, no network access, no credentials
npm run coverage          # hardhat test --coverage
npm run lint              # solhint
npm run check:deployment  # the committed deployment.json still aims at Sepolia
npm --workspace frontend run test:e2e   # browser smoke tests, needs `npm run build` first
```

Everything above works from a fresh clone with no configuration. The suite deploys its own
mock Bancor network and ERC20s, so there is no fork, no impersonated whale, and no
dependency on a live protocol or an archive node.

The last two guard the frontend, which the contract suite cannot reach. `check:deployment`
fails if the committed `deployment.json` stops pointing at Sepolia — `npm run deploy:local`
overwrites it, and committing that would aim the hosted app at `127.0.0.1`, where no visitor
can follow. The Playwright specs drive the exported bundle: the page renders, the unaudited
notice is present, the wallet prompts appear before a wallet exists, and the theme follows the
OS, toggles, and survives a reload. Both run on every pull request.

## The frontend

A Next.js 16 dapp (wagmi + viem, injected connector only — no WalletConnect project id, so
no account or API key is needed). It lists your positions, opens new ones, and liquidates
them.

**Live: [picaso-token.vercel.app](https://picaso-token.vercel.app)** — pointed at the Sepolia
demo deployment. `MockERC20.mint` has no access control, so anyone on Sepolia can mint
themselves collateral and try the full deposit → mint → redeem cycle against the mock Bancor.

To get that collateral, either use the **Write Contract** tab on the
[verified mock USDC](https://eth-sepolia.blockscout.com/address/0xa48d556009A3acb06ddF15Ae27Ff74BF74a15e88#code)
(all five contracts are verified on both explorers — see [Verification](#verification)), or mint
from the CLI with a funded account:

```bash
MINT_TO=0xYourWallet npx hardhat run scripts/mint-demo.ts --network sepolia
```

`MINT_SYMBOL` (default `USDC`) and `MINT_AMOUNT` (default `10000`, in whole tokens) override
what and how much. `deploy-demo.ts` only seeds the signers it has, which on a testnet is the
deployer alone — so any other wallet needs one of these two routes before it can deposit.

To run it locally instead, use three terminals:

```bash
npm run node          # 1. local chain on 127.0.0.1:8545
npm run deploy:local  # 2. mocks + PicasoToken; writes frontend/src/generated/deployment.json
npm run dev           # 3. the app on http://localhost:3000
```

Then point your wallet at `http://127.0.0.1:8545` (chain 31337) and import a Hardhat test
account. Without a deployment the app says so and prints these steps rather than failing.

Note that `deploy:local` **overwrites** the committed `deployment.json`, which points at
Sepolia. Don't commit that overwrite — it would aim the hosted app at a chain nobody else can
reach. `git checkout frontend/src/generated/deployment.json` puts it back.

Two things worth knowing:

- **Use `localhost`, not `127.0.0.1`, in the browser during development.** Next's dev server
  blocks cross-origin dev resources, and the two hostnames are different origins to it — hit
  `127.0.0.1` and the client bundle never loads, so the page renders but never hydrates.
  Irrelevant to the production build, which is a static export.
- The frontend imports its ABI from `frontend/src/generated/abi.ts`, regenerated by
  `npm run gen` (which the root build runs). It never keeps its own copy, so the UI cannot
  silently drift from the contract it calls.

### Why it only talks to a mock

Bancor's real `IContractRegistry` exists only on mainnet, and this contract is unaudited.
There is therefore nowhere responsible to point a production deployment, so the app is
limited to the local chain and Sepolia, both running the mock Bancor from
`scripts/deploy-demo.ts`. A "connect to mainnet" button would be a bug, not a feature.

### Hosting

The app is `output: "export"` — a pure client-side bundle with no server component — so any
static host serves it. The deployed copy points at **Sepolia**, so any visitor with a wallet on
that network can use it: the mocks mint permissionlessly, so they can fund themselves and run
the whole cycle. Nothing on it is worth anything, which is the point.

| Host | Setup | Notes |
|---|---|---|
| **Vercel** (recommended) | Import the repo, set **Root Directory** to `frontend`, build `npm run build` | Zero-config Next; per-PR preview deploys |
| **GitHub Pages** | Publish `frontend/out/` via Actions | Free, repo is already here; needs `basePath` if served from a subpath |
| **Netlify** | Base `frontend`, publish `frontend/out` | Equivalent to Vercel here |
| **Fleek / IPFS** | Pin `frontend/out/` | Idiomatic for dapps; real friction for a demo |

Because the root build compiles contracts before the Next build, a host building from the
repo root gets the ABI generated automatically. Building with Root Directory `frontend`
instead uses the committed `frontend/src/generated/abi.ts`.

The live deployment builds from git with **Root Directory `frontend`**: pushes to `main` go to
production, pull requests get preview URLs. That directory has no lockfile of its own — the
`package-lock.json` and the `workspaces` declaration both live at the repo root — so the
install has to reach above the root directory to resolve dependencies. A manual publish still
works if the integration is ever disconnected:

```bash
vercel deploy --prod --cwd frontend
```

`.env` is only needed to touch a live network — copy `.env.example` if you do. Hardhat 3
resolves those values lazily via `configVariable`, so an unset variable costs nothing until
you actually target that network.

## Verification

All five Sepolia contracts are verified on **both Blockscout and Etherscan**. Either explorer's
**Write Contract** tab will mint you collateral; Blockscout is the one to reach for first,
because it needs neither an account nor an API key:

```bash
npx hardhat verify blockscout --network sepolia <address> <constructor args>
npx hardhat verify etherscan  --network sepolia <address> <constructor args>
```

| Contract | Constructor args | Verified |
|---|---|---|
| PicasoToken | the registry address | [Blockscout](https://eth-sepolia.blockscout.com/address/0x2a29c88093fF634334765eF239a77B94e81C2D15#code) · [Etherscan](https://sepolia.etherscan.io/address/0x2a29c88093fF634334765eF239a77B94e81C2D15#code) |
| MockBancorNetwork | none | [Blockscout](https://eth-sepolia.blockscout.com/address/0xa3076c5f95C83EfdFD91b2Ea373D18D17a4F7064#code) · [Etherscan](https://sepolia.etherscan.io/address/0xa3076c5f95C83EfdFD91b2Ea373D18D17a4F7064#code) |
| MockContractRegistry | none | [Blockscout](https://eth-sepolia.blockscout.com/address/0xeBc9D26AA3B68b2D0C7D99580eD879bdC4D5d713#code) · [Etherscan](https://sepolia.etherscan.io/address/0xeBc9D26AA3B68b2D0C7D99580eD879bdC4D5d713#code) |
| MockERC20 (USDC, 6dp) | `"USD Coin" USDC 6` | [Blockscout](https://eth-sepolia.blockscout.com/address/0xa48d556009A3acb06ddF15Ae27Ff74BF74a15e88#code) · [Etherscan](https://sepolia.etherscan.io/address/0xa48d556009A3acb06ddF15Ae27Ff74BF74a15e88#code) |
| MockERC20 (SUSHI, 18dp) | `Sushi SUSHI 18` | [Blockscout](https://eth-sepolia.blockscout.com/address/0x1D020052b687BcdC4D7e27aD62766661D8833895#code) · [Etherscan](https://sepolia.etherscan.io/address/0x1D020052b687BcdC4D7e27aD62766661D8833895#code) |

Only the Etherscan path needs `ETHERSCAN_API_KEY`, which is why `hardhat.config.ts` reads it
lazily — Blockscout and `verify sourcify` are keyless and enabled by default. Running plain
`hardhat verify` tries every enabled provider, so it fails on the Etherscan leg when that key
is unset; name the provider explicitly to avoid this. Etherscan matches bytecode across
contracts, so verifying one `MockERC20` marked the second verified without a second submission.

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
in `hardhat.config.ts`. All four are burned — scrubbing the working tree does not scrub
history, so they remain readable in this repo forever.

**Resolved 2026-07-28.** Each was checked rather than assumed, and none turned out to be a
live compromise:

- [x] **Ropsten private key** — address `0x517df1898A17359e93Fb290423E098F0DE2DeD07`.
      **Verified unused**: zero balance, zero nonce, no funding transaction, and no activity
      on any chain Etherscan indexes. The key never signed anything outside dead Ropsten, so
      there was nothing to move. Retired regardless; do not reuse it.
- [x] **Infura API key** — no longer present in the account; deleted at some earlier point.
      Confirmed by comparing against the leaked value rather than assuming.
- [x] **Etherscan API key** — read-only and rate-limited, so no funds or write access were
      ever at risk. No Etherscan account exists to revoke it from; the key is orphaned.
- [x] **Archivenode API key** — service defunct, nothing to revoke.

A history rewrite was deliberately not done: force-pushing a public repo breaks every clone
and fork, and cannot un-leak values already scraped. Rotation is the remedy, not rewriting.

If you fork this repo, note that the burned values are still in history. They are dead, but
secret scanners will flag them.
