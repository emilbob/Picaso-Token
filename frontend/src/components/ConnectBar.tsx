"use client";

import { useEffect, useState } from "react";
import { useAccount, useChainId, useConnect, useDisconnect } from "wagmi";
import { deployment } from "@/lib/deployment";

function shorten(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** Frosted header with telemetry: a live clock, the chain, and the account. */
export function ConnectBar() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const [clock, setClock] = useState<string>("--:--:--");

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("en-GB", { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const injectedConnector = connectors.find((c) => c.type === "injected") ?? connectors[0];
  const wrongChain = isConnected && deployment.chainId !== 0 && chainId !== deployment.chainId;

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-paper/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
        <div className="flex items-baseline gap-6">
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-ink">
            Picaso
          </span>
          <span className="label hidden sm:inline">PCT — Vol. 02</span>
        </div>

        <div className="flex items-center gap-6">
          <span className="label hidden md:inline" suppressHydrationWarning>
            {clock}
          </span>
          <span className="label hidden md:inline">Chain {chainId}</span>
          {isConnected && address ? (
            <button type="button" className="action" onClick={() => disconnect()}>
              {shorten(address)} — Disconnect
            </button>
          ) : (
            <button
              type="button"
              className="action"
              disabled={isPending || injectedConnector === undefined}
              onClick={() => injectedConnector && connect({ connector: injectedConnector })}
            >
              {isPending ? "Connecting…" : "Connect Wallet"}
            </button>
          )}
        </div>
      </div>

      {wrongChain ? (
        <div className="border-t border-line bg-bone px-6 py-2 text-center">
          <span className="label text-ink">
            Wrong network — switch your wallet to chain {deployment.chainId}
          </span>
        </div>
      ) : null}
    </header>
  );
}
