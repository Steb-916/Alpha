"use client";

import { useMemo } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { useCascadeRisk } from "@/hooks/useCascadeRisk";
import { UnavailableBanner } from "./UnavailableBanner";
import type {
  CascadeRiskLevel,
  CascadeRiskOverlay,
} from "@/types/options";

const RISK_COLORS: Record<CascadeRiskLevel, string> = {
  critical: "var(--data-red)",
  elevated: "rgba(239, 68, 68, 0.75)",
  moderate: "var(--data-yellow)",
  low: "var(--data-green)",
};

const RISK_LABELS: Record<CascadeRiskLevel, string> = {
  critical: "Critical",
  elevated: "Elevated",
  moderate: "Moderate",
  low: "Low",
};

const CHART_WIDTH = 800;
const CHART_HEIGHT = 260;
const CHART_MARGIN_X = 60;
const CHART_MARGIN_Y = 20;

interface CascadeRiskViewProps {
  asset: string;
}

function formatPrice(p: number): string {
  if (p >= 1000) return `$${p.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return `$${p.toFixed(2)}`;
}

function useChartGeometry(data: CascadeRiskOverlay | null) {
  return useMemo(() => {
    if (!data || data.zones.length === 0) return null;
    const prices: number[] = [data.spot, ...data.zones.map((z) => z.priceLevel)];
    if (data.gammaFlip != null) prices.push(data.gammaFlip);
    const minP = Math.min(...prices) * 0.98;
    const maxP = Math.max(...prices) * 1.02;
    const range = maxP - minP || 1;
    const yOf = (p: number) =>
      CHART_MARGIN_Y + ((maxP - p) / range) * (CHART_HEIGHT - 2 * CHART_MARGIN_Y);
    return { minP, maxP, yOf };
  }, [data]);
}

export function CascadeRiskView({ asset }: CascadeRiskViewProps) {
  const { data, isLoading, unavailable, quantEngineConfigured } =
    useCascadeRisk(asset);
  const chart = useChartGeometry(data);

  if (isLoading) {
    return (
      <GlassCard>
        <div
          className="text-xs font-mono"
          style={{ color: "var(--text-muted)" }}
        >
          Computing cascade risk…
        </div>
      </GlassCard>
    );
  }
  if (unavailable || !data) {
    return (
      <UnavailableBanner
        quantEngineConfigured={quantEngineConfigured}
        tool="Cascade Risk"
      />
    );
  }

  const riskColor = RISK_COLORS[data.overallRisk];
  const { summary, zones } = data;

  return (
    <div className="h-full flex flex-col gap-3 overflow-auto">
      {/* ─── Header: title + overall risk badge + staleness chip ──────────── */}
      <div className="flex items-center justify-between gap-3 shrink-0">
        <h2
          className="text-sm font-bold font-display"
          style={{ color: "var(--text-primary)" }}
        >
          Cascade Risk — {asset}
        </h2>
        <div className="flex items-center gap-2">
          {data.staleness === "stale" && (
            <span
              className="px-2 py-0.5 rounded-[var(--radius-pill)] text-[10px] font-mono uppercase tracking-wider"
              style={{
                background: "var(--glass-bg)",
                color: "var(--text-muted)",
                border: "1px solid var(--glass-border)",
              }}
            >
              Stale
            </span>
          )}
          <span
            className="px-2 py-0.5 rounded-[var(--radius-pill)] text-[10px] font-mono uppercase tracking-wider"
            style={{
              background: "var(--glass-bg)",
              color: riskColor,
              border: `1px solid ${riskColor}`,
            }}
          >
            {RISK_LABELS[data.overallRisk]}
          </span>
        </div>
      </div>

      {/* ─── Summary: zone counts + top zone ─────────────────────────────── */}
      <GlassCard>
        <div
          className="text-xs font-mono uppercase tracking-wider mb-2"
          style={{ color: "var(--text-muted)" }}
        >
          Zone summary
        </div>
        <div className="grid grid-cols-4 gap-2 mb-2">
          <SummaryCell
            label="Critical"
            value={summary.criticalCount}
            color={RISK_COLORS.critical}
          />
          <SummaryCell
            label="Elevated"
            value={summary.elevatedCount}
            color={RISK_COLORS.elevated}
          />
          <SummaryCell
            label="Moderate"
            value={summary.moderateCount}
            color={RISK_COLORS.moderate}
          />
          <SummaryCell
            label="Low"
            value={summary.lowCount}
            color={RISK_COLORS.low}
          />
        </div>
        {summary.topZonePrice != null &&
          summary.topZoneDistancePct != null && (
            <p
              className="text-xs font-body"
              style={{ color: "var(--text-secondary)" }}
            >
              Highest-intensity zone at {formatPrice(summary.topZonePrice)} (
              {summary.topZoneDistancePct >= 0 ? "+" : ""}
              {summary.topZoneDistancePct.toFixed(2)}% from spot).
            </p>
          )}
      </GlassCard>

      {/* ─── SVG overlay: price axis with zones + spot + gamma flip ───────── */}
      {chart && (
        <GlassCard>
          <div
            className="text-xs font-mono uppercase tracking-wider mb-2"
            style={{ color: "var(--text-muted)" }}
          >
            Negative gamma + liquidation overlay
          </div>
          <svg
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            className="w-full"
            style={{ height: CHART_HEIGHT }}
          >
            {zones.map((z, i) => {
              const y = chart.yOf(z.priceLevel);
              const bandH = Math.max(6, z.liqIntensity * 22);
              const color = RISK_COLORS[z.cascadeRisk];
              return (
                <g key={`${z.priceLevel}-${i}`}>
                  <rect
                    x={CHART_MARGIN_X}
                    y={y - bandH / 2}
                    width={CHART_WIDTH - 2 * CHART_MARGIN_X}
                    height={bandH}
                    fill={color}
                    opacity={0.25 + z.liqIntensity * 0.4}
                    rx={2}
                  />
                  <text
                    x={4}
                    y={y + 3}
                    fontSize={9}
                    fill="var(--text-muted)"
                  >
                    {formatPrice(z.priceLevel)}
                  </text>
                </g>
              );
            })}
            <line
              x1={CHART_MARGIN_X}
              y1={chart.yOf(data.spot)}
              x2={CHART_WIDTH - CHART_MARGIN_X}
              y2={chart.yOf(data.spot)}
              stroke="var(--accent-green)"
              strokeWidth={1.5}
            />
            <text
              x={CHART_WIDTH - CHART_MARGIN_X + 4}
              y={chart.yOf(data.spot) + 3}
              fontSize={10}
              fill="var(--accent-green)"
            >
              Spot
            </text>
            {data.gammaFlip != null && (
              <>
                <line
                  x1={CHART_MARGIN_X}
                  y1={chart.yOf(data.gammaFlip)}
                  x2={CHART_WIDTH - CHART_MARGIN_X}
                  y2={chart.yOf(data.gammaFlip)}
                  stroke="var(--data-yellow)"
                  strokeWidth={1}
                  strokeDasharray="4 2"
                />
                <text
                  x={CHART_WIDTH - CHART_MARGIN_X + 4}
                  y={chart.yOf(data.gammaFlip) + 3}
                  fontSize={10}
                  fill="var(--data-yellow)"
                >
                  Flip
                </text>
              </>
            )}
          </svg>
        </GlassCard>
      )}

      {/* ─── Zones table ──────────────────────────────────────────────────── */}
      {zones.length > 0 ? (
        <GlassCard>
          <div
            className="text-xs font-mono uppercase tracking-wider mb-2"
            style={{ color: "var(--text-muted)" }}
          >
            Identified zones
          </div>
          <table className="w-full text-xs font-mono">
            <thead>
              <tr
                style={{
                  color: "var(--text-muted)",
                  borderBottom: "1px solid var(--glass-border)",
                }}
              >
                <th className="text-left py-1 pr-3">Price</th>
                <th className="text-right pr-3">Δ Spot</th>
                <th className="text-right pr-3">Liq side</th>
                <th className="text-right pr-3">Liq intensity</th>
                <th className="text-right">Risk</th>
              </tr>
            </thead>
            <tbody>
              {zones.map((z, i) => (
                <tr
                  key={`${z.priceLevel}-${i}`}
                  style={{
                    borderBottom: "1px solid rgba(148,163,184,0.07)",
                  }}
                >
                  <td
                    className="py-1 pr-3"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {formatPrice(z.priceLevel)}
                  </td>
                  <td
                    className="text-right pr-3"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {z.distanceFromSpotPct >= 0 ? "+" : ""}
                    {z.distanceFromSpotPct.toFixed(2)}%
                  </td>
                  <td
                    className="text-right pr-3"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {z.liqSide}
                  </td>
                  <td
                    className="text-right pr-3"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {(z.liqIntensity * 100).toFixed(0)}%
                  </td>
                  <td className="text-right">
                    <span style={{ color: RISK_COLORS[z.cascadeRisk] }}>
                      {RISK_LABELS[z.cascadeRisk]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      ) : (
        <GlassCard>
          <p
            className="text-sm font-body text-center py-4"
            style={{ color: "var(--text-secondary)" }}
          >
            No cascade risk zones identified at current market structure.
          </p>
        </GlassCard>
      )}

      <GlassCard>
        <p
          className="text-[10px] font-mono"
          style={{ color: "var(--text-muted)" }}
        >
          Cascade risk flags prices where dealer negative-gamma overlaps with
          dense liquidation clusters. Market-structure context, not entry/exit
          advice. Thresholds are heuristic and uncalibrated.
        </p>
      </GlassCard>
    </div>
  );
}

function SummaryCell({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div>
      <div
        className="text-[10px] font-mono uppercase tracking-wider mb-0.5"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </div>
      <div
        className="text-sm font-bold font-mono"
        style={{ color: value > 0 ? color : "var(--text-primary)" }}
      >
        {value}
      </div>
    </div>
  );
}
