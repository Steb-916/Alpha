"use client";
import { useMemo } from "react";
import { NeuCard } from "@/components/ui/NeuCard";
import { DataCell } from "@/components/ui/DataCell";
import { Badge } from "@/components/ui/Badge";
import { useAppStore } from "@/lib/store";
import { useHydrated } from "@/lib/useHydrated";
import { MOCK_INSTRUMENTS, generateBasisData, generateFundingData } from "@/lib/mockData";
import { formatPercent, formatFundingRate, cn, getChangeColor } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Inline SVG area chart                                              */
/* ------------------------------------------------------------------ */
function MiniChart({ data, color, height = 120 }: { data: number[]; color: string; height?: number }) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 400;
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${height - ((v - min) / range) * (height - 10) - 5}`)
    .join(" ");
  const areaPoints = points + ` ${w},${height} 0,${height}`;
  const id = `grad-basis-${color.replace("#", "")}`;
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
      {/* Zero line */}
      {min < 0 && max > 0 && (
        <line
          x1="0"
          y1={height - ((0 - min) / range) * (height - 10) - 5}
          x2={w}
          y2={height - ((0 - min) / range) * (height - 10) - 5}
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Dual-line overlay chart for basis vs funding correlation           */
/* ------------------------------------------------------------------ */
function DualLineChart({
  data1,
  data2,
  color1,
  color2,
  label1,
  label2,
  height = 140,
}: {
  data1: number[];
  data2: number[];
  color1: string;
  color2: string;
  label1: string;
  label2: string;
  height?: number;
}) {
  const w = 400;
  const normalize = (arr: number[]) => {
    const min = Math.min(...arr);
    const max = Math.max(...arr);
    const range = max - min || 1;
    return arr.map((v) => (v - min) / range);
  };
  const n1 = normalize(data1);
  const n2 = normalize(data2);
  const len = Math.min(n1.length, n2.length);

  const toPoints = (norm: number[]) =>
    norm
      .slice(0, len)
      .map((v, i) => `${(i / (len - 1)) * w},${height - v * (height - 10) - 5}`)
      .join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
        <polyline points={toPoints(n1)} fill="none" stroke={color1} strokeWidth="2" opacity="0.8" />
        <polyline points={toPoints(n2)} fill="none" stroke={color2} strokeWidth="2" opacity="0.8" strokeDasharray="4 2" />
      </svg>
      <div className="flex gap-4 mt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 rounded" style={{ backgroundColor: color1 }} />
          <span className="text-[9px] font-mono text-text-dim">{label1}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 rounded" style={{ backgroundColor: color2 }} />
          <span className="text-[9px] font-mono text-text-dim">{label2}</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */
export default function BasisPage() {
  const { selectedAsset } = useAppStore();
  const hydrated = useHydrated();

  const basisData = useMemo(() => generateBasisData(selectedAsset), [selectedAsset]);
  const fundingData = useMemo(() => generateFundingData(selectedAsset), [selectedAsset]);

  const instrument = useMemo(
    () => MOCK_INSTRUMENTS.find((i) => i.symbol === selectedAsset) ?? MOCK_INSTRUMENTS[0],
    [selectedAsset]
  );

  const basisHistory = useMemo(() => basisData.history.map((h) => h.basis), [basisData]);
  const fundingHistory = useMemo(() => fundingData.history.map((h) => h.rate * 100), [fundingData]);

  const basisColor = basisData.currentBasis >= 0 ? "#8B5CF6" : "#EF4444";

  // Compute basis signal
  const basisSignal = basisData.currentBasis > 2
    ? "CONTANGO"
    : basisData.currentBasis > 0.5
    ? "MILD CONTANGO"
    : basisData.currentBasis > -0.5
    ? "FLAT"
    : "BACKWARDATION";

  const signalVariant = basisData.currentBasis > 2
    ? "purple" as const
    : basisData.currentBasis > 0.5
    ? "blue" as const
    : basisData.currentBasis > -0.5
    ? "gray" as const
    : "red" as const;

  // All instruments basis ranking
  const allBasis = useMemo(
    () =>
      MOCK_INSTRUMENTS.map((inst) => {
        const b = generateBasisData(inst.symbol);
        return { symbol: inst.symbol, basis: b.currentBasis, annualized: b.annualizedBasis };
      }).sort((a, b) => b.annualized - a.annualized),
    []
  );

  if (!hydrated) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent-purple/30 border-t-accent-purple rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-3 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold font-display text-text-primary">Basis Monitor</h1>
          <Badge variant={signalVariant}>{basisSignal}</Badge>
        </div>
        <div className="text-[10px] font-mono text-text-dim uppercase tracking-widest">
          Futures-Spot Basis Analysis
        </div>
      </div>

      {/* Large basis display + stats */}
      <div className="grid grid-cols-5 gap-3 shrink-0">
        <NeuCard glow className="col-span-2">
          <div className="text-[10px] font-mono text-text-muted uppercase tracking-wider mb-2">
            Current Basis &mdash; {selectedAsset}
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-bold font-mono" style={{ color: basisColor }}>
              {basisData.currentBasis >= 0 ? "+" : ""}{basisData.currentBasis.toFixed(3)}%
            </span>
            <span className="text-lg font-mono text-text-dim">
              spot
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Badge variant={signalVariant}>{basisSignal}</Badge>
            <span className="text-[10px] font-mono text-text-dim">
              Futures {basisData.currentBasis >= 0 ? "premium" : "discount"} to spot
            </span>
          </div>
        </NeuCard>

        <DataCell
          label="Annualized Yield"
          value={formatPercent(basisData.annualizedBasis, true)}
          subtitle="Quarterly extrapolation"
          color="#8B5CF6"
        />
        <DataCell
          label="Funding Rate"
          value={formatFundingRate(fundingData.currentRate)}
          subtitle="Current 8h rate"
          color={fundingData.currentRate >= 0 ? "#EF4444" : "#10B981"}
        />
        <DataCell
          label="Implied APR"
          value={formatPercent(basisData.annualizedBasis + fundingData.annualizedCarry, true)}
          subtitle="Basis + Funding combined"
          color="#F59E0B"
        />
      </div>

      {/* Charts */}
      <div className="flex-1 flex gap-3 min-h-0">
        {/* Basis History */}
        <div className="flex-[3] flex flex-col gap-3 min-h-0">
          <NeuCard className="flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-text-muted uppercase tracking-wider">
                Basis History &mdash; 30 Day
              </span>
              <span className="text-[10px] font-mono text-text-dim">4h intervals</span>
            </div>
            <div className="flex-1 min-h-0 flex flex-col justify-center">
              <MiniChart data={basisHistory} color={basisColor} height={180} />
            </div>
            <div className="flex justify-between text-[9px] font-mono text-text-dim mt-2">
              <span>30d ago</span>
              <span>20d</span>
              <span>10d</span>
              <span>Now</span>
            </div>
          </NeuCard>

          {/* Basis vs Funding correlation */}
          <NeuCard className="shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-text-muted uppercase tracking-wider">
                Basis vs Funding Rate Overlay
              </span>
              <Badge variant="gray">NORMALIZED</Badge>
            </div>
            <DualLineChart
              data1={basisHistory.slice(-90)}
              data2={fundingHistory}
              color1="#8B5CF6"
              color2="#00D4AA"
              label1="Basis (%)"
              label2="Funding Rate"
              height={120}
            />
          </NeuCard>
        </div>

        {/* Right panel */}
        <div className="flex-[2] flex flex-col gap-3 min-h-0">
          {/* Exchange basis comparison */}
          <NeuCard className="shrink-0">
            <div className="text-xs font-mono text-text-muted uppercase tracking-wider mb-4">
              Exchange Basis &mdash; {selectedAsset}
            </div>
            <div className="space-y-3">
              {basisData.byExchange.map((ex) => {
                const exColor = ex.basis >= 0 ? "#8B5CF6" : "#EF4444";
                const maxBasis = Math.max(...basisData.byExchange.map((e) => Math.abs(e.basis)), 0.1);
                const barWidth = (Math.abs(ex.basis) / maxBasis) * 100;
                return (
                  <div key={ex.exchange}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-mono text-text-secondary">{ex.exchange}</span>
                      <span className="text-[11px] font-mono font-bold" style={{ color: exColor }}>
                        {ex.basis >= 0 ? "+" : ""}{ex.basis.toFixed(3)}%
                      </span>
                    </div>
                    <div className="h-2 bg-white/[0.03] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.max(barWidth, 3)}%`,
                          backgroundColor: exColor,
                          opacity: 0.7,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-3 border-t border-white/5">
              <div className="flex justify-between">
                <span className="text-[10px] font-mono text-text-dim">Max spread</span>
                <span className="text-[11px] font-mono text-accent-yellow font-semibold">
                  {(() => {
                    const vals = basisData.byExchange.map((e) => e.basis);
                    return (Math.max(...vals) - Math.min(...vals)).toFixed(3) + "%";
                  })()}
                </span>
              </div>
            </div>
          </NeuCard>

          {/* Basis leaderboard */}
          <NeuCard noPadding className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-white/5 shrink-0">
              <span className="text-xs font-mono text-text-muted uppercase tracking-wider">
                Basis Leaderboard (Ann.)
              </span>
            </div>
            <div className="overflow-auto flex-1">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-white/5 text-text-dim uppercase text-[10px] tracking-wider sticky top-0 bg-bg-elevated/90 backdrop-blur-sm">
                    <th className="text-left py-2 px-4">#</th>
                    <th className="text-left py-2 px-3">Asset</th>
                    <th className="text-right py-2 px-3">Basis</th>
                    <th className="text-right py-2 px-4">Ann.</th>
                  </tr>
                </thead>
                <tbody>
                  {allBasis.map((row, idx) => (
                    <tr
                      key={row.symbol}
                      className={cn(
                        "border-b border-white/[0.03]",
                        row.symbol === selectedAsset && "bg-accent-purple/5"
                      )}
                    >
                      <td className="py-1.5 px-4 text-text-dim">{idx + 1}</td>
                      <td className="py-1.5 px-3 text-text-primary font-semibold">{row.symbol}</td>
                      <td className={cn("py-1.5 px-3 text-right", getChangeColor(row.basis))}>
                        {row.basis >= 0 ? "+" : ""}{row.basis.toFixed(3)}%
                      </td>
                      <td className={cn("py-1.5 px-4 text-right font-semibold", getChangeColor(row.annualized))}>
                        {formatPercent(row.annualized, true)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </NeuCard>
        </div>
      </div>
    </div>
  );
}
