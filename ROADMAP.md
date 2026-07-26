# Picaso Token — Roadmap

## Current state

Picaso Token is a single-contract demo (Jan 2023, Emil's oldest repo) implementing
a collateralized-NFT pattern: `createNft()` deposits an ERC20 into `contracts/PicasoToken.sol`
and mints an ERC721; `liquidateNft()` burns the NFT and swaps the deposited ERC20
through Bancor's `IBancorNetwork` (`Interfaces/IBancor.sol`) for a different ERC20,
bounded by a caller-supplied `_expectedAmount` floor.

**Toolchain is fully legacy and years stale:** Solidity 0.8.2, Hardhat ^2.6.6 with the
deprecated `@nomiclabs/hardhat-waffle` + `ethereum-waffle`, ethers v5, OpenZeppelin
^4.3.3, TypeScript ^4.3.2, typechain targeting ethers-v5 (`package.json`).

**Tests are mainnet-fork-dependent, not unit tests:** `test/1.PicasoToken.ts` impersonates
a hardcoded whale address, uses hardcoded mainnet USDT/SUSHI addresses, and asserts against
a hardcoded Bancor conversion rate captured at write time — brittle by construction, and it
only runs at all if the fork succeeds.

**Confirmed broken CI, evidence:** `keep-green` has run exactly once (run `29823404145`,
2026-07-21, triggered by a Dependabot PR) and **failed**
(https://github.com/emilbob/Picaso-Token/actions/runs/29823404145). The build/test step has
never gone green on this repo since the workflow was added.

**Confirmed live secret exposure — action needed, not just cleanup:**
1. `hardhat.config.ts:21` hardcodes the `hardhat.forking.url` as
   `https://api.archivenode.io/70qv2ve2ii2sxemysiks0670qv2vp6oh` — the path segment
   `70qv2ve2ii2sxemysiks0670qv2vp6oh` is a live Archivenode API key, committed in plaintext
   on `main` **today**, not just in history. Every CI run and every local `hardhat compile`/
   fork attempt sends this key to a third party.
2. `.env` is tracked in git (`git ls-files` confirms) because `.gitignore` lists `env`
   instead of `.env` (`.gitignore:6`) — the pattern never matched. Working tree values are
   now blank, but git history is not: commit `511634d` ("second commit", 2023-01-06) added
   `.env` with a **real Ropsten private key**, a real Infura API key, and a real Etherscan
   API key in plaintext; commit `d0405f0` ("final changes") blanked the values but did not
   remove them from history. This repo is public, so all three secrets (plus the Archivenode
   key above) have been exposed since 2023 and must be treated as compromised — see the note
   at the bottom of this file for what M1 does and does not cover.
3. `Interfaces/IBancor.sol` and `scripts/deploy.ts` are clean of secrets.

**Ropsten** (`hardhat.config.ts` `networks.ropsten`) has been a dead testnet since Infura/the
community deprecated it in late 2022; it cannot be used to validate anything today.

**Contract itself:** no reentrancy guard on `liquidateNft` (calls `safeApprove` +
`convertByPath` before `_burn`), and reserve accounting is unaudited per Emil's own notes.
Not a finding to fix here — relevant only to the verdict below.

## Verdict: **archive-properly**

This is a single-contract, unaudited teaching/portfolio demo, not a maintained product —
nothing currently depends on it working. Modernizing the toolchain (Hardhat 2.6→latest,
waffle→toolbox, ethers v5→v6, OZ 4.3→5.x, ropsten removal) would touch every file for a
demo whose core dependency, Bancor's on-chain network contract, has itself been through
major protocol changes since 2023 — so a modernized toolchain would still be exercising
against an interface that may no longer reflect how Bancor works today. The
fork-against-hardcoded-mainnet-whale test strategy would need a full rewrite (mocked Bancor,
or a maintained fork provider) to be trustworthy either way. That's a disproportionate
amount of new engineering to keep alive a demo that was never meant to be redeployed.

Given the repo's actual value is as Emil's earliest on-chain project and a clean example of
the deposit-NFT/bonding-curve-redemption pattern, the better outcome is to preserve it
honestly: fix what's actively dangerous (the live API key, the tracked `.env`, the
misconfigured `.gitignore`), document what it is and its 2023 context, and archive it rather
than sink further hours into chasing a moving toolchain and a moving upstream protocol for
a project no one intends to operate.

## Milestones

- [ ] M1: Archive prep — scrub config, write a real README, freeze the toolchain notes.
  Scope:
  - Fix `.gitignore` (`env` → `.env`) and remove `.env` from the tracked tree (keep
    `.env.example` as the placeholder template, values already blank).
  - Replace the hardcoded Archivenode URL in `hardhat.config.ts` with
    `process.env.ARCHIVENODE_API_KEY`-based construction (mirrors how `INFURA_API_KEY` and
    `ETHERSCAN_API_KEY` are already handled) so no live key sits in tracked source.
  - Replace `README.txt` with `README.md`: what the contract does, the 2023 stack it was
    built and tested against (Hardhat 2.6, ethers v5, OZ 4.3, Solidity 0.8.2), why it's
    frozen (unaudited reserve accounting, Bancor/Ropsten have moved on since), and a pointer
    to this ROADMAP.md for the full assessment.
  - Add a short "Frozen toolchain" note (in the README or a `NOTES.md`) pinning exact
    dependency versions at archive time, so a future reader knows this was never upgraded
    past this point deliberately, not by neglect.
  Acceptance: `.env` no longer in `git ls-files`; `.gitignore` matches `.env`;
  `hardhat.config.ts` contains no literal API keys or tokens; `README.md` exists and
  `README.txt` is removed; `npx hardhat compile` still succeeds locally (network-independent,
  since forking config now reads from env and is unset in this environment).
  After M1 merges: Emil archives the repository on GitHub (Settings → Archive this
  repository) — no further milestones follow.

## Not covered by M1 — needs Emil's direct action

Scrubbing the *current* tree does not remove secrets from *git history*, and this routine
will not force-push or rewrite history unilaterally. The Ropsten private key, Infura key,
Etherscan key (git history, commits `511634d`/`d0405f0`), and the Archivenode key (current
`main`, `hardhat.config.ts:21`) should all be treated as burned:
- Rotate/revoke the Infura key, Etherscan key, and Archivenode key at their respective
  dashboards.
- If the Ropsten private key's address was ever funded or if that key was reused anywhere
  else (including mainnet), treat it as compromised and move funds / stop using it.
- If a fully clean history is wanted (not required — Ropsten is dead and archiving freezes
  the repo), history rewrite (`git filter-repo`) plus a GitHub cache-purge request is a
  manual, human-supervised operation, not something to script here.
