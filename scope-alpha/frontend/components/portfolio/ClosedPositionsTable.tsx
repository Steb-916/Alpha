"use client";

import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import type { PortfolioRow } from "./ActivePositionsTable";

interface Props {
  positions: PortfolioRow[];
}

export function ClosedPositionsTable({ positions }: Props) {
  if (positions.length === 0) return null;

  return (
    <GlassCard noPadding>
      <div
        className="px-4 py-3 text-[10px] font-bold font-body uppercase tracking-wider"
        style={{
          color: "var(--text-tertiary)",
          borderBottom: "1px solid var(--glass-border)",
        }}
      >
        Closed Positions ({positions.length})
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--glass-border)" }}>
              <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Asset</th>
              <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Dir</th>
              <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Analyst</th>
              <th className="text-right px-3 py-2 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Entry</th>
              <th className="text-right px-3 py-2 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Close</th>
              <th className="text-right px-3 py-2 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>P&L</th>
              <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Closed</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => {
              const entry = p.personalEntry ?? p.signal.entryPrice;
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
                  <td className="px-3 py-2 text-right" style={{ color: "var(--text-secondary)" }}>
                    {p.closePrice != null ? `$${p.closePrice.toLocaleString()}` : "—"}
                  </td>
                  <td
                    className="px-3 py-2 text-right font-bold"
                    style={{
                      color:
                        p.personalPnl == null
                          ? "var(--text-muted)"
                          : p.personalPnl >= 0
                            ? "#10B981"
                            : "#EF4444",
                    }}
                  >
                    {p.personalPnl != null
                      ? `${p.personalPnl >= 0 ? "+" : ""}${p.personalPnl.toFixed(2)}%`
                      : "—"}
                  </td>
                  <td className="px-3 py-2" style={{ color: "var(--text-muted)" }}>
                    {p.closedAt ? new Date(p.closedAt).toLocaleDateString() : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}
