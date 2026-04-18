"use client";

import { useMemo } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { useGex } from "@/hooks/useGex";
import { UnavailableBanner } from "../UnavailableBanner";

const BAR_HEIGHT = 14;
const BAR_GAP = 3;
const LABEL_W = 72;
const CHART_W = 500;
const DISCLAIMER =
  "This information is for educational and analytical purposes only. It is not financial advice, investment advice, or a recommendation to buy or sell any asset.";

function fmtUsd(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(0);
}

interface Props { asset: string }

export function GexByStrikeView({ asset }: Props) {
  const { data, isLoading, unavailable, quantEngineConfigured } = useGex(asset);

  const chart = useMemo(() => {
    if (!data || data.strikes.length === 0) return null;
    const maxAbs = Math.max(...data.strikes.map((s) => Math.abs(s.netGex)), 1);
    return { maxAbs };
  }, [data]);

  if (isLoading) {
    return (
      <GlassCard>
        <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>Loading…</p>
      </GlassCard>
    );
  }
  if (unavailable || !data || !chart) {
    return <UnavailableBanner quantEngineConfigured={quantEngineConfigured} tool="GEX" />;
  }

  const regimeColor = data.netGammaRegime === "positive" ? "var(--accent-green)" : "var(--data-red)";
  const regimeCopy =
    data.netGammaRegime === "positive"
      ? "Dealers appear net long gamma. In this regime, hedging flows may dampen price movement around key strikes."
      : "Dealers appear net short gamma. In this regime, hedging flows may amplify price movement, especially near large liquidation zones.";

  const svgH = data.strikes.length * (BAR_HEIGHT + BAR_GAP) + 10;

  return (
    <div className="h-full flex flex-col gap-3 overflow-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold font-display" style={{ color: "var(--text-primary)" }}>
          Gamma Exposure by Strike — {asset}
        </h2>
        {(data as typeof data & { _stale?: boolean })._stale && (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ background: "rgba(234,179,8,0.1)", color: "var(--data-yellow)", border: "1px solid var(--data-yellow)" }}>
            Stale data
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <GlassCard>
          <div className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Regime</div>
          <div className="text-sm font-bold font-mono" style={{ color: regimeColor }}>
            {data.netGammaRegime === "positive" ? "Net Long Gamma" : "Net Short Gamma"}
          </div>
        </GlassCard>
        <GlassCard>
          <div className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Gamma Flip</div>
          <div className="text-sm font-bold font-mono" style={{ color: "var(--data-yellow)" }}>
            {data.gammaFlip != null ? `$${data.gammaFlip.toLocaleString()}` : "—"}
          </div>
        </GlassCard>
        <GlassCard>
          <div className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Total Net GEX</div>
          <div className="text-sm font-bold font-mono" style={{ color: regimeColor }}>
            {fmtUsd(data.totalNetGex)}
          </div>
        </GlassCard>
      </div>

      <GlassCard>
        <div className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
          Net Gamma Exposure by Strike (dealer perspective)
        </div>
        <div className="overflow-y-auto" style={{ maxHeight: 320 }}>
          <svg viewBox={`0 0 ${LABEL_W + CHART_W + 60} ${svgH}`} className="w-full">
            {/* Zero line */}
            <line
              x1={LABEL_W + CHART_W / 2} y1={0}
              x2={LABEL_W + CHART_W / 2} y2={svgH}
              stroke="var(--glass-border)" strokeWidth={1}
            />
            {/* Spot price marker */}
            {data.gammaFlip != null && (() => {
              const flipIdx = data.strikes.findIndex((s) => s.strike >= data.gammaFlip!);
              if (flipIdx < 0) return null;
              const y = flipIdx * (BAR_HEIGHT + BAR_GAP) + BAR_HEIGHT / 2;
              return (
                <line x1={LABEL_W} y1={y} x2={LABEL_W + CHART_W} y2={y}
                  stroke="var(--data-yellow)" strokeWidth={1} strokeDasharray="4 2" />
              );
            })()}

            {data.strikes.map((s, i) => {
              const y = i * (BAR_HEIGHT + BAR_GAP) + 4;
              const barW = Math.abs(s.netGex) / chart.maxAbs * (CHART_W / 2 - 4);
              const isPos = s.netGex >= 0;
              const barX = isPos
                ? LABEL_W + CHART_W / 2
                : LABEL_W + CHART_W / 2 - barW;
              const isNearSpot = data.spot > 0 && Math.abs(s.strike - data.spot) / data.spot < 0.02;
              return (
                <g key={s.strike}>
                  <text x={LABEL_W - 4} y={y + BAR_HEIGHT - 2}
                    textAnchor="end" fontSize={9}
                    fill={isNearSpot ? "var(--text-primary)" : "var(--text-muted)"}>
                    {s.strike >= 1000 ? `${(s.strike / 1000).toFixed(0)}k` : s.strike}
                  </text>
                  <rect x={barX} y={y} width={Math.max(barW, 1)} height={BAR_HEIGHT}
                    fill={isPos ? "rgba(0,212,170,0.55)" : "rgba(239,68,68,0.55)"}
                    rx={2} />
                  {barW > 30 && (
                    <text x={isPos ? barX + 3 : barX + barW - 3}
                      y={y + BAR_HEIGHT - 3}
                      textAnchor={isPos ? "start" : "end"}
                      fontSize={8} fill="var(--text-muted)">
                      {fmtUsd(s.netGex)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
        <div className="flex gap-4 mt-2 text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
          <span><span className="inline-block w-3 h-2 mr-1 rounded-sm align-middle" style={{ background: "rgba(0,212,170,0.55)" }} />Positive GEX (stabilizing)</span>
          <span><span className="inline-block w-3 h-2 mr-1 rounded-sm align-middle" style={{ background: "rgba(239,68,68,0.55)" }} />Negative GEX (amplifying)</span>
          {data.gammaFlip != null && <span><span className="inline-block w-4 h-[1px] mr-1 align-middle" style={{ background: "var(--data-yellow)" }} />Gamma flip</span>}
        </div>
      </GlassCard>

      <GlassCard>
        <p className="text-sm font-body" style={{ color: "var(--text-secondary)" }}>{regimeCopy}</p>
        <p className="text-[10px] font-mono mt-2" style={{ color: "var(--text-muted)" }}>{DISCLAIMER}</p>
      </GlassCard>
    </div>
  );
}
