"use client";
import { useState, useMemo } from "react";
import { NeuCard } from "@/components/ui/NeuCard";
import { Badge } from "@/components/ui/Badge";
import { useAppStore } from "@/lib/store";
import { useHydrated } from "@/lib/useHydrated";
import { generateScreenerData } from "@/lib/mockData";
import {
  formatPrice,
  formatLargeNumber,
  formatPercent,
  formatFundingRate,
  cn,
  getChangeColor,
  getRegimeColor,
  getHealthColor,
} from "@/lib/utils";
import type { ScreenerRow } from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  Sparkline mini chart                                               */
/* ------------------------------------------------------------------ */
function Sparkline({ data, color, width = 80, height = 24 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 4) - 2}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Sort config                                                        */
/* ------------------------------------------------------------------ */
type SortKey =
  | "symbol"
  | "price"
  | "fundingRate"
  | "fundingZ"
  | "oi"
  | "oiChange24h"
  | "liq24h"
  | "liqRatio"
  | "basis"
  | "healthScore"
  | "regime";

type SortDir = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string; align: "left" | "right" | "center" }[] = [
  { key: "symbol", label: "Asset", align: "left" },
  { key: "price", label: "Price", align: "right" },
  { key: "fundingRate", label: "Funding", align: "right" },
  { key: "fundingZ", label: "Fund. Z", align: "right" },
  { key: "oi", label: "OI ($)", align: "right" },
  { key: "oiChange24h", label: "OI 24h", align: "right" },
  { key: "liq24h", label: "Liq 24h", align: "right" },
  { key: "liqRatio", label: "Liq Ratio", align: "right" },
  { key: "basis", label: "Basis %", align: "right" },
  { key: "healthScore", label: "Health", align: "center" },
  { key: "regime", label: "Regime", align: "center" },
];

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */
export default function ScreenerPage() {
  const { selectedAsset, setAsset } = useAppStore();
  const hydrated = useHydrated();
  const [sortKey, setSortKey] = useState<SortKey>("healthScore");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  const rawData = useMemo(() => generateScreenerData(), []);

  const sortedData = useMemo(() => {
    const sorted = [...rawData].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      const aNum = typeof aVal === "number" ? aVal : 0;
      const bNum = typeof bVal === "number" ? bVal : 0;
      return sortDir === "asc" ? aNum - bNum : bNum - aNum;
    });
    return sorted;
  }, [rawData, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  // Aggregate stats
  const stats = useMemo(() => {
    const totalOI = rawData.reduce((s, r) => s + r.oi, 0);
    const totalLiq = rawData.reduce((s, r) => s + r.liq24h, 0);
    const avgHealth = rawData.reduce((s, r) => s + r.healthScore, 0) / rawData.length;
    const avgFunding = rawData.reduce((s, r) => s + r.fundingRate, 0) / rawData.length;
    return { totalOI, totalLiq, avgHealth, avgFunding };
  }, [rawData]);

  if (!hydrated) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent-green/30 border-t-accent-green rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-3 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold font-display text-text-primary">Screener</h1>
          <Badge variant="green">{rawData.length} INSTRUMENTS</Badge>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-[10px] font-mono text-text-dim">
            <span>Sorted by</span>
            <span className="text-accent-green font-semibold uppercase">{sortKey}</span>
            <span>{sortDir === "asc" ? "ASC" : "DESC"}</span>
          </div>
          <div className="text-[10px] font-mono text-text-dim uppercase tracking-widest">
            Multi-Factor Derivatives Screener
          </div>
        </div>
      </div>

      {/* Mini stats bar */}
      <div className="grid grid-cols-4 gap-3 shrink-0">
        <div className="bg-white/[0.02] rounded-lg p-2.5 border border-white/[0.04]">
          <div className="text-[9px] text-text-dim font-mono uppercase tracking-wider">Agg. OI</div>
          <div className="text-sm font-bold font-mono text-accent-blue">{formatLargeNumber(stats.totalOI)}</div>
        </div>
        <div className="bg-white/[0.02] rounded-lg p-2.5 border border-white/[0.04]">
          <div className="text-[9px] text-text-dim font-mono uppercase tracking-wider">24h Liquidations</div>
          <div className="text-sm font-bold font-mono text-negative">{formatLargeNumber(stats.totalLiq)}</div>
        </div>
        <div className="bg-white/[0.02] rounded-lg p-2.5 border border-white/[0.04]">
          <div className="text-[9px] text-text-dim font-mono uppercase tracking-wider">Avg Health</div>
          <div className="text-sm font-bold font-mono" style={{ color: getHealthColor(stats.avgHealth) }}>
            {stats.avgHealth.toFixed(1)}
          </div>
        </div>
        <div className="bg-white/[0.02] rounded-lg p-2.5 border border-white/[0.04]">
          <div className="text-[9px] text-text-dim font-mono uppercase tracking-wider">Avg Funding</div>
          <div className="text-sm font-bold font-mono" style={{ color: stats.avgFunding >= 0 ? "#EF4444" : "#10B981" }}>
            {formatFundingRate(stats.avgFunding)}
          </div>
        </div>
      </div>

      {/* Full-width table */}
      <NeuCard noPadding className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-white/5 sticky top-0 bg-bg-elevated/95 backdrop-blur-sm z-10">
                <th className="text-left py-2.5 px-3 text-text-dim text-[10px] uppercase tracking-wider w-8">#</th>
                <th className="py-2.5 px-2 w-[84px]" />
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      "py-2.5 px-2 cursor-pointer select-none transition-colors hover:text-accent-green text-[10px] uppercase tracking-wider",
                      col.align === "left" && "text-left",
                      col.align === "right" && "text-right",
                      col.align === "center" && "text-center",
                      sortKey === col.key ? "text-accent-green" : "text-text-dim"
                    )}
                    onClick={() => handleSort(col.key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {sortKey === col.key && (
                        <span className="text-[8px]">{sortDir === "asc" ? "\u25B2" : "\u25BC"}</span>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedData.map((row, idx) => {
                const isSelected = row.symbol === selectedAsset;
                const isHovered = row.symbol === hoveredRow;
                const healthBgOpacity = Math.min(row.healthScore / 100 * 0.15, 0.15);

                return (
                  <tr
                    key={row.symbol}
                    className={cn(
                      "border-b border-white/[0.03] cursor-pointer transition-all",
                      isSelected && "bg-accent-green/[0.06] border-l-2 border-l-accent-green",
                      isHovered && !isSelected && "bg-white/[0.02]"
                    )}
                    onClick={() => setAsset(row.symbol)}
                    onMouseEnter={() => setHoveredRow(row.symbol)}
                    onMouseLeave={() => setHoveredRow(null)}
                  >
                    {/* Rank */}
                    <td className="py-2 px-3 text-text-dim">{idx + 1}</td>

                    {/* Sparkline */}
                    <td className="py-2 px-2">
                      {row.sparkline && (
                        <Sparkline
                          data={row.sparkline}
                          color={row.change24h >= 0 ? "#10B981" : "#EF4444"}
                        />
                      )}
                    </td>

                    {/* Asset */}
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-2">
                        <span className="text-text-primary font-semibold">{row.symbol}</span>
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-accent-green" />}
                      </div>
                    </td>

                    {/* Price */}
                    <td className="py-2 px-2 text-right text-text-primary">{formatPrice(row.price)}</td>

                    {/* Funding Rate */}
                    <td className={cn("py-2 px-2 text-right font-semibold", row.fundingRate >= 0 ? "text-negative" : "text-positive")}>
                      {formatFundingRate(row.fundingRate)}
                    </td>

                    {/* Funding Z */}
                    <td className="py-2 px-2 text-right">
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded text-[10px]",
                          Math.abs(row.fundingZ) > 2
                            ? "bg-red-500/20 text-red-400"
                            : Math.abs(row.fundingZ) > 1
                            ? "bg-yellow-500/20 text-yellow-400"
                            : "text-text-secondary"
                        )}
                      >
                        {row.fundingZ.toFixed(2)}
                      </span>
                    </td>

                    {/* OI */}
                    <td className="py-2 px-2 text-right text-accent-blue">{formatLargeNumber(row.oi)}</td>

                    {/* OI 24h change */}
                    <td className={cn("py-2 px-2 text-right", getChangeColor(row.oiChange24h))}>
                      {formatPercent(row.oiChange24h)}
                    </td>

                    {/* Liq 24h */}
                    <td className="py-2 px-2 text-right text-text-secondary">{formatLargeNumber(row.liq24h)}</td>

                    {/* Liq Ratio */}
                    <td className="py-2 px-2 text-right">
                      <span
                        className={cn(
                          "font-semibold",
                          row.liqRatio > 1.5
                            ? "text-negative"
                            : row.liqRatio < 0.67
                            ? "text-positive"
                            : "text-text-secondary"
                        )}
                      >
                        {row.liqRatio.toFixed(2)}
                      </span>
                    </td>

                    {/* Basis */}
                    <td className={cn("py-2 px-2 text-right", getChangeColor(row.basis))}>
                      {row.basis >= 0 ? "+" : ""}{row.basis.toFixed(3)}%
                    </td>

                    {/* Health Score */}
                    <td className="py-2 px-2 text-center">
                      <div
                        className="inline-flex items-center justify-center w-12 h-6 rounded font-bold text-[11px]"
                        style={{
                          backgroundColor: `${getHealthColor(row.healthScore)}${Math.round(healthBgOpacity * 255).toString(16).padStart(2, "0")}`,
                          color: getHealthColor(row.healthScore),
                        }}
                      >
                        {row.healthScore.toFixed(0)}
                      </div>
                    </td>

                    {/* Regime */}
                    <td className="py-2 px-2 text-center">
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border",
                          getRegimeColor(row.regime)
                        )}
                      >
                        {row.regime}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Table footer */}
        <div className="px-4 py-2 border-t border-white/5 flex items-center justify-between shrink-0">
          <span className="text-[9px] font-mono text-text-dim">
            {rawData.length} instruments / Click row to select / Click header to sort
          </span>
          <span className="text-[9px] font-mono text-text-dim">
            Selected: <span className="text-accent-green font-semibold">{selectedAsset}</span>
          </span>
        </div>
      </NeuCard>
    </div>
  );
}
