"use client";

import { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { useTokenUnlocks } from "@/hooks/useMacro";
import type { TokenUnlockEvent, UnlockCategory } from "@/types/macro";

const CATEGORY_COLORS: Record<UnlockCategory, string> = {
  investor:  "var(--data-blue)",
  team:      "var(--data-yellow)",
  ecosystem: "var(--accent-green)",
  vesting:   "#a78bfa",
  treasury:  "#f472b6",
};

function fmtUsd(v: number | null): string {
  if (v == null) return "—";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${v.toLocaleString()}`;
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr).getTime();
  const now = Date.now();
  return Math.max(0, Math.round((target - now) / 86400000));
}

type SortKey = "date" | "percentOfSupply" | "estimatedUsdValue";

const TIMELINE_W = 560;
const TIMELINE_H = 60;

export function TokenUnlockView() {
  const { data, isLoading, error } = useTokenUnlocks();
  const [sortKey, setSortKey] = useState<SortKey>("date");

  if (isLoading) {
    return (
      <GlassCard className="h-full">
        <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
          Loading token unlock calendar…
        </p>
      </GlassCard>
    );
  }

  if (error || !data || data.events.length === 0) {
    return (
      <GlassCard className="h-full">
        <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
          No upcoming unlock events found.
        </p>
      </GlassCard>
    );
  }

  const sorted = [...data.events].sort((a, b) => {
    if (sortKey === "date") return a.date.localeCompare(b.date);
    if (sortKey === "percentOfSupply") return b.percentOfSupply - a.percentOfSupply;
    if (sortKey === "estimatedUsdValue") return (b.estimatedUsdValue ?? 0) - (a.estimatedUsdValue ?? 0);
    return 0;
  });

  // Timeline
  const timelineEvents = [...data.events].sort((a, b) => a.date.localeCompare(b.date));
  const firstDate = new Date(timelineEvents[0]?.date ?? new Date()).getTime();
  const lastDate = new Date(timelineEvents[timelineEvents.length - 1]?.date ?? new Date()).getTime();
  const timeRange = lastDate - firstDate || 1;
  const maxPct = Math.max(...timelineEvents.map((e) => e.percentOfSupply), 1);

  return (
    <div className="flex flex-col gap-4 p-1 overflow-auto">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <GlassCard>
          <p className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>Next Unlock</p>
          {data.nextUnlock ? (
            <>
              <p className="text-lg font-mono font-bold" style={{ color: "var(--accent-green)" }}>
                {data.nextUnlock.token}
              </p>
              <p className="text-[10px] font-mono" style={{ color: "var(--text-secondary)" }}>
                {data.nextUnlock.date} · {daysUntil(data.nextUnlock.date)}d away
              </p>
            </>
          ) : (
            <p className="text-sm font-mono" style={{ color: "var(--text-muted)" }}>None</p>
          )}
        </GlassCard>
        <GlassCard>
          <p className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>Events Next 30d</p>
          <p className="text-2xl font-mono font-bold" style={{ color: "var(--text-primary)" }}>{data.upcomingCount}</p>
        </GlassCard>
        <GlassCard>
          <p className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>Total Value Next 30d</p>
          <p className="text-lg font-mono font-bold" style={{ color: "var(--text-primary)" }}>
            {fmtUsd(data.totalValueNext30d)}
          </p>
        </GlassCard>
      </div>

      {/* Timeline SVG */}
      <GlassCard>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-mono font-semibold" style={{ color: "var(--text-primary)" }}>
            Unlock Timeline
          </h3>
          <span
            className="text-[10px] font-mono px-2 py-0.5 rounded"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--glass-border)", color: "var(--text-muted)" }}
          >
            Seeded Data
          </span>
        </div>
        <div className="overflow-x-auto">
          <svg width={TIMELINE_W} height={TIMELINE_H + 20}>
            {/* Baseline */}
            <line x1={0} y1={TIMELINE_H} x2={TIMELINE_W} y2={TIMELINE_H} stroke="var(--glass-border)" strokeWidth={1} />
            {timelineEvents.map((e) => {
              const x = ((new Date(e.date).getTime() - firstDate) / timeRange) * TIMELINE_W;
              const h = (e.percentOfSupply / maxPct) * TIMELINE_H * 0.85;
              const color = CATEGORY_COLORS[e.category];
              return (
                <g key={e.id}>
                  <line x1={x} y1={TIMELINE_H - h} x2={x} y2={TIMELINE_H} stroke={color} strokeWidth={3} strokeLinecap="round" />
                  <circle cx={x} cy={TIMELINE_H - h} r={4} fill={color}>
                    <title>{`${e.token} · ${e.date} · ${e.percentOfSupply.toFixed(2)}% supply · ${fmtUsd(e.estimatedUsdValue)}`}</title>
                  </circle>
                  <text x={x} y={TIMELINE_H + 12} textAnchor="middle" fontSize={7} fontFamily="monospace" fill="var(--text-muted)">
                    {e.token}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        {/* Category legend */}
        <div className="flex flex-wrap gap-3 mt-2">
          {(Object.keys(CATEGORY_COLORS) as UnlockCategory[]).map((cat) => (
            <div key={cat} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ background: CATEGORY_COLORS[cat] }} />
              <span className="text-[10px] font-mono capitalize" style={{ color: "var(--text-muted)" }}>{cat}</span>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Table */}
      <GlassCard noPadding>
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--glass-border)" }}>
          <h3 className="text-sm font-mono font-semibold" style={{ color: "var(--text-primary)" }}>Upcoming Unlocks</h3>
          <div className="flex gap-1 text-[10px] font-mono">
            <span style={{ color: "var(--text-muted)" }}>Sort:</span>
            {(["date", "percentOfSupply", "estimatedUsdValue"] as SortKey[]).map((k) => (
              <button
                key={k}
                onClick={() => setSortKey(k)}
                className="px-2 py-0.5 rounded"
                style={{
                  background: sortKey === k ? "rgba(0,212,170,0.12)" : "transparent",
                  border: sortKey === k ? "1px solid var(--accent-green)" : "1px solid transparent",
                  color: sortKey === k ? "var(--accent-green)" : "var(--text-muted)",
                }}
              >
                {k === "date" ? "Date" : k === "percentOfSupply" ? "% Supply" : "USD Value"}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--glass-border)" }}>
                {["Token", "Date", "Days", "Amount", "% Supply", "USD Value", "Category", "Status"].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-[10px] uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((e: TokenUnlockEvent) => (
                <tr
                  key={e.id}
                  style={{ borderBottom: "1px solid var(--glass-border)" }}
                  className="hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-4 py-2 font-semibold" style={{ color: "var(--text-primary)" }}>{e.token}</td>
                  <td className="px-4 py-2" style={{ color: "var(--text-secondary)" }}>{e.date}</td>
                  <td className="px-4 py-2" style={{ color: "var(--text-muted)" }}>{daysUntil(e.date)}d</td>
                  <td className="px-4 py-2" style={{ color: "var(--text-secondary)" }}>
                    {e.amountNative >= 1e6 ? `${(e.amountNative / 1e6).toFixed(1)}M` : e.amountNative.toLocaleString()}
                  </td>
                  <td className="px-4 py-2" style={{ color: e.percentOfSupply >= 1 ? "var(--data-yellow)" : "var(--text-secondary)" }}>
                    {e.percentOfSupply.toFixed(3)}%
                  </td>
                  <td className="px-4 py-2" style={{ color: "var(--text-primary)" }}>{fmtUsd(e.estimatedUsdValue)}</td>
                  <td className="px-4 py-2">
                    <span
                      className="px-2 py-0.5 rounded-full text-[9px] uppercase font-semibold"
                      style={{
                        background: `${CATEGORY_COLORS[e.category]}18`,
                        color: CATEGORY_COLORS[e.category],
                        border: `1px solid ${CATEGORY_COLORS[e.category]}40`,
                      }}
                    >
                      {e.category}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span style={{ color: e.isConfirmed ? "var(--accent-green)" : "var(--text-muted)" }}>
                      {e.isConfirmed ? "✓" : "~"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
