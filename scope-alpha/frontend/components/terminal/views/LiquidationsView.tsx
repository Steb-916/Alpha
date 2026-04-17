"use client";
import { useMemo } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { DataCell } from "@/components/ui/DataCell";
import { Badge } from "@/components/ui/Badge";
import { useAppStore } from "@/lib/store";
import { useHydrated } from "@/lib/useHydrated";
import { MOCK_INSTRUMENTS, generateLiquidationData } from "@/lib/mockData";
import { formatLargeNumber, formatPrice, formatPercent, cn } from "@/lib/utils";
import { useMarketDataStore } from "@/lib/marketDataStore";
import { HistoricalLiquidationsChart } from "@/components/terminal/HistoricalLiquidationsChart";

function LiqBarChart({ data, height = 140 }: { data: { time: number; longVol: number; shortVol: number }[]; height?: number }) {
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
            <rect x={x} y={height - longH - shortH} width={barW} height={shortH} fill="var(--data-green)" opacity="0.7" rx="1" />
            <rect x={x} y={height - longH} width={barW} height={longH} fill="var(--data-red)" opacity="0.7" rx="1" />
          </g>
        );
      })}
    </svg>
  );
}

function LiqTicker({ events }: { events: { time: string; symbol: string; exchange: string; side: "long" | "short"; amount: number; price: number }[] }) {
  const recent = events.slice(0, 15);
  return (
    <div className="overflow-hidden relative">
      <div className="flex gap-4 animate-marquee whitespace-nowrap">
        {[...recent, ...recent].map((ev, i) => (
          <div
            key={i}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-pill)]"
            style={{
              background: ev.side === "long" ? "rgba(239,68,68,0.08)" : "rgba(16,185,129,0.08)",
              border: "1px solid var(--glass-border)",
            }}
          >
            <span className="text-[10px] font-mono font-bold uppercase" style={{ color: ev.side === "long" ? "var(--data-red)" : "var(--data-green)" }}>
              {ev.side === "long" ? "LIQ LONG" : "LIQ SHORT"}
            </span>
            <span className="text-[11px] font-mono font-semibold" style={{ color: "var(--text-primary)" }}>{ev.symbol}</span>
            <span className="text-[11px] font-mono" style={{ color: "var(--text-secondary)" }}>{formatLargeNumber(ev.amount)}</span>
            <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>@{formatPrice(ev.price)}</span>
            <span className="text-[9px] font-mono" style={{ color: "var(--text-muted)" }}>{ev.exchange}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LiquidationsView() {
  const { selectedAsset } = useAppStore();
  const hydrated = useHydrated();

  // Use live liquidation data if available, otherwise mock
  const liveLiqs = useMarketDataStore((s) => s.liquidations);
  const liqData = useMemo(() => {
    const mock = generateLiquidationData(selectedAsset);
    // Merge live liquidations into mock data if they exist
    if (liveLiqs.length > 0) {
      const assetLiqs = liveLiqs.filter(l =>
        l.symbol.replace('USDT', '') === selectedAsset || l.symbol === selectedAsset + 'USDT'
      );
      if (assetLiqs.length > 0) {
        const liveEvents = assetLiqs.map(l => ({
          time: new Date(l.timestamp).toISOString(),
          symbol: selectedAsset,
          exchange: l.exchange.charAt(0).toUpperCase() + l.exchange.slice(1),
          side: l.side,
          amount: l.price * l.quantity,
          price: l.price,
        }));
        mock.events = [...liveEvents, ...mock.events].slice(0, 50);
      }
    }
    return mock;
  }, [selectedAsset, liveLiqs]);
  const totalLiq = liqData.totalLong24h + liqData.totalShort24h;
  const liqRatio = liqData.totalShort24h > 0 ? liqData.totalLong24h / liqData.totalShort24h : 0;
  const longPct = totalLiq > 0 ? (liqData.totalLong24h / totalLiq) * 100 : 50;
  const shortPct = 100 - longPct;

  const topEvents = useMemo(() => [...liqData.events].sort((a, b) => b.amount - a.amount).slice(0, 10), [liqData]);

  const aggregateStats = useMemo(() => {
    let totalLongs = 0, totalShorts = 0;
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
        <div className="w-8 h-8 border-2 rounded-full" style={{ borderColor: "var(--glass-border)", borderTopColor: "var(--accent-green)", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-3 overflow-auto">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold font-display" style={{ color: "var(--text-primary)" }}>Liquidations</h1>
          <Badge variant="red">LIVE FEED</Badge>
        </div>
        <div className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Forced Liquidation Monitor</div>
      </div>

      <GlassCard noPadding className="shrink-0 py-2 px-3 overflow-hidden">
        <style jsx>{`
          @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
          .animate-marquee { animation: marquee 30s linear infinite; }
        `}</style>
        <LiqTicker events={liqData.events} />
      </GlassCard>

      <div className="grid grid-cols-5 gap-3 shrink-0">
        <DataCell label="24h Total Liquidated" value={formatLargeNumber(totalLiq)} subtitle={`${selectedAsset} perpetuals`} color="var(--data-red)" />
        <DataCell label="Longs Liquidated" value={formatLargeNumber(liqData.totalLong24h)} subtitle={`${longPct.toFixed(1)}% of total`} color="var(--data-red)" />
        <DataCell label="Shorts Liquidated" value={formatLargeNumber(liqData.totalShort24h)} subtitle={`${shortPct.toFixed(1)}% of total`} color="var(--data-green)" />
        <DataCell label="Liq Ratio (L/S)" value={liqRatio.toFixed(2)} subtitle={liqRatio > 1.5 ? "Long bias" : liqRatio < 0.67 ? "Short bias" : "Balanced"} color={liqRatio > 1.5 ? "var(--data-red)" : liqRatio < 0.67 ? "var(--data-green)" : "var(--text-muted)"} />
        <DataCell label="Global 24h Total" value={formatLargeNumber(aggregateStats.total)} subtitle="All instruments" color="var(--data-purple)" />
      </div>

      <GlassCard className="shrink-0">
        <div className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>Longs vs Shorts &mdash; 24h Distribution</div>
        <div className="h-10 rounded-[var(--radius-sm)] overflow-hidden flex">
          <div className="flex items-center justify-center transition-all" style={{ width: `${longPct}%`, background: "linear-gradient(90deg, var(--data-red), #DC2626)" }}>
            <span className="text-[11px] font-mono font-bold text-white">LONGS {longPct.toFixed(1)}%</span>
          </div>
          <div className="flex items-center justify-center transition-all" style={{ width: `${shortPct}%`, background: "linear-gradient(90deg, #059669, var(--data-green))" }}>
            <span className="text-[11px] font-mono font-bold text-white">SHORTS {shortPct.toFixed(1)}%</span>
          </div>
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-[10px] font-mono" style={{ color: "var(--negative)" }}>{formatLargeNumber(liqData.totalLong24h)}</span>
          <span className="text-[10px] font-mono" style={{ color: "var(--positive)" }}>{formatLargeNumber(liqData.totalShort24h)}</span>
        </div>
      </GlassCard>

      <div className="flex-1 flex gap-3 min-h-0">
        <GlassCard className="flex-[3] flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Hourly Liquidation Volume &mdash; 24h</span>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "var(--data-red)", opacity: 0.7 }} />
                <span className="text-[9px] font-mono" style={{ color: "var(--text-muted)" }}>Longs</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "var(--data-green)", opacity: 0.7 }} />
                <span className="text-[9px] font-mono" style={{ color: "var(--text-muted)" }}>Shorts</span>
              </div>
            </div>
          </div>
          <div className="flex-1 min-h-0 flex flex-col justify-center">
            <LiqBarChart data={liqData.history} height={180} />
          </div>
          <div className="flex justify-between text-[9px] font-mono mt-2" style={{ color: "var(--text-muted)" }}>
            <span>24h ago</span><span>18h</span><span>12h</span><span>6h</span><span>Now</span>
          </div>
        </GlassCard>

        <GlassCard noPadding className="flex-[2] min-h-0 overflow-hidden flex flex-col">
          <div className="px-4 py-3 shrink-0 flex items-center justify-between" style={{ borderBottom: "1px solid var(--glass-border)" }}>
            <span className="text-xs font-mono uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Largest Liquidations</span>
            <Badge variant="red">TOP 10</Badge>
          </div>
          <div className="overflow-auto flex-1">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="sticky top-0 z-10" style={{ background: "var(--glass-bg-hover)", borderBottom: "1px solid var(--glass-border)" }}>
                  <th className="text-left py-2 px-4 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>#</th>
                  <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Side</th>
                  <th className="text-right py-2 px-3 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Amount</th>
                  <th className="text-right py-2 px-3 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Price</th>
                  <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Exchange</th>
                  <th className="text-right py-2 px-4 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Time</th>
                </tr>
              </thead>
              <tbody>
                {topEvents.map((ev, idx) => {
                  const time = new Date(ev.time);
                  const timeStr = `${time.getHours().toString().padStart(2, "0")}:${time.getMinutes().toString().padStart(2, "0")}`;
                  return (
                    <tr key={idx} style={{
                      borderBottom: "1px solid var(--glass-border)",
                      background: ev.side === "long" ? "rgba(239,68,68,0.04)" : "rgba(16,185,129,0.04)",
                    }}>
                      <td className="py-2 px-4" style={{ color: "var(--text-muted)" }}>{idx + 1}</td>
                      <td className="py-2 px-3">
                        <span className="font-bold uppercase text-[10px]" style={{ color: ev.side === "long" ? "var(--data-red)" : "var(--data-green)" }}>{ev.side}</span>
                      </td>
                      <td className="py-2 px-3 text-right font-semibold" style={{ color: "var(--text-primary)" }}>{formatLargeNumber(ev.amount)}</td>
                      <td className="py-2 px-3 text-right" style={{ color: "var(--text-secondary)" }}>{formatPrice(ev.price)}</td>
                      <td className="py-2 px-3" style={{ color: "var(--text-muted)" }}>{ev.exchange}</td>
                      <td className="py-2 px-4 text-right" style={{ color: "var(--text-muted)" }}>{timeStr}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>
      <HistoricalLiquidationsChart />
    </div>
  );
}
