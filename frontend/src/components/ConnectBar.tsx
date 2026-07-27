"use client";

import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { deployment } from "@/lib/deployment";
import { useMounted } from "@/lib/useMounted";
import { config } from "@/lib/wagmi";

function shorten(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** Frosted header with telemetry: a live clock, the chain, and the account. */
export function ConnectBar() {
  // useAccount().chainId is the connector's actual chain. useChainId() reports the
  // config's chain, which silently falls back to the first configured chain when the
  // wallet is on one we don't list — so it renders 31337 for a wallet on mainnet and
  // the wrongChain guard below can never fire for the chains it exists to catch.
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const [clock, setClock] = useState<string>("--:--:--");
  const mounted = useMounted();

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("en-GB", { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const injectedConnector = connectors.find((c) => c.type === "injected") ?? connectors[0];
  // Narrowed to a configured chain: switchChain only accepts those, and if the
  // deployment sits on a chain wagmi does not know, offering the button lies.
  const targetChain = config.chains.find((c) => c.id === deployment.chainId);
  const wrongChain =
    mounted && isConnected && deployment.chainId !== 0 && chainId !== deployment.chainId;

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
          <span className="label hidden md:inline">
            Chain {mounted ? (chainId ?? "—") : "—"}
          </span>
          {mounted && isConnected && address ? (
            <button type="button" className="action" onClick={() => disconnect()}>
              {shorten(address)} — Disconnect
            </button>
          ) : (
            <button
              type="button"
              className="action"
              disabled={!mounted || isPending || injectedConnector === undefined}
              onClick={() => injectedConnector && connect({ connector: injectedConnector })}
            >
              {isPending ? "Connecting…" : "Connect Wallet"}
            </button>
          )}
        </div>
      </div>

      {wrongChain ? (
        <div className="flex flex-wrap items-center justify-center gap-4 border-t border-line bg-bone px-6 py-2">
          <span className="label text-ink">
            Wrong network — this app runs on chain {deployment.chainId}
          </span>
          {targetChain ? (
            <button
              type="button"
              className="action"
              disabled={isSwitching}
              onClick={() => switchChain({ chainId: targetChain.id })}
            >
              {isSwitching ? "Switching…" : `Switch to ${targetChain.name}`}
            </button>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
