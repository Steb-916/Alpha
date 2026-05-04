"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { useMacroRegime } from "@/hooks/useMacro";
import type { MacroRegimeLabel, RegimeFactor } from "@/types/macro";

const REGIME_COLORS: Record<MacroRegimeLabel, string> = {
  Bull:         "var(--accent-green)",
  Bear:         "var(--data-red)",
  Neutral:      "var(--data-yellow)",
  Accumulation: "var(--data-blue)",
};

const REGIME_DESCRIPTIONS: Record<MacroRegimeLabel, string> = {
  Bull:         "Multiple indicators align bullishly. Positive funding environment, on-chain accumulation, and macro tailwinds.",
  Bear:         "Risk-off conditions detected across derivatives, on-chain, and macro layers. Elevated caution warranted.",
  Neutral:      "Mixed signals across analytical domains. No clear directional bias — wait for convergence.",
  Accumulation: "Undervalued on-chain metrics with mixed derivatives signals. Historically a long-term accumulation window.",
};

const SIGNAL_COLORS: Record<RegimeFactor["signal"], string> = {
  bullish: "var(--accent-green)",
  bearish: "var(--data-red)",
  neutral: "var(--data-yellow)",
};

const CHART_W = 560;
const CHART_H = 80;

export function RegimeView({ asset = "BTC" }: { asset?: string }) {
  const { data, isLoading, error } = useMacroRegime(asset);

  if (isLoading) {
    return (
      <GlassCard className="h-full">
        <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
          Computing market regime…
        </p>
      </GlassCard>
    );
  }

  if (error || !data) {
    return (
      <GlassCard className="h-full">
        <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
          Regime data temporarily unavailable.
        </p>
      </GlassCard>
    );
  }

  const regimeColor = REGIME_COLORS[data.regime];
  const factors = [data.factors.btcTrend, data.factors.fundingRate, data.factors.mvrv, data.factors.fearGreed];

  // History chart
  const history = data.history;
  const scaleX = history.length > 1 ? CHART_W / (history.length - 1) : 1;
  const toY = (score: number) => CHART_H - (score / 100) * CHART_H;
  const points = history.map((h, i) => `${i * scaleX},${toY(h.score)}`).join(" ");

  return (
    <div className="flex flex-col gap-4 p-1 overflow-auto">
      {/* Hero regime card */}
      <GlassCard glow={data.regime === "Bull" ? "green" : data.regime === "Bear" ? undefined : undefined}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
              Market Regime · {asset}
            </p>
            <h2 className="text-4xl font-mono font-bold mb-1" style={{ color: regimeColor }}>
              {data.regime}
            </h2>
            <p className="text-sm font-body max-w-xl" style={{ color: "var(--text-secondary)" }}>
              {REGIME_DESCRIPTIONS[data.regime]}
            </p>
          </div>
          <div className="text-right shrink-0 ml-6">
            <p className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
              Composite Score
            </p>
            <p className="text-3xl font-mono font-bold" style={{ color: regimeColor }}>
              {data.score}
            </p>
            <p className="text-[10px] font-mono mt-1" style={{ color: "var(--text-muted)" }}>
              {data.confidence}% confidence
            </p>
          </div>
        </div>
        {data._stale && (
          <div className="mt-2">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ background: "rgba(255,200,0,0.1)", color: "var(--data-yellow)" }}>
              STALE DATA
            </span>
          </div>
        )}
      </GlassCard>

      {/* Factor cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {factors.map((f) => (
          <GlassCard key={f.name}>
            <p className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
              {f.name}
            </p>
            <p
              className="text-xs font-mono font-semibold uppercase mb-1"
              style={{ color: SIGNAL_COLORS[f.signal] }}
            >
              {f.signal}
            </p>
            <p className="text-[10px] font-body leading-tight" style={{ color: "var(--text-secondary)" }}>
              {f.description}
            </p>
            <p className="text-[10px] font-mono mt-2" style={{ color: "var(--text-muted)" }}>
              Weight: {(f.weight * 100).toFixed(0)}%
            </p>
          </GlassCard>
        ))}
      </div>

      {/* 90-day history */}
      <GlassCard>
        <div className="mb-3">
          <h3 className="text-sm font-mono font-semibold" style={{ color: "var(--text-primary)" }}>
            90-Day Composite Score History
          </h3>
          <p className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
            Approximated from Fear &amp; Greed + current factor snapshot
          </p>
        </div>
        {history.length > 5 ? (
          <svg width="100%" viewBox={`0 0 ${CHART_W} ${CHART_H + 24}`} preserveAspectRatio="xMidYMid meet">
            {/* Color bands */}
            <rect x={0} y={0} width={CHART_W} height={toY(65)} fill="rgba(0,212,170,0.04)" />
            <rect x={0} y={toY(35)} width={CHART_W} height={CHART_H - toY(35)} fill="rgba(239,68,68,0.04)" />
            {/* Guide lines */}
            {[65, 50, 35].map((v) => (
              <line key={v} x1={0} y1={toY(v)} x2={CHART_W} y2={toY(v)} stroke="var(--glass-border)" strokeDasharray="3 3" strokeWidth={0.5} />
            ))}
            {/* Score line */}
            <polyline points={points} fill="none" stroke={regimeColor} strokeWidth={1.5} />
            {/* Axis labels */}
            {[65, 50, 35].map((v) => (
              <text key={v} x={CHART_W + 4} y={toY(v) + 4} fontSize={8} fontFamily="monospace" fill="var(--text-muted)">{v}</text>
            ))}
            {/* Zone labels */}
            <text x={4} y={10} fontSize={8} fontFamily="monospace" fill="var(--accent-green)">Bull</text>
            <text x={4} y={CHART_H + 14} fontSize={8} fontFamily="monospace" fill="var(--data-red)">Bear</text>
          </svg>
        ) : (
          <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>Insufficient history.</p>
        )}
      </GlassCard>
    </div>
  );
}
