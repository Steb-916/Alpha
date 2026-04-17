"use client";
import { useState, useMemo } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { DataCell } from "@/components/ui/DataCell";
import { Badge } from "@/components/ui/Badge";
import { useAppStore } from "@/lib/store";
import { useHydrated } from "@/lib/useHydrated";
import { MOCK_INSTRUMENTS, generateFundingData } from "@/lib/mockData";
import { formatFundingRate, formatPercent, cn, getChangeColor } from "@/lib/utils";
import { useLiveFundingData } from "@/hooks/useLiveTerminalData";
import { HistoricalFundingChart } from "@/components/terminal/HistoricalFundingChart";

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
      {min < 0 && max > 0 && (
        <line x1="0" y1={height - ((0 - min) / range) * (height - 10) - 5} x2={w} y2={height - ((0 - min) / range) * (height - 10) - 5} stroke="var(--glass-border)" strokeWidth="1" strokeDasharray="4 4" />
      )}
    </svg>
  );
}

function RateBar({ rate, maxAbs }: { rate: number; maxAbs: number }) {
  const pct = Math.abs(rate) / maxAbs;
  const color = rate >= 0 ? "var(--data-red)" : "var(--data-green)";
  const width = Math.max(pct * 100, 2);
  return (
    <div className="flex items-center gap-2 w-24">
      <div className="h-1.5 rounded-full w-full relative overflow-hidden" style={{ background: "var(--glass-bg)" }}>
        <div className="absolute top-0 h-full rounded-full transition-all" style={{ width: `${width}%`, backgroundColor: color, left: rate >= 0 ? "50%" : `${50 - width}%` }} />
        <div className="absolute top-0 left-1/2 w-px h-full" style={{ background: "var(--glass-border)" }} />
      </div>
    </div>
  );
}

