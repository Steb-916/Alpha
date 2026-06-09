"use client";

import { ChevronUp, ChevronDown, Minus } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import type { ScreenerRow } from "@/lib/types";
import {
  formatPrice,
  formatLargeNumber,
  formatFundingRate,
  formatPercent,
} from "@/lib/utils";
import type { SortField, SortDir } from "@/hooks/useScreener";

function SortIcon({
  field,
  sortField,
  sortDir,
}: {
  field: string;
  sortField: SortField;
  sortDir: SortDir;
}) {
  if (sortField !== field)
    return <Minus size={10} style={{ color: "var(--text-muted)", opacity: 0.3 }} />;
  return sortDir === "asc" ? (
    <ChevronUp size={10} style={{ color: "var(--accent-blue)" }} />
  ) : (
    <ChevronDown size={10} style={{ color: "var(--accent-blue)" }} />
  );
}

function Th({
  field,
  label,
  right,
  sortField,
  sortDir,
  onSort,
}: {
  field: SortField;
  label: string;
  right?: boolean;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (f: SortField) => void;
}) {
  return (
    <th
      className={`py-2 px-3 text-[10px] uppercase tracking-wider font-mono cursor-pointer select-none whitespace-nowrap ${right ? "text-right" : "text-left"}`}
      style={{ color: "var(--text-muted)" }}
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {!right && label}
        <SortIcon field={field as string} sortField={sortField} sortDir={sortDir} />
        {right && label}
      </span>
    </th>
  );
}

function fundingColor(rate: number): string {
  if (rate > 0.0003) return "var(--accent-green)";
  if (rate < -0.0003) return "var(--data-red)";
  return "var(--text-secondary)";
}

function changeColor(v: number): string {
  if (v > 0) return "var(--accent-green)";
  if (v < 0) return "var(--data-red)";
  return "var(--text-muted)";
}

function healthColor(score: number): string {
  if (score >= 70) return "var(--accent-green)";
  if (score >= 50) return "var(--text-secondary)";
  if (score >= 30) return "var(--data-yellow)";
  return "var(--data-red)";
}

function RegimeBadge({ regime }: { regime: string | undefined }) {
  const label = regime ?? "—";
  const color =
    label.includes("bull") || label === "Risk On" || label === "optimistic"
      ? "var(--accent-green)"
      : label.includes("bear") || label === "Risk Off" || label === "extreme_fear"
        ? "var(--data-red)"
        : label === "euphoria"
          ? "var(--data-yellow)"
          : "var(--text-muted)";

  return (
    <span
      className="px-1.5 py-0.5 rounded-[var(--radius-pill)] text-[9px] uppercase tracking-wider font-mono"
      style={{
        background: `${color}18`,
        color,
        border: `1px solid ${color}40`,
      }}
    >
      {label.replace(/_/g, " ")}
    </span>
  );
}

function CVDBadge({ trend }: { trend: "bullish" | "bearish" | "neutral" | undefined }) {
  if (!trend) return <span style={{ color: "var(--text-muted)" }}>—</span>;
  const color =
    trend === "bullish"
      ? "var(--accent-green)"
      : trend === "bearish"
        ? "var(--data-red)"
        : "var(--text-muted)";
  return (
    <span className="text-xs font-mono" style={{ color }}>
      {trend === "bullish" ? "▲" : trend === "bearish" ? "▼" : "–"}
    </span>
  );
}

