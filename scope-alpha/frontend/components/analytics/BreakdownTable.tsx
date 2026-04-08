"use client";

/**
 * Per-group breakdown table with bar visualization. Tabbed by groupBy
 * (asset / timeframe / direction). Fetches via SWR.
 */

import { useState } from "react";
import useSWR from "swr";
import type { BreakdownRow, GroupBy } from "@/lib/analytics/breakdown";
import { GlassCard } from "@/components/ui/GlassCard";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Props {
  slug: string;
}

const TABS: { key: GroupBy; label: string }[] = [
  { key: "asset", label: "By Asset" },
  { key: "timeframe", label: "By Timeframe" },
  { key: "direction", label: "By Direction" },
];

export function BreakdownTable({ slug }: Props) {
  const [groupBy, setGroupBy] = useState<GroupBy>("asset");
  const { data, error } = useSWR<{ rows: BreakdownRow[]; groupBy: GroupBy }>(
    `/api/analysts/${slug}/performance/breakdown?groupBy=${groupBy}`,
    fetcher,
  );

  const rows = data?.rows ?? [];
  const maxAbsPnl = Math.max(1, ...rows.map((r) => Math.abs(r.totalPnl)));

  return (
    <GlassCard noPadding>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--glass-border)" }}>
        <span className="text-[10px] font-bold font-body uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
          Performance Breakdown
        </span>
        <div className="flex items-center gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setGroupBy(tab.key)}
              className="px-2 py-1 text-[10px] font-body cursor-pointer rounded-[var(--radius-sm)]"
              style={{
                background: groupBy === tab.key ? "rgba(0,212,170,0.15)" : "transparent",
                color: groupBy === tab.key ? "var(--accent-green)" : "var(--text-muted)",
                border: `1px solid ${groupBy === tab.key ? "rgba(0,212,170,0.3)" : "transparent"}`,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 text-xs font-body" style={{ color: "var(--accent-red)" }}>
          Failed to load breakdown
        </div>
      )}

      {!error && rows.length === 0 && (
        <div className="p-4 text-xs font-body" style={{ color: "var(--text-muted)" }}>
          No resolved signals to break down yet
        </div>
      )}

      {rows.length > 0 && (
        <div className="overflow-auto" style={{ maxHeight: 320 }}>
          <table className="w-full text-xs font-mono">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--glass-border)" }}>
                <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  {groupBy}
                </th>
                <th className="text-right px-3 py-2 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  N
                </th>
                <th className="text-right px-3 py-2 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  Win %
                </th>
                <th className="text-right px-3 py-2 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  Avg
                </th>
                <th className="text-right px-3 py-2 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  Total
                </th>
                <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider w-32" style={{ color: "var(--text-muted)" }}>
                  Visual
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isPositive = r.totalPnl >= 0;
                const barWidth = Math.min((Math.abs(r.totalPnl) / maxAbsPnl) * 100, 100);
                return (
                  <tr key={r.group} style={{ borderBottom: "1px solid var(--glass-border)" }}>
                    <td className="px-3 py-1.5 font-bold" style={{ color: "var(--text-primary)" }}>
                      {r.group}
                    </td>
                    <td className="px-3 py-1.5 text-right" style={{ color: "var(--text-secondary)" }}>
                      {r.totalSignals}
                    </td>
                    <td
                      className="px-3 py-1.5 text-right"
                      style={{
                        color: r.winRate >= 50 ? "#10B981" : "#EF4444",
                      }}
                    >
                      {r.winRate.toFixed(1)}
                    </td>
                    <td
                      className="px-3 py-1.5 text-right"
                      style={{ color: r.avgPnl >= 0 ? "#10B981" : "#EF4444" }}
                    >
                      {r.avgPnl >= 0 ? "+" : ""}
                      {r.avgPnl.toFixed(2)}%
                    </td>
                    <td
                      className="px-3 py-1.5 text-right font-bold"
                      style={{ color: r.totalPnl >= 0 ? "#10B981" : "#EF4444" }}
                    >
                      {r.totalPnl >= 0 ? "+" : ""}
                      {r.totalPnl.toFixed(2)}%
                    </td>
                    <td className="px-3 py-1.5">
                      <div
                        className="h-2 rounded-[var(--radius-sm)]"
                        style={{
                          width: `${Math.max(barWidth, 4)}%`,
                          background: isPositive ? "#10B981" : "#EF4444",
                          opacity: 0.6,
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </GlassCard>
  );
}
