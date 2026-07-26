"use client";

import { useEffect, useMemo, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { picasoTokenAbi } from "@/generated/abi";
import { deployment, type TokenInfo } from "@/lib/deployment";
import { SectionHeader } from "./SectionHeader";

type Position = {
  tokenId: bigint;
  tokenAddress: `0x${string}`;
  tokenAmount: bigint;
};

function tokenFor(address: string): TokenInfo | undefined {
  return deployment.tokens.find((t) => t.address.toLowerCase() === address.toLowerCase());
}

function formatAmount(amount: bigint, address: string) {
  const token = tokenFor(address);
  if (token === undefined) return `${amount} (raw)`;
  return `${formatUnits(amount, token.decimals)} ${token.symbol}`;
}

/**
 * Lists the connected account's positions.
 *
 * PicasoToken does not implement ERC721Enumerable, so enumeration is: read
 * `totalMinted()` for the exclusive upper bound, then batch `ownerOf` across
 * that range and keep the hits. `ownerOf` is authoritative, so transferred
 * positions show up for the new holder without tracking Transfer events.
 */
export function PositionList({ refreshKey }: { refreshKey: number }) {
  const { address, isConnected } = useAccount();
  const picaso = deployment.picasoToken;

  const { data: totalMinted, refetch: refetchTotal } = useReadContract({
    abi: picasoTokenAbi,
    address: picaso ?? undefined,
    functionName: "totalMinted",
    query: { enabled: Boolean(picaso), refetchInterval: 5000 },
  });

  const ids = useMemo(() => {
    const total = typeof totalMinted === "bigint" ? Number(totalMinted) : 0;
    return Array.from({ length: total }, (_, i) => BigInt(i));
  }, [totalMinted]);

  const { data: owners, refetch: refetchOwners } = useReadContracts({
    contracts: ids.map((tokenId) => ({
      abi: picasoTokenAbi,
      address: picaso ?? undefined,
      functionName: "ownerOf" as const,
      args: [tokenId] as const,
    })),
    query: { enabled: Boolean(picaso) && ids.length > 0 },
  });

  const mine = useMemo(() => {
    if (!owners || !address) return [];
    return ids.filter((_, index) => {
      const result = owners[index];
      // Burned positions revert on ownerOf; a failed read simply is not ours.
      return (
        result?.status === "success" &&
        typeof result.result === "string" &&
        result.result.toLowerCase() === address.toLowerCase()
      );
    });
  }, [owners, ids, address]);

  const { data: details, refetch: refetchDetails } = useReadContracts({
    contracts: mine.flatMap((tokenId) => [
      {
        abi: picasoTokenAbi,
        address: picaso ?? undefined,
        functionName: "getTokenAddressForToken" as const,
        args: [tokenId] as const,
      },
      {
        abi: picasoTokenAbi,
        address: picaso ?? undefined,
        functionName: "getTokenAmountForToken" as const,
        args: [tokenId] as const,
      },
    ]),
    query: { enabled: mine.length > 0 },
  });

  const positions: Position[] = useMemo(() => {
    if (!details) return [];
    return mine
      .map((tokenId, index) => {
        const addressResult = details[index * 2];
        const amountResult = details[index * 2 + 1];
        if (addressResult?.status !== "success" || amountResult?.status !== "success") {
          return null;
        }
        return {
          tokenId,
          tokenAddress: addressResult.result as `0x${string}`,
          tokenAmount: amountResult.result as bigint,
        };
      })
      .filter((p): p is Position => p !== null);
  }, [details, mine]);

  useEffect(() => {
    void refetchTotal();
    void refetchOwners();
    void refetchDetails();
  }, [refreshKey, refetchTotal, refetchOwners, refetchDetails]);

  const refreshAll = () => {
    void refetchTotal();
    void refetchOwners();
    void refetchDetails();
  };

  return (
    <section className="reveal">
      <SectionHeader
        index="03"
        label="Your positions"
        meta={`${positions.length.toString().padStart(2, "0")} held`}
        title="Ledger."
      />

      {!isConnected ? (
        <p className="mt-10 max-w-md text-graphite">
          Connect a wallet to read your positions.
        </p>
      ) : positions.length === 0 ? (
        <div className="mt-10 border border-line bg-arch-grid px-8 py-20 text-center">
          <span className="label">Fig. 00 — No positions held</span>
        </div>
      ) : (
        <ul className="mt-10">
          {positions.map((position, index) => (
            <PositionRow
              key={position.tokenId.toString()}
              index={index + 1}
              position={position}
              onLiquidated={refreshAll}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function PositionRow({
  index,
  position,
  onLiquidated,
}: {
  index: number;
  position: Position;
  onLiquidated: () => void;
}) {
  const picaso = deployment.picasoToken;
  const others = deployment.tokens.filter(
    (t) => t.address.toLowerCase() !== position.tokenAddress.toLowerCase(),
  );
  const [targetIndex, setTargetIndex] = useState(0);
  const [minReturn, setMinReturn] = useState("0");
  const target = others[targetIndex];

  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isMining, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (!isSuccess) return;
    onLiquidated();
    reset();
  }, [isSuccess, onLiquidated, reset]);

  const parsedMin = (() => {
    if (target === undefined) return null;
    try {
      return parseUnits(minReturn.trim() === "" ? "0" : minReturn, target.decimals);
    } catch {
      return null;
    }
  })();

  const busy = isPending || isMining;

  const liquidate = () => {
    if (!picaso || !target || parsedMin === null) return;
    writeContract({
      abi: picasoTokenAbi,
      address: picaso,
      functionName: "liquidateNft",
      args: [position.tokenId, target.address, parsedMin],
    });
  };

  return (
    <li className="border-t border-line py-8 last:border-b">
      <div className="grid gap-8 md:grid-cols-[auto_1fr_auto] md:items-end">
        <div>
          <span className="label">Fig. {index.toString().padStart(2, "0")}</span>
          <p className="display mt-3 text-4xl">#{position.tokenId.toString()}</p>
        </div>

        <div>
          <span className="label">Collateral</span>
          <p className="mt-3 font-mono text-sm text-graphite">
            {formatAmount(position.tokenAmount, position.tokenAddress)}
          </p>
          <p className="mt-1 font-mono text-[10px] text-ash">{position.tokenAddress}</p>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div>
            <span className="label">Redeem for</span>
            <div className="mt-3 flex gap-2">
              {others.map((candidate, i) => (
                <button
                  key={candidate.address}
                  type="button"
                  className="action"
                  onClick={() => setTargetIndex(i)}
                  style={
                    i === targetIndex
                      ? { backgroundColor: "var(--color-ink)", color: "var(--color-paper)" }
                      : undefined
                  }
                >
                  {candidate.symbol}
                </button>
              ))}
            </div>
          </div>

          <div className="w-32">
            <label className="label" htmlFor={`min-${position.tokenId}`}>
              Min return
            </label>
            <input
              id={`min-${position.tokenId}`}
              className="field mt-3"
              inputMode="decimal"
              value={minReturn}
              onChange={(event) => setMinReturn(event.target.value)}
              disabled={busy}
            />
          </div>

          <button
            type="button"
            className="action"
            disabled={busy || target === undefined || parsedMin === null}
            onClick={liquidate}
          >
            {busy ? "Liquidating…" : "Burn & redeem"}
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-4 max-w-2xl font-mono text-xs leading-relaxed text-graphite">
          {error.message.split("\n")[0]}
        </p>
      ) : null}
    </li>
  );
}
