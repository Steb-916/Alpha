"use client";

import { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassPill } from "@/components/ui/GlassPill";
import { useOnChainOverview } from "@/hooks/useOnChain";

const MODE_ITEMS = [
  { label: "MVRV Z", value: "mvrv" },
  { label: "SOPR", value: "sopr" },
  { label: "NVT", value: "nvt" },
];

const DISCLAIMER =
  "This information is for educational and analytical purposes only. It is not financial advice, investment advice, or a recommendation to buy or sell any asset.";

interface Props { asset: string }

export function MVRVSOPRChart({ asset }: Props) {
  const [mode, setMode] = useState("mvrv");
  const { data, isLoading } = useOnChainOverview(asset);

  const info: Record<string, { value: number | null; label: string; explanation: string; thresholds: { lo: number; hi: number } }> = {
    mvrv: {
      value: data?.mvrvZScore ?? null,
      label: "MVRV Z-Score",
      explanation:
        "The MVRV Z-Score measures how far the market cap is above the realized cap in standard deviations. Values above +3 have historically marked cycle tops; values below 0 have marked generational buying opportunities.",
      thresholds: { lo: 0, hi: 3 },
    },
    sopr: {
      value: data?.sopr ?? null,
      label: "SOPR",
      explanation:
        "Spent Output Profit Ratio measures whether coins are being moved at a profit or loss. Above 1.0 = on average sellers are in profit; below 1.0 = selling at a loss. A cross above 1.0 after a dip can signal trend continuation.",
      thresholds: { lo: 0.98, hi: 1.02 },
    },
    nvt: {
      value: data?.nvtRatio ?? null,
      label: "NVT Ratio",
      explanation:
        "Network Value to Transactions compares market cap to on-chain transaction volume — analogous to a P/E ratio. Values above 65 suggest the network may be overvalued relative to on-chain activity.",
      thresholds: { lo: 27, hi: 65 },
    },
  };

  const current = info[mode];

  if (isLoading) {
    return <GlassCard><p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>Loading…</p></GlassCard>;
  }

  return (
    <div className="h-full flex flex-col gap-3 overflow-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold font-display" style={{ color: "var(--text-primary)" }}>
          On-Chain Valuation — {asset}
        </h2>
        <GlassPill items={MODE_ITEMS} activeValue={mode} onChange={setMode} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <GlassCard>
          <div className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
            {current.label}
          </div>
          <div
            className="text-3xl font-bold font-mono"
            style={{
              color:
                current.value === null
                  ? "var(--text-muted)"
                  : current.value > current.thresholds.hi
                  ? "var(--data-red)"
                  : current.value < current.thresholds.lo
                  ? "var(--accent-green)"
                  : "var(--data-yellow)",
            }}
          >
            {current.value !== null ? current.value.toFixed(mode === "nvt" ? 1 : 3) : "—"}
          </div>
        </GlassCard>

        <GlassCard>
          <div className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
            Thresholds
          </div>
          <div className="flex flex-col gap-1 text-xs font-mono">
            <div style={{ color: "var(--data-red)" }}>
              ▲ Above {current.thresholds.hi} = Overvalued
            </div>
            <div style={{ color: "var(--data-yellow)" }}>
              ◆ {current.thresholds.lo} – {current.thresholds.hi} = Fair Value
            </div>
            <div style={{ color: "var(--accent-green)" }}>
              ▼ Below {current.thresholds.lo} = Undervalued
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Gauge bar */}
      {current.value !== null && (
        <GlassCard>
          <div className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
            Historical Zone
          </div>
          <div className="relative h-4 rounded-full overflow-hidden" style={{ background: "var(--glass-border)" }}>
            {/* Green zone */}
            <div className="absolute inset-y-0 left-0 w-1/3" style={{ background: "rgba(0,212,170,0.3)" }} />
            {/* Yellow zone */}
            <div className="absolute inset-y-0 left-1/3 w-1/3" style={{ background: "rgba(245,158,11,0.3)" }} />
            {/* Red zone */}
            <div className="absolute inset-y-0 right-0 w-1/3" style={{ background: "rgba(239,68,68,0.3)" }} />
            {/* Indicator */}
            <div
              className="absolute inset-y-0 w-1 rounded-full"
              style={{
                background: "white",
                left: `${Math.min(98, Math.max(1, ((current.value - (current.thresholds.lo - current.thresholds.lo)) / (current.thresholds.hi * 1.5)) * 100))}%`,
                transition: "left 0.3s ease",
              }}
            />
          </div>
          <div className="flex justify-between text-[9px] font-mono mt-1" style={{ color: "var(--text-muted)" }}>
            <span style={{ color: "var(--accent-green)" }}>Undervalued</span>
            <span style={{ color: "var(--data-yellow)" }}>Fair</span>
            <span style={{ color: "var(--data-red)" }}>Overvalued</span>
          </div>
        </GlassCard>
      )}

      <GlassCard>
        <p className="text-sm font-body" style={{ color: "var(--text-secondary)" }}>{current.explanation}</p>
        <p className="text-[10px] font-mono mt-2" style={{ color: "var(--text-muted)" }}>{DISCLAIMER}</p>
      </GlassCard>
    </div>
  );
}
