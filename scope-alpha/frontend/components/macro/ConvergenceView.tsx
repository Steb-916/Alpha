"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { useMacroConvergence } from "@/hooks/useMacro";
import type { MacroSignalDomain } from "@/types/macro";

const SIGNAL_COLORS = {
  bullish: "var(--accent-green)",
  bearish: "var(--data-red)",
  neutral: "var(--data-yellow)",
} as const;

const DIRECTION_COLORS = {
  bullish: "var(--accent-green)",
  bearish: "var(--data-red)",
  mixed:   "var(--data-yellow)",
} as const;

const CONFIDENCE_LABELS = {
  high:   "Strong alignment across all domains",
  medium: "Majority alignment — moderate conviction",
  low:    "Domains conflicting — low conviction",
} as const;

function DomainCard({ domain }: { domain: MacroSignalDomain }) {
  return (
    <GlassCard>
      <p className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
        {domain.name}
      </p>
      <div className="flex items-end justify-between mb-2">
        <span
          className="text-2xl font-mono font-bold"
          style={{ color: SIGNAL_COLORS[domain.signal] }}
        >
          {domain.score}
        </span>
        <span
          className="text-xs font-mono uppercase"
          style={{ color: SIGNAL_COLORS[domain.signal] }}
        >
          {domain.signal}
        </span>
      </div>
      {/* Mini progress bar */}
      <div className="h-1 rounded-full mb-2" style={{ background: "var(--glass-border)" }}>
        <div
          className="h-1 rounded-full"
          style={{
            width: `${domain.score}%`,
            background: SIGNAL_COLORS[domain.signal],
          }}
        />
      </div>
      <p className="text-[10px] font-body leading-snug" style={{ color: "var(--text-secondary)" }}>
        {domain.keyFactor}
      </p>
      <p className="text-[10px] font-mono mt-2" style={{ color: "var(--text-muted)" }}>
        Weight: {(domain.weight * 100).toFixed(0)}%
      </p>
    </GlassCard>
  );
}

export function ConvergenceView({ asset = "BTC" }: { asset?: string }) {
  const { data, isLoading, error } = useMacroConvergence(asset);

  if (isLoading) {
    return (
      <GlassCard className="h-full">
        <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
          Computing convergence score…
        </p>
      </GlassCard>
    );
  }

  if (error || !data) {
    return (
      <GlassCard className="h-full">
        <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
          Convergence data temporarily unavailable.
        </p>
      </GlassCard>
    );
  }

  const dirColor = DIRECTION_COLORS[data.direction];
  const barWidth = `${data.totalScore}%`;

  return (
    <div className="flex flex-col gap-4 p-1 overflow-auto">
      {/* Composite score */}
      <GlassCard>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
              Macro Convergence Score · {asset}
            </p>
            <h2 className="text-4xl font-mono font-bold" style={{ color: dirColor }}>
              {data.totalScore}
              <span className="text-base ml-1 font-normal" style={{ color: "var(--text-muted)" }}>/ 100</span>
            </h2>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
              Direction
            </p>
            <p className="text-xl font-mono font-semibold uppercase" style={{ color: dirColor }}>
              {data.direction}
            </p>
            <p className="text-[10px] font-mono mt-1" style={{ color: "var(--text-muted)" }}>
              {data.agreementCount}/3 domains agree
            </p>
          </div>
        </div>

        {/* Score bar */}
        <div className="relative h-3 rounded-full mb-2" style={{ background: "var(--glass-border)" }}>
          {/* 50 midpoint marker */}
          <div className="absolute top-0 bottom-0 w-px" style={{ left: "50%", background: "var(--text-muted)", opacity: 0.5 }} />
          <div
            className="h-3 rounded-full transition-all duration-700"
            style={{ width: barWidth, background: dirColor }}
          />
        </div>
        <div className="flex justify-between text-[9px] font-mono mb-3" style={{ color: "var(--text-muted)" }}>
          <span>0 Bearish</span>
          <span>50 Neutral</span>
          <span>100 Bullish</span>
        </div>

        {/* Confidence */}
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded text-xs font-mono"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--glass-border)" }}
        >
          <span style={{ color: "var(--text-muted)" }}>Confidence:</span>
          <span
            className="uppercase font-semibold"
            style={{ color: data.confidence === "high" ? "var(--accent-green)" : data.confidence === "low" ? "var(--data-red)" : "var(--data-yellow)" }}
          >
            {data.confidence}
          </span>
          <span style={{ color: "var(--text-secondary)" }}>{CONFIDENCE_LABELS[data.confidence]}</span>
        </div>
      </GlassCard>

      {/* Domain breakdown */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <DomainCard domain={data.domains.derivatives} />
        <DomainCard domain={data.domains.onchain} />
        <DomainCard domain={data.domains.macro} />
      </div>

      {/* Narrative */}
      <GlassCard>
        <p className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
          Analytical Narrative
        </p>
        <p className="text-sm font-body leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {data.narrative}
        </p>
        <p className="mt-3 text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
          Updated: {new Date(data.computedAt).toLocaleString()} · Not financial advice.
        </p>
      </GlassCard>
    </div>
  );
}
