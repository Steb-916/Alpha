"use client";

import { useMemo } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { useCascadeRisk } from "@/hooks/useCascadeRisk";
import { UnavailableBanner } from "../UnavailableBanner";
import type { CascadeRiskOverlay } from "@/types/options";

const DISCLAIMER =
  "This information is for educational and analytical purposes only. It is not financial advice, investment advice, or a recommendation to buy or sell any asset.";

const RISK_COLORS: Record<CascadeRiskOverlay["overallRisk"], string> = {
  critical: "var(--data-red)",
  elevated: "rgba(239,68,68,0.7)",
  moderate: "var(--data-yellow)",
  low: "var(--accent-green)",
};

const HEIGHT = 240;
const MARGIN_X = 60;
const MARGIN_Y = 20;
const WIDTH = 600;

interface Props { asset: string }

export function CascadeRiskView({ asset }: Props) {
  const { data, isLoading, unavailable, quantEngineConfigured } = useCascadeRisk(asset);

  const chart = useMemo(() => {
    if (!data || data.zones.length === 0) return null;
    const prices = [data.spot, ...data.zones.map((z) => z.priceLevel)];
    if (data.gammaFlip) prices.push(data.gammaFlip);
    const minP = Math.min(...prices) * 0.98;
    const maxP = Math.max(...prices) * 1.02;
    const range = maxP - minP || 1;
    const yOf = (p: number) =>
      MARGIN_Y + ((maxP - p) / range) * (HEIGHT - 2 * MARGIN_Y);
    return { minP, maxP, yOf };
  }, [data]);

  if (isLoading) {
    return (
      <GlassCard>
        <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>Loading…</p>
      </GlassCard>
    );
  }
  if (unavailable || !data) {
    return <UnavailableBanner quantEngineConfigured={quantEngineConfigured} tool="Cascade Risk" />;
  }

  const riskColor = RISK_COLORS[data.overallRisk];

  return (
    <div className="h-full flex flex-col gap-3 overflow-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold font-display" style={{ color: "var(--text-primary)" }}>
          Cascade Risk Overlay — {asset}
        </h2>
        <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: riskColor }}>
          {data.overallRisk} risk
        </span>
      </div>

      <GlassCard>
        <div className="text-xs font-mono uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
          Overall Risk Assessment
        </div>
        <div className="text-lg font-bold font-mono mb-2" style={{ color: riskColor }}>
          {data.overallRisk.charAt(0).toUpperCase() + data.overallRisk.slice(1)} Risk
        </div>
        <p className="text-sm font-body" style={{ color: "var(--text-secondary)" }}>
          {data.narrative}
        </p>
      </GlassCard>

      {chart && (
        <GlassCard>
          <div className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
            GEX Zones + Liquidation Overlay (price axis)
          </div>
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" style={{ height: HEIGHT }}>
            {/* Cascade risk zone bands */}
            {data.zones.map((z, i) => {
              const y = chart.yOf(z.priceLevel);
              const bandH = Math.max(6, z.liqIntensity * 20);
              const color = RISK_COLORS[z.cascadeRisk];
              return (
                <g key={i}>
                  <rect
                    x={MARGIN_X} y={y - bandH / 2}
                    width={WIDTH - 2 * MARGIN_X} height={bandH}
                    fill={color} opacity={0.25 + z.liqIntensity * 0.4} rx={2}
                  />
                  {z.cascadeRisk === "critical" || z.cascadeRisk === "elevated" ? (
                    <text x={WIDTH - MARGIN_X + 2} y={y + 4} fontSize={8} fill={color}>
                      ⚠
                    </text>
                  ) : null}
                  <text x={2} y={y + 4} fontSize={8} fill="var(--text-muted)" textAnchor="start">
                    ${z.priceLevel >= 1000 ? `${(z.priceLevel / 1000).toFixed(0)}k` : z.priceLevel}
                  </text>
                </g>
              );
            })}

            {/* Spot price line */}
            <line
              x1={MARGIN_X} y1={chart.yOf(data.spot)}
              x2={WIDTH - MARGIN_X} y2={chart.yOf(data.spot)}
              stroke="var(--accent-green)" strokeWidth={1.5}
            />
            <text x={WIDTH - MARGIN_X + 2} y={chart.yOf(data.spot) + 4} fontSize={9} fill="var(--accent-green)">
              Spot
            </text>

            {/* Gamma flip line */}
            {data.gammaFlip != null && (
              <>
                <line
                  x1={MARGIN_X} y1={chart.yOf(data.gammaFlip)}
                  x2={WIDTH - MARGIN_X} y2={chart.yOf(data.gammaFlip)}
                  stroke="var(--data-yellow)" strokeWidth={1} strokeDasharray="4 2"
                />
                <text x={WIDTH - MARGIN_X + 2} y={chart.yOf(data.gammaFlip) + 4} fontSize={9} fill="var(--data-yellow)">
                  Flip
                </text>
              </>
            )}
          </svg>
          <div className="flex gap-4 mt-2 text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
            <span><span className="inline-block w-3 h-2 mr-1 rounded-sm align-middle" style={{ background: "var(--data-red)", opacity: 0.5 }} />Cascade Risk Zone</span>
            <span><span className="inline-block w-4 h-[1.5px] mr-1 align-middle" style={{ background: "var(--accent-green)" }} />Spot</span>
            <span><span className="inline-block w-4 h-[1px] mr-1 align-middle" style={{ background: "var(--data-yellow)" }} />Gamma Flip</span>
          </div>
        </GlassCard>
      )}

      {data.zones.length > 0 && (
        <GlassCard>
          <div className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
            Identified Risk Zones
          </div>
          <table className="w-full text-xs font-mono">
            <thead>
              <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--glass-border)" }}>
                <th className="text-left py-1 pr-3">Price Level</th>
                <th className="text-right pr-3">Side</th>
                <th className="text-right pr-3">Liq Intensity</th>
                <th className="text-right">Risk</th>
              </tr>
            </thead>
            <tbody>
              {data.zones.map((z, i) => (
                <tr key={i} style={{ borderBottom: "1px solid rgba(148,163,184,0.07)" }}>
                  <td className="py-1 pr-3" style={{ color: "var(--text-primary)" }}>
                    ${z.priceLevel.toLocaleString()}
                  </td>
                  <td className="text-right pr-3" style={{ color: "var(--text-secondary)" }}>
                    {z.side}
                  </td>
                  <td className="text-right pr-3" style={{ color: "var(--text-secondary)" }}>
                    {(z.liqIntensity * 100).toFixed(0)}%
                  </td>
                  <td className="text-right">
                    <span style={{ color: RISK_COLORS[z.cascadeRisk] }}>
                      {z.cascadeRisk.charAt(0).toUpperCase() + z.cascadeRisk.slice(1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      )}

      {data.zones.length === 0 && (
        <GlassCard>
          <p className="text-sm font-body text-center py-4" style={{ color: "var(--text-secondary)" }}>
            No cascade risk zones identified at current market structure.
          </p>
        </GlassCard>
      )}

      <GlassCard>
        <p className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
          Cascade risk zones identify areas where negative gamma exposure overlaps with dense liquidation clusters. This is market structure context, not entry/exit advice.
          {" "}{DISCLAIMER}
        </p>
      </GlassCard>
    </div>
  );
}
