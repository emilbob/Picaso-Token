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
import { SectionHeader } from "./SectionHeader";

/**
 * Deposit flow. ERC20 approval is a separate transaction from the deposit, so
 * the UI shows which of the two steps you are on rather than pretending it is
 * one action and failing confusingly at the second.
 */
export function CreatePosition({ onDone }: { onDone: () => void }) {
  const { address, isConnected } = useAccount();
  const picaso = deployment.picasoToken;
  const [tokenIndex, setTokenIndex] = useState(0);
  const [amount, setAmount] = useState("");

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
  useEffect(() => {
    if (!isSuccess) return;
    onDone();
    reset();
    setAmount("");
  }, [isSuccess, onDone, reset]);

  const needsApproval =
    parsed !== null && typeof allowance === "bigint" && allowance < parsed;
  const insufficient =
    parsed !== null && typeof balance === "bigint" && balance < parsed;
  const busy = isPending || isMining;

  const approve = () => {
    if (!token || !picaso || parsed === null) return;
    writeContract({
      abi: erc20Abi,
      address: token.address,
      functionName: "approve",
      args: [picaso, parsed],
    });
  };

  const deposit = () => {
    if (!token || !picaso || parsed === null) return;
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
            disabled={!isConnected || busy}
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
          disabled={!isConnected || parsed === null || insufficient || busy || !needsApproval}
          onClick={approve}
        >
          {busy && needsApproval ? "Approving…" : "01 — Approve"}
        </button>
        <span aria-hidden className="h-px w-10 bg-line" />
        <button
          type="button"
          className="action"
          disabled={!isConnected || parsed === null || insufficient || busy || needsApproval}
          onClick={deposit}
        >
          {busy && !needsApproval ? "Depositing…" : "02 — Mint position"}
        </button>
      </div>

      {error ? (
        <p className="mt-6 max-w-xl font-mono text-xs leading-relaxed text-graphite">
          {error.message.split("\n")[0]}
        </p>
      ) : null}
    </section>
  );
}
