"use client";

import useSWR from "swr";
import { GlassCard } from "@/components/ui/GlassCard";
import type { ConvergenceScore, SignalDirection } from "@/lib/analytics/convergence";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function directionColor(dir: SignalDirection): string {
  if (dir === "bullish") return "var(--accent-green)";
  if (dir === "bearish") return "var(--data-red)";
  return "var(--text-muted)";
}

function directionLabel(dir: SignalDirection): string {
  if (dir === "bullish") return "↑ Bullish";
  if (dir === "bearish") return "↓ Bearish";
  return "→ Neutral";
}

function confidenceColor(c: ConvergenceScore["confidence"]): string {
  if (c === "high") return "var(--accent-green)";
  if (c === "medium") return "var(--data-yellow)";
  return "var(--text-muted)";
}

function ScoreBar({ score }: { score: number }) {
  const pct = `${score}%`;
  const color = score >= 70 ? "var(--accent-green)" : score >= 40 ? "var(--data-yellow)" : "var(--data-red)";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 rounded-full overflow-hidden" style={{ height: 4, background: "var(--glass-border)" }}>
        <div style={{ width: pct, height: "100%", background: color, borderRadius: 4, transition: "width 0.5s" }} />
      </div>
      <span className="text-[10px] font-mono w-7 text-right" style={{ color }}>{score}</span>
    </div>
  );
}

interface Props {
  asset: string;
}

export function ConvergencePanel({ asset }: Props) {
  const { data, isLoading } = useSWR<ConvergenceScore>(
    `/api/market/convergence?asset=${asset}`,
    fetcher,
    { refreshInterval: 5 * 60 * 1000 },
  );

  if (isLoading) {
    return (
      <GlassCard>
        <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>Loading convergence…</p>
      </GlassCard>
    );
  }

  if (!data || "error" in data) {
    return (
      <GlassCard>
        <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>Convergence score unavailable</p>
      </GlassCard>
    );
  }

  const { components: c } = data;
  const domains = [
    { label: "Derivatives", domain: c.derivatives },
    { label: "On-Chain", domain: c.onchain },
    { label: "Options", domain: c.options },
  ];

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
          Signal Convergence — {asset}
        </div>
        <span
          className="text-[10px] font-mono px-2 py-0.5 rounded"
          style={{
            color: confidenceColor(data.confidence),
            background: `${confidenceColor(data.confidence)}15`,
            border: `1px solid ${confidenceColor(data.confidence)}`,
          }}
        >
          {data.confidence} confidence
        </span>
      </div>

      {/* Overall */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold font-display" style={{ color: "var(--text-primary)" }}>
            {data.description}
          </span>
          <span
            className="text-sm font-bold font-mono"
            style={{ color: directionColor(data.direction === "mixed" ? "neutral" : data.direction) }}
          >
            {data.direction === "mixed" ? "→ Mixed" : directionLabel(data.direction === "bullish" ? "bullish" : "bearish")}
          </span>
        </div>
        <ScoreBar score={data.score} />
      </div>

      {/* Domain breakdown */}
      <div className="flex flex-col gap-2">
        {domains.map(({ label, domain }) => (
          <div key={label} className="flex items-center justify-between">
            <span className="text-[10px] font-mono w-20 shrink-0" style={{ color: "var(--text-muted)" }}>
              {label}
            </span>
            <span
              className="text-[10px] font-mono flex-1 px-2"
              style={{ color: domain.weight > 0 ? directionColor(domain.signal) : "var(--text-muted)" }}
            >
              {domain.weight > 0 ? directionLabel(domain.signal) : "No data"}
            </span>
            <span className="text-[10px] font-body text-right" style={{ color: "var(--text-muted)", maxWidth: 200 }}>
              {domain.reason.split(" — ")[0]}
            </span>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
