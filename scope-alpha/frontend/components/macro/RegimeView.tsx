"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { useMacroRegime } from "@/hooks/useMacro";
import type { MacroRegimeLabel, RegimeFactor } from "@/types/macro";

const REGIME_COLORS: Record<MacroRegimeLabel, string> = {
  "Risk-On":      "var(--accent-green)",
  "Risk-Off":     "var(--data-red)",
  "Accumulation": "var(--data-blue)",
  "Distribution": "var(--data-yellow)",
  "Volatile":     "#f97316", // orange
  "Compressed":   "#a78bfa", // violet
};

const REGIME_ICONS: Record<MacroRegimeLabel, string> = {
  "Risk-On":      "↑",
  "Risk-Off":     "↓",
  "Accumulation": "◎",
  "Distribution": "◉",
  "Volatile":     "⚡",
  "Compressed":   "◈",
};

const REGIME_DESCRIPTIONS: Record<MacroRegimeLabel, string> = {
  "Risk-On":
    "Multiple indicators align bullishly. Positive funding environment, on-chain accumulation, and favorable macro conditions. Trending behavior — emphasize momentum signals.",
  "Risk-Off":
    "Risk-off conditions detected across derivatives, on-chain, and macro layers. Distribution is occurring. Watch liquidation levels and exchange inflows.",
  "Accumulation":
    "On-chain valuation undervalued with mixed or negative derivatives signals. Range-bound — historically a long-term accumulation window. Options positioning and vol cone are most predictive.",
  "Distribution":
    "Elevated valuations with sideways price action. Smart money may be distributing into range. SOPR, exchange inflows, and skew are key signals to monitor.",
  "Volatile":
    "Realized volatility is significantly above normal. Unstable regime — GEX and liquidation levels are the most important risk factors. Size down, trade reactively.",
  "Compressed":
    "Historically low volatility relative to baseline. Pre-breakout tension building. The direction is unknown — watch for a vol expansion trigger. Funding near zero is characteristic.",
};

const VOL_STATE_COLORS = {
  high: "var(--data-red)",
  normal: "var(--text-muted)",
  compressed: "#a78bfa",
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

  const ctx = data.historicalContext;
  const emphasis = data.contextualEmphasis ?? [];

  return (
    <div className="flex flex-col gap-4 p-1 overflow-auto">
      {/* Hero regime card */}
      <GlassCard>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
              Market Regime · {asset}
            </p>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-4xl font-mono font-bold" style={{ color: regimeColor }}>
                {REGIME_ICONS[data.regime]} {data.regime}
              </span>
              <span
                className="text-[10px] font-mono px-2 py-0.5 rounded"
                style={{
                  background: `${VOL_STATE_COLORS[data.volState]}18`,
                  color: VOL_STATE_COLORS[data.volState],
                  border: `1px solid ${VOL_STATE_COLORS[data.volState]}40`,
                }}
              >
                vol {data.volState}
              </span>
            </div>
            <p className="text-sm font-body max-w-xl" style={{ color: "var(--text-secondary)" }}>
              {REGIME_DESCRIPTIONS[data.regime]}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
              Score
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

      {/* Historical context + contextual emphasis side by side */}
      <div className="grid grid-cols-2 gap-3">
        {/* Historical forward returns */}
        <GlassCard>
          <p className="text-[10px] font-mono uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
            Historical Context · {data.regime} Regime
          </p>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <p className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>30d Median</p>
              <p
                className="text-lg font-mono font-bold"
                style={{ color: ctx.medianReturn30d >= 0 ? "var(--accent-green)" : "var(--data-red)" }}
              >
                {ctx.medianReturn30d >= 0 ? "+" : ""}{ctx.medianReturn30d.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>Win Rate</p>
              <p className="text-lg font-mono font-bold" style={{ color: "var(--text-primary)" }}>
                {(ctx.winRate * 100).toFixed(0)}%
              </p>
            </div>
            <div>
              <p className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>Avg Drawdown</p>
              <p className="text-lg font-mono font-bold" style={{ color: "var(--data-red)" }}>
                {ctx.avgMaxDrawdown.toFixed(1)}%
              </p>
            </div>
          </div>
          <p className="text-[9px] font-mono mt-3" style={{ color: "var(--text-muted)" }}>
            Based on {ctx.sampleCount} historical regime episodes · 2019–2024
          </p>
        </GlassCard>

        {/* Contextual emphasis */}
        <GlassCard>
          <p className="text-[10px] font-mono uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
            Most Predictive In This Regime
          </p>
          <div className="flex flex-col gap-2">
            {emphasis.map((metric, i) => (
              <div key={metric} className="flex items-center gap-2">
                <span
                  className="text-[10px] font-mono w-4 text-right shrink-0"
                  style={{ color: "var(--text-muted)" }}
                >
                  {i + 1}.
                </span>
                <span
                  className="text-xs font-mono px-2 py-0.5 rounded"
                  style={{
                    background: `${regimeColor}14`,
                    color: regimeColor,
                    border: `1px solid ${regimeColor}30`,
                  }}
                >
                  {metric}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

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
            <rect x={0} y={0} width={CHART_W} height={toY(62)} fill="rgba(0,212,170,0.04)" />
            <rect x={0} y={toY(38)} width={CHART_W} height={CHART_H - toY(38)} fill="rgba(239,68,68,0.04)" />
            {/* Guide lines */}
            {[62, 50, 38].map((v) => (
              <line key={v} x1={0} y1={toY(v)} x2={CHART_W} y2={toY(v)}
                stroke="var(--glass-border)" strokeDasharray="3 3" strokeWidth={0.5} />
            ))}
            {/* Score line */}
            <polyline points={points} fill="none" stroke={regimeColor} strokeWidth={1.5} />
            {/* Axis labels */}
            {[62, 50, 38].map((v) => (
              <text key={v} x={CHART_W + 4} y={toY(v) + 4} fontSize={8} fontFamily="monospace" fill="var(--text-muted)">{v}</text>
            ))}
            {/* Zone labels */}
            <text x={4} y={10} fontSize={8} fontFamily="monospace" fill="var(--accent-green)">Risk-On</text>
            <text x={4} y={CHART_H + 14} fontSize={8} fontFamily="monospace" fill="var(--data-red)">Risk-Off</text>
          </svg>
        ) : (
          <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>Insufficient history.</p>
        )}
      </GlassCard>
    </div>
  );
}
