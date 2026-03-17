"use client";
import { useState, useMemo } from "react";
import { NeuCard } from "@/components/ui/NeuCard";
import { DataCell } from "@/components/ui/DataCell";
import { Badge } from "@/components/ui/Badge";
import { useAppStore } from "@/lib/store";
import { useHydrated } from "@/lib/useHydrated";
import { MOCK_INSTRUMENTS, generateFundingData } from "@/lib/mockData";
import { formatFundingRate, formatPercent, cn, getChangeColor } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Inline SVG area chart                                              */
/* ------------------------------------------------------------------ */
function MiniChart({ data, color, height = 120 }: { data: number[]; color: string; height?: number }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 400;
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${height - ((v - min) / range) * (height - 10) - 5}`)
    .join(" ");
  const areaPoints = points + ` ${w},${height} 0,${height}`;
  const id = `grad-${color.replace("#", "")}`;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#${id})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" />
      {/* zero line */}
      {min < 0 && max > 0 && (
        <line
          x1="0"
          y1={height - ((0 - min) / range) * (height - 10) - 5}
          x2={w}
          y2={height - ((0 - min) / range) * (height - 10) - 5}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Rate bar visualizer                                                */
/* ------------------------------------------------------------------ */
function RateBar({ rate, maxAbs }: { rate: number; maxAbs: number }) {
  const pct = Math.abs(rate) / maxAbs;
  const color = rate >= 0 ? "#EF4444" : "#10B981";
  const width = Math.max(pct * 100, 2);
  return (
    <div className="flex items-center gap-2 w-24">
      <div className="h-1.5 rounded-full bg-white/5 w-full relative overflow-hidden">
        <div
          className="absolute top-0 h-full rounded-full transition-all"
          style={{
            width: `${width}%`,
            backgroundColor: color,
            left: rate >= 0 ? "50%" : `${50 - width}%`,
          }}
        />
        <div className="absolute top-0 left-1/2 w-px h-full bg-white/10" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */
export default function FundingPage() {
  const { selectedAsset, setAsset } = useAppStore();
  const hydrated = useHydrated();
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  // Generate funding data for all instruments
  const allFunding = useMemo(
    () => MOCK_INSTRUMENTS.map((inst) => ({ ...inst, funding: generateFundingData(inst.symbol) })),
    []
  );

  const selectedFunding = useMemo(
    () => allFunding.find((f) => f.symbol === selectedAsset) ?? allFunding[0],
    [allFunding, selectedAsset]
  );

  const maxAbsRate = useMemo(
    () => Math.max(...allFunding.map((f) => Math.abs(f.funding.currentRate)), 0.0001),
    [allFunding]
  );

  const historyRates = useMemo(
    () => selectedFunding.funding.history.map((h) => h.rate),
    [selectedFunding]
  );

  const rateColor = selectedFunding.funding.currentRate >= 0 ? "#EF4444" : "#10B981";

  if (!hydrated) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent-green/30 border-t-accent-green rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-3 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold font-display text-text-primary">Funding Rates</h1>
          <Badge variant="blue">LIVE</Badge>
        </div>
        <div className="text-[10px] font-mono text-text-dim uppercase tracking-widest">
          Perpetual Swap Funding / 8-Hour Settlement
        </div>
      </div>

      {/* Top stats row */}
      <div className="grid grid-cols-5 gap-3 shrink-0">
        <DataCell
          label="Selected Asset"
          value={selectedFunding.symbol}
          subtitle={selectedFunding.name}
          color="#00D4AA"
        />
        <DataCell
          label="Current Rate"
          value={formatFundingRate(selectedFunding.funding.currentRate)}
          color={rateColor}
          subtitle={selectedFunding.funding.currentRate >= 0 ? "Longs pay shorts" : "Shorts pay longs"}
        />
        <DataCell
          label="8H Average"
          value={formatFundingRate(selectedFunding.funding.avg8h)}
          color={selectedFunding.funding.avg8h >= 0 ? "#EF4444" : "#10B981"}
        />
        <DataCell
          label="Z-Score"
          value={selectedFunding.funding.zScore.toFixed(2)}
          color={Math.abs(selectedFunding.funding.zScore) > 1.5 ? "#F59E0B" : "#94A3B8"}
          subtitle={Math.abs(selectedFunding.funding.zScore) > 2 ? "EXTREME" : Math.abs(selectedFunding.funding.zScore) > 1 ? "ELEVATED" : "NORMAL"}
        />
        <DataCell
          label="Ann. Carry"
          value={formatPercent(selectedFunding.funding.annualizedCarry, true)}
          color="#8B5CF6"
          subtitle="Annualized funding yield"
        />
      </div>

      {/* Main content: Table + Detail */}
      <div className="flex-1 flex gap-3 min-h-0">
        {/* Funding Table */}
        <NeuCard noPadding className="flex-[3] min-h-0 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-white/5 shrink-0">
            <span className="text-xs font-mono text-text-muted uppercase tracking-wider">
              All Instruments Funding Overview
            </span>
          </div>
          <div className="overflow-auto flex-1">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-white/5 text-text-dim uppercase text-[10px] tracking-wider sticky top-0 bg-bg-elevated/90 backdrop-blur-sm z-10">
                  <th className="text-left py-2.5 px-4">#</th>
                  <th className="text-left py-2.5 px-3">Asset</th>
                  <th className="text-right py-2.5 px-3">Current Rate</th>
                  <th className="text-center py-2.5 px-3">Visual</th>
                  <th className="text-right py-2.5 px-3">8H Avg</th>
                  <th className="text-right py-2.5 px-3">Z-Score</th>
                  <th className="text-right py-2.5 px-3">Ann. Carry</th>
                </tr>
              </thead>
              <tbody>
                {allFunding.map((row, idx) => {
                  const isSelected = row.symbol === selectedAsset;
                  const isHovered = row.symbol === hoveredRow;
                  return (
                    <tr
                      key={row.symbol}
                      className={cn(
                        "border-b border-white/[0.03] cursor-pointer transition-colors",
                        isSelected && "bg-accent-green/5",
                        isHovered && !isSelected && "bg-white/[0.02]"
                      )}
                      onClick={() => setAsset(row.symbol)}
                      onMouseEnter={() => setHoveredRow(row.symbol)}
                      onMouseLeave={() => setHoveredRow(null)}
                    >
                      <td className="py-2 px-4 text-text-dim">{idx + 1}</td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <span className="text-text-primary font-semibold">{row.symbol}</span>
                          {isSelected && (
                            <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
                          )}
                        </div>
                      </td>
                      <td className={cn("py-2 px-3 text-right font-semibold", row.funding.currentRate >= 0 ? "text-negative" : "text-positive")}>
                        {formatFundingRate(row.funding.currentRate)}
                      </td>
                      <td className="py-2 px-3">
                        <RateBar rate={row.funding.currentRate} maxAbs={maxAbsRate} />
                      </td>
                      <td className={cn("py-2 px-3 text-right", row.funding.avg8h >= 0 ? "text-negative" : "text-positive")}>
                        {formatFundingRate(row.funding.avg8h)}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span
                          className={cn(
                            "px-1.5 py-0.5 rounded text-[10px]",
                            Math.abs(row.funding.zScore) > 2
                              ? "bg-red-500/20 text-red-400"
                              : Math.abs(row.funding.zScore) > 1
                              ? "bg-yellow-500/20 text-yellow-400"
                              : "text-text-secondary"
                          )}
                        >
                          {row.funding.zScore.toFixed(2)}
                        </span>
                      </td>
                      <td className={cn("py-2 px-3 text-right", getChangeColor(row.funding.annualizedCarry))}>
                        {formatPercent(row.funding.annualizedCarry, true)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </NeuCard>

        {/* Right Detail Panel */}
        <div className="flex-[2] flex flex-col gap-3 min-h-0">
          {/* Funding History Chart */}
          <NeuCard className="flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-mono text-text-muted uppercase tracking-wider">
                {selectedFunding.symbol} Funding History
              </div>
              <Badge variant={selectedFunding.funding.currentRate >= 0 ? "red" : "green"}>
                {selectedFunding.funding.currentRate >= 0 ? "LONGS PAY" : "SHORTS PAY"}
              </Badge>
            </div>
            <div className="flex-1 min-h-0 flex flex-col justify-center">
              <MiniChart data={historyRates} color={rateColor} height={160} />
            </div>
            <div className="flex justify-between text-[9px] font-mono text-text-dim mt-2">
              <span>30d ago</span>
              <span>15d ago</span>
              <span>Now</span>
            </div>
          </NeuCard>

          {/* Exchange Breakdown */}
          <NeuCard className="shrink-0">
            <div className="text-xs font-mono text-text-muted uppercase tracking-wider mb-4">
              Exchange Breakdown &mdash; {selectedFunding.symbol}
            </div>
            <div className="space-y-3">
              {selectedFunding.funding.byExchange.map((ex) => {
                const exColor = ex.rate >= 0 ? "#EF4444" : "#10B981";
                const barWidth = Math.min(Math.abs(ex.rate) / maxAbsRate * 100, 100);
                return (
                  <div key={ex.exchange} className="flex items-center gap-3">
                    <div className="w-16 text-[11px] font-mono text-text-secondary">{ex.exchange}</div>
                    <div className="flex-1 h-6 bg-white/[0.03] rounded overflow-hidden relative">
                      <div
                        className="absolute top-0 h-full rounded transition-all"
                        style={{
                          width: `${Math.max(barWidth, 3)}%`,
                          backgroundColor: exColor,
                          opacity: 0.6,
                        }}
                      />
                      <div className="absolute inset-0 flex items-center px-2">
                        <span className="text-[11px] font-mono font-bold" style={{ color: exColor }}>
                          {formatFundingRate(ex.rate)}
                        </span>
                      </div>
                    </div>
                    <div className="w-20 text-right">
                      <span className="text-[10px] font-mono text-text-dim">
                        Ann: {formatPercent(ex.rate * 3 * 365 * 100, true)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Spread indicator */}
            <div className="mt-4 pt-3 border-t border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-text-dim uppercase tracking-wider">Max Exchange Spread</span>
                <span className="text-xs font-mono text-accent-yellow font-semibold">
                  {(() => {
                    const rates = selectedFunding.funding.byExchange.map((e) => e.rate);
                    const spread = Math.max(...rates) - Math.min(...rates);
                    return formatFundingRate(spread);
                  })()}
                </span>
              </div>
            </div>
          </NeuCard>
        </div>
      </div>
    </div>
  );
}
