"use client";
import { useMemo } from "react";
import { NeuCard } from "@/components/ui/NeuCard";
import { DataCell } from "@/components/ui/DataCell";
import { Badge } from "@/components/ui/Badge";
import { useAppStore } from "@/lib/store";
import { useHydrated } from "@/lib/useHydrated";
import { MOCK_INSTRUMENTS, generateLiquidationData } from "@/lib/mockData";
import { formatLargeNumber, formatPrice, formatPercent, cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Inline SVG stacked bar chart                                       */
/* ------------------------------------------------------------------ */
function LiqBarChart({
  data,
  height = 140,
}: {
  data: { time: number; longVol: number; shortVol: number }[];
  height?: number;
}) {
  const maxVol = Math.max(...data.map((d) => d.longVol + d.shortVol), 1);
  const w = 400;
  const barW = w / data.length - 1;

  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      {data.map((d, i) => {
        const x = (i / data.length) * w;
        const longH = (d.longVol / maxVol) * (height - 4);
        const shortH = (d.shortVol / maxVol) * (height - 4);
        return (
          <g key={i}>
            <rect
              x={x}
              y={height - longH - shortH}
              width={barW}
              height={shortH}
              fill="#10B981"
              opacity="0.7"
              rx="1"
            />
            <rect
              x={x}
              y={height - longH}
              width={barW}
              height={longH}
              fill="#EF4444"
              opacity="0.7"
              rx="1"
            />
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Scrolling ticker                                                   */
/* ------------------------------------------------------------------ */
function LiqTicker({ events }: { events: { time: string; symbol: string; exchange: string; side: "long" | "short"; amount: number; price: number }[] }) {
  const recent = events.slice(0, 15);
  return (
    <div className="overflow-hidden relative">
      <div className="flex gap-4 animate-marquee whitespace-nowrap">
        {[...recent, ...recent].map((ev, i) => {
          const sideColor = ev.side === "long" ? "text-negative" : "text-positive";
          const sideBg = ev.side === "long" ? "bg-red-500/10" : "bg-emerald-500/10";
          return (
            <div
              key={i}
              className={cn("inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-white/5", sideBg)}
            >
              <span className={cn("text-[10px] font-mono font-bold uppercase", sideColor)}>
                {ev.side === "long" ? "LIQ LONG" : "LIQ SHORT"}
              </span>
              <span className="text-[11px] font-mono text-text-primary font-semibold">
                {ev.symbol}
              </span>
              <span className="text-[11px] font-mono text-text-secondary">
                {formatLargeNumber(ev.amount)}
              </span>
              <span className="text-[10px] font-mono text-text-dim">
                @{formatPrice(ev.price)}
              </span>
              <span className="text-[9px] font-mono text-text-dim">
                {ev.exchange}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */
export default function LiquidationsPage() {
  const { selectedAsset } = useAppStore();
  const hydrated = useHydrated();

  const liqData = useMemo(() => generateLiquidationData(selectedAsset), [selectedAsset]);

  const instrument = useMemo(
    () => MOCK_INSTRUMENTS.find((i) => i.symbol === selectedAsset) ?? MOCK_INSTRUMENTS[0],
    [selectedAsset]
  );

  const totalLiq = liqData.totalLong24h + liqData.totalShort24h;
  const liqRatio = liqData.totalShort24h > 0 ? liqData.totalLong24h / liqData.totalShort24h : 0;
  const longPct = totalLiq > 0 ? (liqData.totalLong24h / totalLiq) * 100 : 50;
  const shortPct = 100 - longPct;

  // Top 10 biggest liquidations
  const topEvents = useMemo(
    () => [...liqData.events].sort((a, b) => b.amount - a.amount).slice(0, 10),
    [liqData]
  );

  // Aggregate across all instruments
  const aggregateStats = useMemo(() => {
    let totalLongs = 0;
    let totalShorts = 0;
    MOCK_INSTRUMENTS.forEach((inst) => {
      const d = generateLiquidationData(inst.symbol);
      totalLongs += d.totalLong24h;
      totalShorts += d.totalShort24h;
    });
    return { totalLongs, totalShorts, total: totalLongs + totalShorts };
  }, []);

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
          <h1 className="text-xl font-bold font-display text-text-primary">Liquidations</h1>
          <Badge variant="red">LIVE FEED</Badge>
        </div>
        <div className="text-[10px] font-mono text-text-dim uppercase tracking-widest">
          Forced Liquidation Monitor
        </div>
      </div>

      {/* Scrolling ticker */}
      <NeuCard noPadding className="shrink-0 py-2 px-3 overflow-hidden">
        <style jsx>{`
          @keyframes marquee {
            from { transform: translateX(0); }
            to { transform: translateX(-50%); }
          }
          .animate-marquee {
            animation: marquee 30s linear infinite;
          }
        `}</style>
        <LiqTicker events={liqData.events} />
      </NeuCard>

      {/* Stats row */}
      <div className="grid grid-cols-5 gap-3 shrink-0">
        <DataCell
          label="24h Total Liquidated"
          value={formatLargeNumber(totalLiq)}
          subtitle={`${selectedAsset} perpetuals`}
          color="#EF4444"
        />
        <DataCell
          label="Longs Liquidated"
          value={formatLargeNumber(liqData.totalLong24h)}
          subtitle={`${longPct.toFixed(1)}% of total`}
          color="#EF4444"
        />
        <DataCell
          label="Shorts Liquidated"
          value={formatLargeNumber(liqData.totalShort24h)}
          subtitle={`${shortPct.toFixed(1)}% of total`}
          color="#10B981"
        />
        <DataCell
          label="Liq Ratio (L/S)"
          value={liqRatio.toFixed(2)}
          subtitle={liqRatio > 1.5 ? "Long bias" : liqRatio < 0.67 ? "Short bias" : "Balanced"}
          color={liqRatio > 1.5 ? "#EF4444" : liqRatio < 0.67 ? "#10B981" : "#6B7280"}
        />
        <DataCell
          label="Global 24h Total"
          value={formatLargeNumber(aggregateStats.total)}
          subtitle="All instruments"
          color="#8B5CF6"
        />
      </div>

      {/* Long vs Short stacked bar */}
      <NeuCard className="shrink-0">
        <div className="text-xs font-mono text-text-muted uppercase tracking-wider mb-3">
          Longs vs Shorts &mdash; 24h Distribution
        </div>
        <div className="h-10 rounded-md overflow-hidden flex">
          <div
            className="flex items-center justify-center transition-all"
            style={{
              width: `${longPct}%`,
              background: "linear-gradient(90deg, #EF4444, #DC2626)",
            }}
          >
            <span className="text-[11px] font-mono font-bold text-white">
              LONGS {longPct.toFixed(1)}%
            </span>
          </div>
          <div
            className="flex items-center justify-center transition-all"
            style={{
              width: `${shortPct}%`,
              background: "linear-gradient(90deg, #059669, #10B981)",
            }}
          >
            <span className="text-[11px] font-mono font-bold text-white">
              SHORTS {shortPct.toFixed(1)}%
            </span>
          </div>
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-[10px] font-mono text-negative">{formatLargeNumber(liqData.totalLong24h)}</span>
          <span className="text-[10px] font-mono text-positive">{formatLargeNumber(liqData.totalShort24h)}</span>
        </div>
      </NeuCard>

      {/* Main content */}
      <div className="flex-1 flex gap-3 min-h-0">
        {/* Hourly liq chart */}
        <NeuCard className="flex-[3] flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-text-muted uppercase tracking-wider">
              Hourly Liquidation Volume &mdash; 24h
            </span>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-red-500/70" />
                <span className="text-[9px] font-mono text-text-dim">Longs</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500/70" />
                <span className="text-[9px] font-mono text-text-dim">Shorts</span>
              </div>
            </div>
          </div>
          <div className="flex-1 min-h-0 flex flex-col justify-center">
            <LiqBarChart data={liqData.history} height={180} />
          </div>
          <div className="flex justify-between text-[9px] font-mono text-text-dim mt-2">
            <span>24h ago</span>
            <span>18h</span>
            <span>12h</span>
            <span>6h</span>
            <span>Now</span>
          </div>
        </NeuCard>

        {/* Largest events table */}
        <NeuCard noPadding className="flex-[2] min-h-0 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-white/5 shrink-0 flex items-center justify-between">
            <span className="text-xs font-mono text-text-muted uppercase tracking-wider">
              Largest Liquidations
            </span>
            <Badge variant="red">TOP 10</Badge>
          </div>
          <div className="overflow-auto flex-1">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-white/5 text-text-dim uppercase text-[10px] tracking-wider sticky top-0 bg-bg-elevated/90 backdrop-blur-sm">
                  <th className="text-left py-2 px-4">#</th>
                  <th className="text-left py-2 px-3">Side</th>
                  <th className="text-right py-2 px-3">Amount</th>
                  <th className="text-right py-2 px-3">Price</th>
                  <th className="text-left py-2 px-3">Exchange</th>
                  <th className="text-right py-2 px-4">Time</th>
                </tr>
              </thead>
              <tbody>
                {topEvents.map((ev, idx) => {
                  const sideColor = ev.side === "long" ? "text-negative" : "text-positive";
                  const sideBg = ev.side === "long" ? "bg-red-500/5" : "bg-emerald-500/5";
                  const time = new Date(ev.time);
                  const timeStr = `${time.getHours().toString().padStart(2, "0")}:${time.getMinutes().toString().padStart(2, "0")}`;
                  return (
                    <tr key={idx} className={cn("border-b border-white/[0.03]", sideBg)}>
                      <td className="py-2 px-4 text-text-dim">{idx + 1}</td>
                      <td className="py-2 px-3">
                        <span className={cn("font-bold uppercase text-[10px]", sideColor)}>
                          {ev.side}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right text-text-primary font-semibold">
                        {formatLargeNumber(ev.amount)}
                      </td>
                      <td className="py-2 px-3 text-right text-text-secondary">
                        {formatPrice(ev.price)}
                      </td>
                      <td className="py-2 px-3 text-text-dim">{ev.exchange}</td>
                      <td className="py-2 px-4 text-right text-text-dim">{timeStr}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </NeuCard>
      </div>
    </div>
  );
}
