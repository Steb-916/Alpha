"use client";
import { useState, useMemo } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { useAppStore } from "@/lib/store";
import { useHydrated } from "@/lib/useHydrated";
import { useLiveScreenerData } from "@/hooks/useLiveTerminalData";
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

function Sparkline({ data, color, width = 80, height = 24 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 4) - 2}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

type SortKey = "symbol" | "price" | "fundingRate" | "fundingZ" | "oi" | "oiChange24h" | "liq24h" | "liqRatio" | "basis" | "healthScore" | "regime";
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

export default function ScreenerPage() {
  const { selectedAsset, setAsset } = useAppStore();
  const hydrated = useHydrated();
  const [sortKey, setSortKey] = useState<SortKey>("healthScore");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  const rawData = useLiveScreenerData();

  const sortedData = useMemo(() => {
    return [...rawData].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      const aNum = typeof aVal === "number" ? aVal : 0;
      const bNum = typeof bVal === "number" ? bVal : 0;
      return sortDir === "asc" ? aNum - bNum : bNum - aNum;
    });
  }, [rawData, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

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
        <div className="w-8 h-8 border-2 rounded-full" style={{ borderColor: "var(--glass-border)", borderTopColor: "var(--accent-green)", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-3 overflow-hidden">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold font-display" style={{ color: "var(--text-primary)" }}>Screener</h1>
          <Badge variant="green">{rawData.length} INSTRUMENTS</Badge>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
            <span>Sorted by</span>
            <span className="font-semibold uppercase" style={{ color: "var(--accent-green)" }}>{sortKey}</span>
            <span>{sortDir === "asc" ? "ASC" : "DESC"}</span>
          </div>
          <div className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Multi-Factor Derivatives Screener</div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 shrink-0">
        {[
          { label: "Agg. OI", value: formatLargeNumber(stats.totalOI), color: "var(--data-blue)" },
          { label: "24h Liquidations", value: formatLargeNumber(stats.totalLiq), color: "var(--data-red)" },
          { label: "Avg Health", value: stats.avgHealth.toFixed(1), color: getHealthColor(stats.avgHealth) },
          { label: "Avg Funding", value: formatFundingRate(stats.avgFunding), color: stats.avgFunding >= 0 ? "var(--data-red)" : "var(--data-green)" },
        ].map((s) => (
          <div key={s.label} className="rounded-[var(--radius-md)] p-2.5" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", backdropFilter: "blur(12px)" }}>
            <div className="text-[9px] font-mono uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{s.label}</div>
            <div className="text-sm font-bold font-mono" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <GlassCard noPadding className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="sticky top-0 z-10" style={{ background: "var(--glass-bg-hover)", borderBottom: "1px solid var(--glass-border)" }}>
                <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider w-8" style={{ color: "var(--text-muted)" }}>#</th>
                <th className="py-2.5 px-2 w-[84px]" />
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      "py-2.5 px-2 cursor-pointer select-none transition-colors text-[10px] uppercase tracking-wider",
                      col.align === "left" && "text-left",
                      col.align === "right" && "text-right",
                      col.align === "center" && "text-center"
                    )}
                    style={{ color: sortKey === col.key ? "var(--accent-green)" : "var(--text-muted)" }}
                    onClick={() => handleSort(col.key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {sortKey === col.key && <span className="text-[8px]">{sortDir === "asc" ? "\u25B2" : "\u25BC"}</span>}
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
                    className="cursor-pointer transition-all"
                    style={{
                      borderBottom: "1px solid var(--glass-border)",
                      background: isSelected ? "rgba(0, 212, 170, 0.06)" : isHovered ? "var(--glass-bg)" : "transparent",
                      borderLeft: isSelected ? "2px solid var(--accent-green)" : "2px solid transparent",
                    }}
                    onClick={() => setAsset(row.symbol)}
                    onMouseEnter={() => setHoveredRow(row.symbol)}
                    onMouseLeave={() => setHoveredRow(null)}
                  >
                    <td className="py-2 px-3" style={{ color: "var(--text-muted)" }}>{idx + 1}</td>
                    <td className="py-2 px-2">{row.sparkline && <Sparkline data={row.sparkline} color={row.change24h >= 0 ? "var(--data-green)" : "var(--data-red)"} />}</td>
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{row.symbol}</span>
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent-green)" }} />}
                      </div>
                    </td>
                    <td className="py-2 px-2 text-right" style={{ color: "var(--text-primary)" }}>{formatPrice(row.price)}</td>
                    <td className="py-2 px-2 text-right font-semibold" style={{ color: row.fundingRate >= 0 ? "var(--data-red)" : "var(--data-green)" }}>{formatFundingRate(row.fundingRate)}</td>
                    <td className="py-2 px-2 text-right">
                      <span className="px-1.5 py-0.5 rounded text-[10px]" style={{
                        background: Math.abs(row.fundingZ) > 2 ? "rgba(239,68,68,0.15)" : Math.abs(row.fundingZ) > 1 ? "rgba(245,158,11,0.15)" : "transparent",
                        color: Math.abs(row.fundingZ) > 2 ? "var(--data-red)" : Math.abs(row.fundingZ) > 1 ? "var(--data-yellow)" : "var(--text-secondary)",
                      }}>{row.fundingZ.toFixed(2)}</span>
                    </td>
                    <td className="py-2 px-2 text-right" style={{ color: "var(--data-blue)" }}>{formatLargeNumber(row.oi)}</td>
                    <td className={cn("py-2 px-2 text-right", getChangeColor(row.oiChange24h))}>{formatPercent(row.oiChange24h)}</td>
                    <td className="py-2 px-2 text-right" style={{ color: "var(--text-secondary)" }}>{formatLargeNumber(row.liq24h)}</td>
                    <td className="py-2 px-2 text-right">
                      <span className="font-semibold" style={{ color: row.liqRatio > 1.5 ? "var(--data-red)" : row.liqRatio < 0.67 ? "var(--data-green)" : "var(--text-secondary)" }}>{row.liqRatio.toFixed(2)}</span>
                    </td>
                    <td className={cn("py-2 px-2 text-right", getChangeColor(row.basis))}>{row.basis >= 0 ? "+" : ""}{row.basis.toFixed(3)}%</td>
                    <td className="py-2 px-2 text-center">
                      <div className="inline-flex items-center justify-center w-12 h-6 rounded font-bold text-[11px]" style={{
                        backgroundColor: `${getHealthColor(row.healthScore)}${Math.round(healthBgOpacity * 255).toString(16).padStart(2, "0")}`,
                        color: getHealthColor(row.healthScore),
                      }}>{row.healthScore.toFixed(0)}</div>
                    </td>
                    <td className="py-2 px-2 text-center">
                      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-[var(--radius-pill)] text-[10px] font-semibold border", getRegimeColor(row.regime))}>{row.regime}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 flex items-center justify-between shrink-0" style={{ borderTop: "1px solid var(--glass-border)" }}>
          <span className="text-[9px] font-mono" style={{ color: "var(--text-muted)" }}>{rawData.length} instruments / Click row to select / Click header to sort</span>
          <span className="text-[9px] font-mono" style={{ color: "var(--text-muted)" }}>Selected: <span className="font-semibold" style={{ color: "var(--accent-green)" }}>{selectedAsset}</span></span>
        </div>
      </GlassCard>
    </div>
  );
}
