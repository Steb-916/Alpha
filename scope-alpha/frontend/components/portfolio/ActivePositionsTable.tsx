"use client";

/**
 * Active positions table.
 *
 * Computes unrealized P&L per row from live tickers (read once via the
 * bulk `useLiveTickers()` selector — cheap even with many rows). Falls
 * back to "—" when the ticker isn't loaded yet.
 */

import { useState } from "react";
import Link from "next/link";
import { useLiveTickers } from "@/hooks/useLiveTerminalData";
import { toBinanceSymbol } from "@/lib/exchanges/utils";
import { GlassCard } from "@/components/ui/GlassCard";
import { ClosePositionModal } from "./ClosePositionModal";
import type { SerializedSignal } from "@/lib/signals/serializer";

export interface PortfolioRow {
  id: string;
  signalId: string;
  analystId: string;
  takenAt: string;
  closedAt: string | null;
  personalEntry: number | null;
  personalStop: number | null;
  positionSize: number | null;
  status: string;
  notes: string | null;
  closePrice: number | null;
  personalPnl: number | null;
  signal: SerializedSignal;
  analyst: {
    slug: string;
    displayName: string;
    avatarInitial: string;
  };
}

interface Props {
  positions: PortfolioRow[];
  /** Called when a position closes so the parent can refetch + update unrealized total. */
  onClosed: () => void;
  /** Called every render with the computed unrealized P&L per active position so the
      parent summary can show a "+X% unrealized" total. Map of position id → pct. */
  onUnrealizedComputed?: (map: Record<string, number>) => void;
}

function computeUnrealized(
  direction: string,
  entry: number,
  currentPrice: number,
): number {
  const sign = direction === "long" ? 1 : -1;
  return ((currentPrice - entry) / entry) * 100 * sign;
}

export function ActivePositionsTable({ positions, onClosed, onUnrealizedComputed }: Props) {
  const tickers = useLiveTickers();
  const [closingId, setClosingId] = useState<string | null>(null);

  // Compute the unrealized map once per render and notify parent.
  const unrealizedMap: Record<string, number> = {};
  for (const p of positions) {
    const sym = toBinanceSymbol(p.signal.assetSymbol);
    const ticker = tickers[sym];
    if (ticker) {
      const entry = p.personalEntry ?? p.signal.entryPrice;
      unrealizedMap[p.id] = computeUnrealized(p.signal.direction, entry, ticker.lastPrice);
    }
  }

  // Fire the callback as a side effect (not during render — defer).
  if (onUnrealizedComputed) {
    // useEffect would also work, but the parent only needs the latest snapshot.
    // Defer the call so we don't violate setState-during-render rules.
    queueMicrotask(() => onUnrealizedComputed(unrealizedMap));
  }

  const closingPosition = positions.find((p) => p.id === closingId) ?? null;

  if (positions.length === 0) {
    return (
      <GlassCard>
        <div
          className="text-[10px] font-bold font-body uppercase tracking-wider mb-2"
          style={{ color: "var(--text-tertiary)" }}
        >
          Active Positions
        </div>
        <div
          className="text-xs font-body py-4 text-center"
          style={{ color: "var(--text-muted)" }}
        >
          No active positions yet. Subscribe to an analyst and click &quot;Take Signal&quot; on any active signal to start tracking.
        </div>
      </GlassCard>
    );
  }

  return (
    <>
      <GlassCard noPadding>
        <div
          className="px-4 py-3 text-[10px] font-bold font-body uppercase tracking-wider"
          style={{
            color: "var(--text-tertiary)",
            borderBottom: "1px solid var(--glass-border)",
          }}
        >
          Active Positions ({positions.length})
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--glass-border)" }}>
                <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Asset</th>
                <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Dir</th>
                <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Analyst</th>
                <th className="text-right px-3 py-2 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Entry</th>
                <th className="text-right px-3 py-2 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Current</th>
                <th className="text-right px-3 py-2 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Unrealized</th>
                <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Taken</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => {
                const sym = toBinanceSymbol(p.signal.assetSymbol);
                const ticker = tickers[sym];
                const currentPrice = ticker?.lastPrice ?? null;
                const entry = p.personalEntry ?? p.signal.entryPrice;
                const unrealized = unrealizedMap[p.id];
                const sigResolved = p.signal.status === "resolved";

                return (
                  <tr key={p.id} style={{ borderBottom: "1px solid var(--glass-border)" }}>
                    <td className="px-3 py-2 font-bold" style={{ color: "var(--text-primary)" }}>
                      {p.signal.assetSymbol}
                    </td>
                    <td
                      className="px-3 py-2 font-bold"
                      style={{ color: p.signal.direction === "long" ? "#10B981" : "#EF4444" }}
                    >
                      {p.signal.direction === "long" ? "▲" : "▼"}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/analyst/${p.analyst.slug}`}
                        className="no-underline"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {p.analyst.displayName}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right" style={{ color: "var(--text-secondary)" }}>
                      ${entry.toLocaleString()}
                    </td>
                    <td
                      className="px-3 py-2 text-right"
                      style={{ color: currentPrice == null ? "var(--text-muted)" : "var(--text-primary)" }}
                    >
                      {currentPrice != null ? `$${currentPrice.toLocaleString()}` : "—"}
                    </td>
                    <td
                      className="px-3 py-2 text-right font-bold"
                      style={{
                        color:
                          unrealized == null
                            ? "var(--text-muted)"
                            : unrealized >= 0
                              ? "#10B981"
                              : "#EF4444",
                      }}
                    >
                      {unrealized != null
                        ? `${unrealized >= 0 ? "+" : ""}${unrealized.toFixed(2)}%`
                        : "—"}
                    </td>
                    <td className="px-3 py-2" style={{ color: "var(--text-muted)" }}>
                      {new Date(p.takenAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {sigResolved && (
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded mr-2"
                          style={{
                            background: "rgba(245, 158, 11, 0.15)",
                            color: "#F59E0B",
                            border: "1px solid rgba(245, 158, 11, 0.3)",
                          }}
                          title="Analyst has resolved this signal"
                        >
                          analyst closed
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setClosingId(p.id)}
                        className="text-[10px] font-body cursor-pointer"
                        style={{ color: "var(--accent-green)" }}
                      >
                        Close
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {closingPosition && (
        <ClosePositionModal
          position={{
            id: closingPosition.id,
            signal: {
              assetSymbol: closingPosition.signal.assetSymbol,
              direction: closingPosition.signal.direction,
              entryPrice: closingPosition.signal.entryPrice,
            },
            personalEntry: closingPosition.personalEntry,
          }}
          onClose={() => setClosingId(null)}
          onClosed={onClosed}
        />
      )}
    </>
  );
}
