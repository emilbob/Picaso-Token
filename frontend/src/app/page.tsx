"use client";

import { useCallback, useState } from "react";
import { ConnectBar } from "@/components/ConnectBar";
import { CreatePosition } from "@/components/CreatePosition";
import { PositionList } from "@/components/PositionList";
import { SectionHeader } from "@/components/SectionHeader";
import { deployment, isDeployed } from "@/lib/deployment";

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);

  return (
    <>
      <ConnectBar />

      <main className="mx-auto max-w-6xl px-6">
        {/* Hero */}
        <section className="border-b border-line py-24 md:py-32">
          <div className="flex items-baseline justify-between gap-6">
            <span className="label">(01) Collateralised NFT positions</span>
            <span className="label hidden sm:inline">Picaso — ERC721 / ERC20</span>
          </div>

          <h1 className="display mt-10 -ml-[0.05em] text-[clamp(3rem,12vw,10rem)] text-ink">
            Deposit.
            <br />
            Mint.
            <br />
            Redeem.
          </h1>

          <div className="mt-12 grid gap-10 md:grid-cols-[1fr_auto] md:items-end">
            <p className="max-w-md text-lg leading-relaxed text-graphite">
              An ERC20 deposit is escrowed and a position NFT minted against it. Burning the
              position swaps the deposit through Bancor and returns the proceeds to the
              holder — never to the contract.
            </p>
            <dl className="grid grid-cols-2 gap-x-10 gap-y-4">
              <div>
                <dt className="label">Standard</dt>
                <dd className="mt-2 font-mono text-sm text-graphite">ERC-721</dd>
              </div>
              <div>
                <dt className="label">Solidity</dt>
                <dd className="mt-2 font-mono text-sm text-graphite">0.8.28</dd>
              </div>
              <div>
                <dt className="label">Coverage</dt>
                <dd className="mt-2 font-mono text-sm text-graphite">100.00%</dd>
              </div>
              <div>
                <dt className="label">Audit</dt>
                <dd className="mt-2 font-mono text-sm text-graphite">None</dd>
              </div>
            </dl>
          </div>
        </section>

        {/* The warning is part of the document, not a dismissible toast. */}
        <section className="border-b border-line py-10">
          <div className="border border-ink px-8 py-6">
            <span className="label text-ink">Notice — unaudited</span>
            <p className="mt-4 max-w-2xl leading-relaxed text-graphite">
              This contract has never been audited and its reserve accounting is
              unverified. It runs here against a <strong className="text-ink">mock</strong>{" "}
              Bancor network on a local chain. Bancor&rsquo;s real registry exists only on
              mainnet, and this is not code that belongs on mainnet.
            </p>
          </div>
        </section>

        {!isDeployed ? (
          <section className="py-24">
            <SectionHeader index="02" label="No deployment found" title="Run the chain." />
            <p className="mt-10 max-w-lg leading-relaxed text-graphite">
              The frontend reads its addresses from a deployment written by the demo script.
              Start a node and deploy the mock world:
            </p>
            <pre className="mt-8 overflow-x-auto border border-line bg-bone p-6 font-mono text-xs leading-relaxed text-ink">
              {`# terminal 1 — a local chain
npm run node

# terminal 2 — mocks + PicasoToken, writes the addresses
npm run deploy:local

# terminal 3 — this app
npm run dev`}
            </pre>
            <p className="mt-8 max-w-lg leading-relaxed text-graphite">
              Then import a Hardhat test account into your wallet and point it at
              <span className="font-mono text-sm text-ink"> http://127.0.0.1:8545</span>.
            </p>
          </section>
        ) : (
          <>
            <div className="py-24">
              <CreatePosition onDone={refresh} />
            </div>
            <div className="border-t border-line py-24">
              <PositionList refreshKey={refreshKey} />
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-10">
          <span className="label">Picaso Token — Demonstration only</span>
          <span className="label">
            {isDeployed ? `Chain ${deployment.chainId}` : "Not deployed"}
          </span>
        </div>
      </footer>
    </>
  );
}