export function FundingView() {
  const { selectedAsset, setAsset } = useAppStore();
  const hydrated = useHydrated();
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  // Live funding data for selected asset
  const liveFunding = useLiveFundingData();

  const allFunding = useMemo(
    () => MOCK_INSTRUMENTS.map((inst) => ({
      ...inst,
      funding: inst.symbol === selectedAsset ? liveFunding : generateFundingData(inst.symbol),
    })),
    [liveFunding, selectedAsset]
  );

  const selectedFunding = useMemo(
    () => allFunding.find((f) => f.symbol === selectedAsset) ?? allFunding[0],
    [allFunding, selectedAsset]
  );

  const maxAbsRate = useMemo(
    () => Math.max(...allFunding.map((f) => Math.abs(f.funding.currentRate)), 0.0001),
    [allFunding]
  );

  const historyRates = useMemo(() => selectedFunding.funding.history.map((h) => h.rate), [selectedFunding]);
  const rateColor = selectedFunding.funding.currentRate >= 0 ? "var(--data-red)" : "var(--data-green)";

  if (!hydrated) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 rounded-full" style={{ borderColor: "var(--glass-border)", borderTopColor: "var(--accent-green)", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-3 overflow-auto">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold font-display" style={{ color: "var(--text-primary)" }}>Funding Rates</h1>
          <Badge variant="blue">LIVE</Badge>
        </div>
        <div className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Perpetual Swap Funding / 8-Hour Settlement</div>
      </div>

      <div className="grid grid-cols-5 gap-3 shrink-0">
        <DataCell label="Selected Asset" value={selectedFunding.symbol} subtitle={selectedFunding.name} color="var(--accent-green)" />
        <DataCell label="Current Rate" value={formatFundingRate(selectedFunding.funding.currentRate)} color={rateColor} subtitle={selectedFunding.funding.currentRate >= 0 ? "Longs pay shorts" : "Shorts pay longs"} />
        <DataCell label="8H Average" value={formatFundingRate(selectedFunding.funding.avg8h)} color={selectedFunding.funding.avg8h >= 0 ? "var(--data-red)" : "var(--data-green)"} />
        <DataCell label="Z-Score" value={selectedFunding.funding.zScore.toFixed(2)} color={Math.abs(selectedFunding.funding.zScore) > 1.5 ? "var(--data-yellow)" : "var(--text-secondary)"} subtitle={Math.abs(selectedFunding.funding.zScore) > 2 ? "EXTREME" : Math.abs(selectedFunding.funding.zScore) > 1 ? "ELEVATED" : "NORMAL"} />
        <DataCell label="Ann. Carry" value={formatPercent(selectedFunding.funding.annualizedCarry, true)} color="var(--data-purple)" subtitle="Annualized funding yield" />
      </div>

      <div className="flex-1 flex gap-3 min-h-0">
        <GlassCard noPadding className="flex-[3] min-h-0 overflow-hidden flex flex-col">
          <div className="px-4 py-3 shrink-0" style={{ borderBottom: "1px solid var(--glass-border)" }}>
            <span className="text-xs font-mono uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>All Instruments Funding Overview</span>
          </div>
          <div className="overflow-auto flex-1">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="sticky top-0 z-10" style={{ background: "var(--glass-bg-hover)", borderBottom: "1px solid var(--glass-border)" }}>
                  <th className="text-left py-2.5 px-4 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>#</th>
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Asset</th>
                  <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Current Rate</th>
                  <th className="text-center py-2.5 px-3 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Visual</th>
                  <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>8H Avg</th>
                  <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Z-Score</th>
                  <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Ann. Carry</th>
                </tr>
              </thead>
              <tbody>
                {allFunding.map((row, idx) => {
                  const isSelected = row.symbol === selectedAsset;
                  const isHovered = row.symbol === hoveredRow;
                  return (
                    <tr
                      key={row.symbol}
                      className="cursor-pointer transition-colors"
                      style={{
                        borderBottom: "1px solid var(--glass-border)",
                        background: isSelected ? "rgba(0, 212, 170, 0.06)" : isHovered ? "var(--glass-bg)" : "transparent",
                      }}
                      onClick={() => setAsset(row.symbol)}
                      onMouseEnter={() => setHoveredRow(row.symbol)}
                      onMouseLeave={() => setHoveredRow(null)}
                    >
                      <td className="py-2 px-4" style={{ color: "var(--text-muted)" }}>{idx + 1}</td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{row.symbol}</span>
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--accent-green)" }} />}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-right font-semibold" style={{ color: row.funding.currentRate >= 0 ? "var(--data-red)" : "var(--data-green)" }}>{formatFundingRate(row.funding.currentRate)}</td>
                      <td className="py-2 px-3"><RateBar rate={row.funding.currentRate} maxAbs={maxAbsRate} /></td>
                      <td className="py-2 px-3 text-right" style={{ color: row.funding.avg8h >= 0 ? "var(--data-red)" : "var(--data-green)" }}>{formatFundingRate(row.funding.avg8h)}</td>
                      <td className="py-2 px-3 text-right">
                        <span className="px-1.5 py-0.5 rounded text-[10px]" style={{
                          background: Math.abs(row.funding.zScore) > 2 ? "rgba(239,68,68,0.15)" : Math.abs(row.funding.zScore) > 1 ? "rgba(245,158,11,0.15)" : "transparent",
                          color: Math.abs(row.funding.zScore) > 2 ? "var(--data-red)" : Math.abs(row.funding.zScore) > 1 ? "var(--data-yellow)" : "var(--text-secondary)",
                        }}>
                          {row.funding.zScore.toFixed(2)}
                        </span>
                      </td>
                      <td className={cn("py-2 px-3 text-right", getChangeColor(row.funding.annualizedCarry))}>{formatPercent(row.funding.annualizedCarry, true)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </GlassCard>

        <div className="flex-[2] flex flex-col gap-3 min-h-0">
          <GlassCard className="flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-mono uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{selectedFunding.symbol} Funding History</div>
              <Badge variant={selectedFunding.funding.currentRate >= 0 ? "red" : "green"}>
                {selectedFunding.funding.currentRate >= 0 ? "LONGS PAY" : "SHORTS PAY"}
              </Badge>
            </div>
            <div className="flex-1 min-h-0 flex flex-col justify-center">
              <MiniChart data={historyRates} color={rateColor} height={160} />
            </div>
            <div className="flex justify-between text-[9px] font-mono mt-2" style={{ color: "var(--text-muted)" }}>
              <span>30d ago</span><span>15d ago</span><span>Now</span>
            </div>
          </GlassCard>

          <GlassCard className="shrink-0">
            <div className="text-xs font-mono uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>Exchange Breakdown &mdash; {selectedFunding.symbol}</div>
            <div className="space-y-3">
              {selectedFunding.funding.byExchange.map((ex) => {
                const exColor = ex.rate >= 0 ? "var(--data-red)" : "var(--data-green)";
                const barWidth = Math.min(Math.abs(ex.rate) / maxAbsRate * 100, 100);
                return (
                  <div key={ex.exchange} className="flex items-center gap-3">
                    <div className="w-16 text-[11px] font-mono" style={{ color: "var(--text-secondary)" }}>{ex.exchange}</div>
                    <div className="flex-1 h-6 rounded overflow-hidden relative" style={{ background: "var(--glass-bg)" }}>
                      <div className="absolute top-0 h-full rounded transition-all" style={{ width: `${Math.max(barWidth, 3)}%`, backgroundColor: exColor, opacity: 0.6 }} />
                      <div className="absolute inset-0 flex items-center px-2">
                        <span className="text-[11px] font-mono font-bold" style={{ color: exColor }}>{formatFundingRate(ex.rate)}</span>
                      </div>
                    </div>
                    <div className="w-20 text-right">
                      <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>Ann: {formatPercent(ex.rate * 3 * 365 * 100, true)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-3" style={{ borderTop: "1px solid var(--glass-border)" }}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Max Exchange Spread</span>
                <span className="text-xs font-mono font-semibold" style={{ color: "var(--data-yellow)" }}>
                  {(() => {
                    const rates = selectedFunding.funding.byExchange.map((e) => e.rate);
                    return formatFundingRate(Math.max(...rates) - Math.min(...rates));
                  })()}
                </span>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
      <HistoricalFundingChart />
    </div>
  );
}
