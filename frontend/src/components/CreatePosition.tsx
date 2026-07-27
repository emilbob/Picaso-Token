"use client";

import { useEffect, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { erc20Abi, picasoTokenAbi } from "@/generated/abi";
import { deployment } from "@/lib/deployment";
import { useMounted } from "@/lib/useMounted";
import { SectionHeader } from "./SectionHeader";

/**
 * Deposit flow. ERC20 approval is a separate transaction from the deposit, so
 * the UI shows which of the two steps you are on rather than pretending it is
 * one action and failing confusingly at the second.
 */
export function CreatePosition({ onDone }: { onDone: () => void }) {
  const { address, isConnected } = useAccount();
  // Wallet state is client-only; see useMounted. Everything below gates on
  // `ready` rather than isConnected so the first client render matches the
  // prerendered HTML.
  const ready = useMounted() && isConnected;
  const picaso = deployment.picasoToken;
  const [tokenIndex, setTokenIndex] = useState(0);
  const [amount, setAmount] = useState("");
  // Which of the two steps is in flight. approve and deposit share one
  // useWriteContract, so the receipt hook alone cannot tell them apart.
  const [pending, setPending] = useState<"approve" | "deposit" | null>(null);

  const token = deployment.tokens[tokenIndex];
  const parsed = (() => {
    if (amount.trim() === "" || token === undefined) return null;
    try {
      const value = parseUnits(amount, token.decimals);
      return value > 0n ? value : null;
    } catch {
      return null;
    }
  })();

  const { data: balance } = useReadContract({
    abi: erc20Abi,
    address: token?.address,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(token && address), refetchInterval: 4000 },
  });

  const { data: allowance } = useReadContract({
    abi: erc20Abi,
    address: token?.address,
    functionName: "allowance",
    args: address && picaso ? [address, picaso] : undefined,
    query: { enabled: Boolean(token && address && picaso), refetchInterval: 4000 },
  });

  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isMining, isSuccess } = useWaitForTransactionReceipt({ hash });

  // A mined deposit clears the form and refreshes the ledger. This has to be an
  // effect, not a render-time branch — calling onDone()/reset() during render
  // updates state mid-render and React throws.
  //
  // Only a deposit clears the amount. A mined approval must keep it: it is the
  // input the deposit step is about to consume, and wiping it strands the user
  // on an empty form with both buttons disabled and nothing saying why.
  useEffect(() => {
    if (!isSuccess) return;
    if (pending === "deposit") {
      onDone();
      setAmount("");
    }
    reset();
    setPending(null);
  }, [isSuccess, onDone, reset, pending]);

  const needsApproval =
    parsed !== null && typeof allowance === "bigint" && allowance < parsed;
  const insufficient =
    parsed !== null && typeof balance === "bigint" && balance < parsed;
  const busy = isPending || isMining;

  // One line that always answers "what do I do next". Every disabled button
  // below has a reason here; a dead control with no explanation reads as a
  // broken app. Ordered most-blocking first.
  const guidance = (() => {
    if (!ready) return "Connect a wallet to open a position.";
    if (!token || !picaso) return "No deployment found. Run `npm run deploy:local` first.";
    if (isPending) {
      return pending === "approve"
        ? "Confirm the approval in your wallet."
        : "Confirm the deposit in your wallet.";
    }
    if (isMining) return "Waiting for the transaction to be mined…";
    if (typeof balance === "bigint" && balance === 0n) {
      return `No ${token.symbol} on this chain — fund this address to continue.`;
    }
    if (parsed === null) return `Enter an amount of ${token.symbol} to deposit.`;
    if (insufficient && typeof balance === "bigint") {
      return `Reduce the amount to at most ${formatUnits(balance, token.decimals)} ${token.symbol}.`;
    }
    if (needsApproval) {
      return `Step 1 of 2 — approve ${amount} ${token.symbol} for the contract.`;
    }
    return `Approved. Step 2 of 2 — mint a position against ${amount} ${token.symbol}.`;
  })();

  const approve = () => {
    if (!token || !picaso || parsed === null) return;
    setPending("approve");
    writeContract({
      abi: erc20Abi,
      address: token.address,
      functionName: "approve",
      args: [picaso, parsed],
    });
  };

  const deposit = () => {
    if (!token || !picaso || parsed === null) return;
    setPending("deposit");
    writeContract({
      abi: picasoTokenAbi,
      address: picaso,
      functionName: "createNft",
      args: [token.address, parsed],
    });
  };

  return (
    <section className="reveal">
      <SectionHeader
        index="02"
        label="Open a position"
        meta={
          token && typeof balance === "bigint"
            ? `Balance — ${formatUnits(balance, token.decimals)} ${token.symbol}`
            : undefined
        }
        title="Deposit."
      />

      <div className="mt-10 grid gap-10 md:grid-cols-2">
        <div>
          <span className="label">01 — Collateral</span>
          <div className="mt-4 flex flex-wrap gap-3">
            {deployment.tokens.map((candidate, index) => (
              <button
                key={candidate.address}
                type="button"
                onClick={() => setTokenIndex(index)}
                className="action"
                style={
                  index === tokenIndex
                    ? { backgroundColor: "var(--color-ink)", color: "var(--color-paper)" }
                    : undefined
                }
              >
                {candidate.symbol}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="deposit-amount">
            02 — Amount
          </label>
          <input
            id="deposit-amount"
            className="field mt-4"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            disabled={!ready || busy}
          />
          {insufficient ? (
            <p className="label mt-3 text-ink">Exceeds balance</p>
          ) : null}
        </div>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-4">
        <button
          type="button"
          className="action"
          disabled={!ready || parsed === null || insufficient || busy || !needsApproval}
          onClick={approve}
        >
          {busy && pending === "approve" ? "Approving…" : "01 — Approve"}
        </button>
        <span aria-hidden className="h-px w-10 bg-line" />
        <button
          type="button"
          className="action"
          disabled={!ready || parsed === null || insufficient || busy || needsApproval}
          onClick={deposit}
        >
          {busy && pending === "deposit" ? "Depositing…" : "02 — Mint position"}
        </button>
      </div>

      <p className="mt-4 font-mono text-xs text-graphite">{guidance}</p>

      {error ? (
        <p className="mt-6 max-w-xl font-mono text-xs leading-relaxed text-graphite">
          {error.message.split("\n")[0]}
        </p>
      ) : null}
    </section>
  );
}
