"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { useCorrelations } from "@/hooks/useMacro";
import type { CorrelationAsset } from "@/types/macro";

const DISCLAIMER =
  "Correlations based on daily log-returns over the selected window. Past correlations do not predict future behaviour.";

function corrColor(v: number): string {
  // -1 = red, 0 = muted, +1 = green
  if (v >= 0.6) return "var(--accent-green)";
  if (v >= 0.3) return "#4ade80";
  if (v >= 0.1) return "#86efac";
  if (v <= -0.6) return "var(--data-red)";
  if (v <= -0.3) return "#f87171";
  if (v <= -0.1) return "#fca5a5";
  return "var(--text-muted)";
}

function corrBg(v: number): string {
  if (v >= 0.6) return "rgba(0,212,170,0.18)";
  if (v >= 0.3) return "rgba(0,212,170,0.09)";
  if (v <= -0.6) return "rgba(239,68,68,0.18)";
  if (v <= -0.3) return "rgba(239,68,68,0.09)";
  return "transparent";
}

const LABEL_W = 56;
const CELL_W = 54;
const CELL_H = 32;

export function CorrelationView() {
  const { data, isLoading, error } = useCorrelations(30);

  if (isLoading) {
    return (
      <GlassCard className="h-full">
        <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
          Fetching cross-asset data…
        </p>
      </GlassCard>
    );
  }

  if (error || !data) {
    return (
      <GlassCard className="h-full">
        <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
          Correlation data temporarily unavailable.
        </p>
      </GlassCard>
    );
  }

  const assets: CorrelationAsset[] = data.assets as CorrelationAsset[];
  const n = assets.length;
  const totalW = LABEL_W + n * CELL_W;
  const totalH = CELL_H + n * CELL_H;

  // Rolling chart dimensions
  const chartW = 560;
  const chartH = 120;
  const valid = data.rollingBtcSpx.filter((p) => p.correlation !== null);
  const xScale = valid.length > 1 ? chartW / (valid.length - 1) : 1;
  const toY = (c: number) => chartH / 2 - (c * chartH) / 2;

  const points = valid.map((p, i) => `${i * xScale},${toY(p.correlation!)}`).join(" ");

  return (
    <div className="flex flex-col gap-4 p-1 overflow-auto">
      {/* Heatmap */}
      <GlassCard>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-mono font-semibold" style={{ color: "var(--text-primary)" }}>
            Cross-Asset Correlation Matrix
          </h3>
          <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
            30-day window · daily log-returns
          </span>
        </div>
        <div className="overflow-x-auto">
          <svg width={totalW} height={totalH}>
            {/* Column headers */}
            {assets.map((a, j) => (
              <text
                key={a}
                x={LABEL_W + j * CELL_W + CELL_W / 2}
                y={CELL_H / 2 + 4}
                textAnchor="middle"
                fontSize={10}
                fontFamily="monospace"
                fill="var(--text-secondary)"
              >
                {a}
              </text>
            ))}
            {/* Row labels + cells */}
            {assets.map((rowAsset, i) => (
              <g key={rowAsset} transform={`translate(0, ${CELL_H + i * CELL_H})`}>
                <text
                  x={LABEL_W - 6}
                  y={CELL_H / 2 + 4}
                  textAnchor="end"
                  fontSize={10}
                  fontFamily="monospace"
                  fill="var(--text-secondary)"
                >
                  {rowAsset}
                </text>
                {assets.map((_, j) => {
                  const v = data.matrix[i][j];
                  return (
                    <g key={j}>
                      <rect
                        x={LABEL_W + j * CELL_W}
                        y={0}
                        width={CELL_W - 2}
                        height={CELL_H - 2}
                        rx={3}
                        fill={i === j ? "rgba(255,255,255,0.04)" : corrBg(v)}
                        stroke="var(--glass-border)"
                        strokeWidth={0.5}
                      />
                      <text
                        x={LABEL_W + j * CELL_W + CELL_W / 2 - 1}
                        y={CELL_H / 2 + 4}
                        textAnchor="middle"
                        fontSize={10}
                        fontFamily="monospace"
                        fill={i === j ? "var(--text-muted)" : corrColor(v)}
                      >
                        {i === j ? "—" : v.toFixed(2)}
                      </text>
                    </g>
                  );
                })}
              </g>
            ))}
          </svg>
        </div>
      </GlassCard>

      {/* Rolling BTC-SPX */}
      <GlassCard>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-mono font-semibold" style={{ color: "var(--text-primary)" }}>
            Rolling 30-Day BTC ↔ S&P 500 Correlation
          </h3>
          {data._stale && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ background: "rgba(255,200,0,0.1)", color: "var(--data-yellow)" }}>
              STALE
            </span>
          )}
        </div>

        {valid.length < 5 ? (
          <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
            Insufficient data for rolling chart.
          </p>
        ) : (
          <svg width="100%" viewBox={`0 0 ${chartW + 40} ${chartH + 32}`} preserveAspectRatio="xMidYMid meet">
            {/* Zero line */}
            <line x1={0} y1={chartH / 2} x2={chartW} y2={chartH / 2} stroke="var(--glass-border)" strokeDasharray="4 3" strokeWidth={1} />
            {/* +0.5 / -0.5 guide lines */}
            {[-0.5, 0.5].map((v) => (
              <line key={v} x1={0} y1={toY(v)} x2={chartW} y2={toY(v)} stroke="var(--glass-border)" strokeDasharray="2 4" strokeWidth={0.5} strokeOpacity={0.6} />
            ))}
            {/* Correlation line */}
            <polyline points={points} fill="none" stroke="var(--accent-green)" strokeWidth={1.5} />
            {/* Y-axis labels */}
            {[1, 0.5, 0, -0.5, -1].map((v) => (
              <text key={v} x={chartW + 6} y={toY(v) + 4} fontSize={9} fontFamily="monospace" fill="var(--text-muted)">
                {v.toFixed(1)}
              </text>
            ))}
            {/* Latest value dot */}
            {valid.length > 0 && (
              <circle
                cx={(valid.length - 1) * xScale}
                cy={toY(valid[valid.length - 1].correlation!)}
                r={3}
                fill="var(--accent-green)"
              />
            )}
          </svg>
        )}

        <p className="mt-3 text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
          {DISCLAIMER}
        </p>
      </GlassCard>
    </div>
  );
}