function MiniSparkline({ data }: { data: number[] | undefined }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 48;
  const h = 20;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    })
    .join(" ");
  const isUp = data[data.length - 1] >= data[0];
  return (
    <svg width={w} height={h} style={{ overflow: "visible" }}>
      <polyline
        points={pts}
        fill="none"
        stroke={isUp ? "var(--accent-green)" : "var(--data-red)"}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ScreenerTable({
  rows,
  isLoading,
  sortField,
  sortDir,
  onSort,
}: {
  rows: ScreenerRow[];
  isLoading: boolean;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (f: SortField) => void;
}) {
  if (isLoading && !rows.length) {
    return (
      <GlassCard>
        <p className="text-sm font-mono" style={{ color: "var(--text-muted)" }}>
          Loading screener data…
        </p>
      </GlassCard>
    );
  }

  return (
    <GlassCard noPadding>
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr
              style={{
                background: "var(--glass-bg-hover)",
                borderBottom: "1px solid var(--glass-border)",
              }}
            >
              <Th field="rank" label="#" sortField={sortField} sortDir={sortDir} onSort={onSort} />
              <Th field="symbol" label="Asset" sortField={sortField} sortDir={sortDir} onSort={onSort} />
              <Th field="price" label="Price" right sortField={sortField} sortDir={sortDir} onSort={onSort} />
              <Th field="change24h" label="24h%" right sortField={sortField} sortDir={sortDir} onSort={onSort} />
              <Th field="volume24h" label="Volume" right sortField={sortField} sortDir={sortDir} onSort={onSort} />
              <Th field="fundingRate" label="Funding" right sortField={sortField} sortDir={sortDir} onSort={onSort} />
              <Th field="fundingZ" label="F.Z" right sortField={sortField} sortDir={sortDir} onSort={onSort} />
              <Th field="oiChange24h" label="OI Δ24h" right sortField={sortField} sortDir={sortDir} onSort={onSort} />
              <Th field="basis" label="Basis" right sortField={sortField} sortDir={sortDir} onSort={onSort} />
              <Th field="healthScore" label="Health" right sortField={sortField} sortDir={sortDir} onSort={onSort} />
              <Th field="regimeV2" label="Regime" sortField={sortField} sortDir={sortDir} onSort={onSort} />
              <Th field="cvdTrend" label="CVD" sortField={sortField} sortDir={sortDir} onSort={onSort} />
              <Th field="atmIV30d" label="IV30d" right sortField={sortField} sortDir={sortDir} onSort={onSort} />
              <Th field="arbYield" label="Arb%" right sortField={sortField} sortDir={sortDir} onSort={onSort} />
              <th className="py-2 px-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={15}
                  className="py-8 text-center text-xs font-mono"
                  style={{ color: "var(--text-muted)" }}
                >
                  No assets match the current filters.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr
                key={row.symbol}
                style={{ borderBottom: "1px solid var(--glass-border)" }}
                className="hover:bg-white/[0.02] transition-colors"
              >
                {/* Rank */}
                <td className="py-2 px-3" style={{ color: "var(--text-muted)" }}>
                  {row.rank}
                </td>

                {/* Asset */}
                <td className="py-2 px-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                      {row.symbol}
                    </span>
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      {row.name}
                    </span>
                  </div>
                </td>

                {/* Price */}
                <td className="py-2 px-3 text-right" style={{ color: "var(--text-primary)" }}>
                  {formatPrice(row.price)}
                </td>

                {/* 24h% */}
                <td
                  className="py-2 px-3 text-right"
                  style={{ color: changeColor(row.change24h) }}
                >
                  {formatPercent(row.change24h)}
                </td>

                {/* Volume */}
                <td className="py-2 px-3 text-right" style={{ color: "var(--text-secondary)" }}>
                  {formatLargeNumber(row.volume24h)}
                </td>

                {/* Funding */}
                <td
                  className="py-2 px-3 text-right"
                  style={{ color: fundingColor(row.fundingRate) }}
                >
                  {formatFundingRate(row.fundingRate)}
                </td>

                {/* Funding Z */}
                <td
                  className="py-2 px-3 text-right"
                  style={{
                    color:
                      Math.abs(row.fundingZ) > 2
                        ? row.fundingZ > 0
                          ? "var(--accent-green)"
                          : "var(--data-red)"
                        : "var(--text-muted)",
                  }}
                >
                  {row.fundingZ.toFixed(1)}σ
                </td>

                {/* OI Δ24h */}
                <td
                  className="py-2 px-3 text-right"
                  style={{ color: changeColor(row.oiChange24h) }}
                >
                  {formatPercent(row.oiChange24h)}
                </td>

                {/* Basis */}
                <td
                  className="py-2 px-3 text-right"
                  style={{ color: changeColor(row.basis) }}
                >
                  {(row.basis * 100).toFixed(3)}%
                </td>

                {/* Health */}
                <td
                  className="py-2 px-3 text-right font-semibold"
                  style={{ color: healthColor(row.healthScore) }}
                >
                  {row.healthScore.toFixed(0)}
                </td>

                {/* Regime */}
                <td className="py-2 px-3">
                  <RegimeBadge regime={row.regimeV2 ?? row.regime} />
                </td>

                {/* CVD */}
                <td className="py-2 px-3 text-center">
                  <CVDBadge trend={row.cvdTrend} />
                </td>

                {/* IV 30d */}
                <td className="py-2 px-3 text-right" style={{ color: "var(--text-secondary)" }}>
                  {row.atmIV30d != null ? `${(row.atmIV30d * 100).toFixed(0)}%` : "—"}
                </td>

                {/* Arb yield */}
                <td
                  className="py-2 px-3 text-right"
                  style={{
                    color:
                      (row.arbYield ?? 0) > 5
                        ? "var(--accent-green)"
                        : "var(--text-muted)",
                  }}
                >
                  {row.arbYield != null ? `${row.arbYield.toFixed(1)}%` : "—"}
                </td>

                {/* Sparkline */}
                <td className="py-2 px-3">
                  <MiniSparkline data={row.sparkline} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}
