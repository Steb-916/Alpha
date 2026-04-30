"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { useOnChainOverview } from "@/hooks/useOnChain";

const DISCLAIMER =
  "This information is for educational and analytical purposes only. It is not financial advice, investment advice, or a recommendation to buy or sell any asset.";

function fmtBig(v: number | null): string {
  if (v === null) return "—";
  if (Math.abs(v) >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${v.toLocaleString()}`;
}

function fmtNum(v: number | null, decimals = 2): string {
  if (v === null) return "—";
  return v.toFixed(decimals);
}

function signalColor(signal: string | null): string {
  if (!signal) return "var(--text-muted)";
  if (signal === "overvalued") return "var(--data-red)";
  if (signal === "undervalued" || signal === "loss") return "var(--accent-green)";
  if (signal === "profit") return "var(--data-red)";
  return "var(--data-yellow)";
}

function signalLabel(signal: string | null, type: "mvrv" | "sopr" | "nvt"): string {
  if (!signal) return "—";
  if (type === "sopr") {
    if (signal === "profit") return "Sellers in Profit";
    if (signal === "loss") return "Selling at Loss";
    return "Neutral Zone";
  }
  if (signal === "overvalued") return "Overvalued";
  if (signal === "undervalued") return "Undervalued";
  return "Fair Value";
}

interface Props { asset: string }

export function OnChainOverview({ asset }: Props) {
  const { data, isLoading, error } = useOnChainOverview(asset);

  if (isLoading) {
    return (
      <GlassCard>
        <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>Loading…</p>
      </GlassCard>
    );
  }

  if (error || !data) {
    return (
      <GlassCard>
        <div className="text-sm font-bold font-display mb-2" style={{ color: "var(--text-primary)" }}>
          On-Chain data not yet available
        </div>
        <p className="text-xs font-body" style={{ color: "var(--text-secondary)" }}>
          Trigger{" "}
          <code className="px-1 rounded" style={{ background: "var(--glass-bg)", color: "var(--accent-green)" }}>
            /api/cron/refresh-onchain
          </code>{" "}
          to fetch the first dataset, then reload this page.
        </p>
        <p className="text-[10px] font-mono mt-2" style={{ color: "var(--text-muted)" }}>
          Data is sourced from CoinMetrics community API (free tier) — BTC and ETH only.
        </p>
      </GlassCard>
    );
  }

  const metrics = [
    {
      label: "MVRV Z-Score",
      value: fmtNum(data.mvrvZScore),
      signal: data.mvrvSignal,
      type: "mvrv" as const,
      description: "Market value vs realized value. Above 3 = historically overvalued.",
    },
    {
      label: "SOPR",
      value: fmtNum(data.sopr, 3),
      signal: data.soprSignal,
      type: "sopr" as const,
      description: "Spent Output Profit Ratio. Above 1 = coins moved in profit.",
    },
    {
      label: "NVT Ratio",
      value: fmtNum(data.nvtRatio, 1),
      signal: data.nvtSignal,
      type: "nvt" as const,
      description: "Network Value to Transactions. High = low on-chain utility vs price.",
    },
  ];

  return (
    <div className="h-full flex flex-col gap-3 overflow-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold font-display" style={{ color: "var(--text-primary)" }}>
          On-Chain Overview — {asset}
        </h2>
        <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
          {data.timestamp ? new Date(data.timestamp).toLocaleDateString() : ""}
        </span>
      </div>

      {/* Signal cards */}
      <div className="grid grid-cols-3 gap-3">
        {metrics.map((m) => (
          <GlassCard key={m.label}>
            <div className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
              {m.label}
            </div>
            <div className="text-2xl font-bold font-mono mb-1" style={{ color: signalColor(m.signal) }}>
              {m.value}
            </div>
            <div className="text-xs font-mono" style={{ color: signalColor(m.signal) }}>
              {signalLabel(m.signal, m.type)}
            </div>
            <p className="text-[10px] font-body mt-2" style={{ color: "var(--text-muted)" }}>
              {m.description}
            </p>
          </GlassCard>
        ))}
      </div>

      {/* Market cap vs realized cap */}
      <div className="grid grid-cols-2 gap-3">
        <GlassCard>
          <div className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
            Market Cap
          </div>
          <div className="text-xl font-bold font-mono" style={{ color: "var(--text-primary)" }}>
            {fmtBig(data.marketCap)}
          </div>
        </GlassCard>
        <GlassCard>
          <div className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
            Realized Cap
          </div>
          <div className="text-xl font-bold font-mono" style={{ color: "var(--text-secondary)" }}>
            {fmtBig(data.realizedCap)}
          </div>
          <div className="text-[10px] font-mono mt-1" style={{ color: "var(--text-muted)" }}>
            {data.marketCap && data.realizedCap && data.realizedCap > 0
              ? `MVRV: ${(data.marketCap / data.realizedCap).toFixed(2)}x`
              : ""}
          </div>
        </GlassCard>
      </div>

      {data.activeAddresses && (
        <GlassCard>
          <div className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
            Active Addresses (Daily)
          </div>
          <div className="text-xl font-bold font-mono" style={{ color: "var(--text-primary)" }}>
            {data.activeAddresses.toLocaleString()}
          </div>
        </GlassCard>
      )}

      <GlassCard>
        <p className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{DISCLAIMER}</p>
      </GlassCard>
    </div>
  );
}
