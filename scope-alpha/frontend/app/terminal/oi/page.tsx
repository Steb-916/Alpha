"use client";
import { useMemo } from "react";
import { NeuCard } from "@/components/ui/NeuCard";
import { DataCell } from "@/components/ui/DataCell";
import { Badge } from "@/components/ui/Badge";
import { useAppStore } from "@/lib/store";
import { useHydrated } from "@/lib/useHydrated";
import { MOCK_INSTRUMENTS, generateOIData } from "@/lib/mockData";
import { formatLargeNumber, formatPercent, cn, getChangeColor } from "@/lib/utils";

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
  const id = `grad-oi-${color.replace("#", "")}`;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#${id})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Horizontal stacked bar for exchange breakdown                      */
/* ------------------------------------------------------------------ */
function ExchangeBar({ data, total }: { data: { exchange: string; value: number }[]; total: number }) {
  const colors: Record<string, string> = {
    Binance: "#F0B90B",
    OKX: "#FFFFFF",
    Bybit: "#F7A600",
  };
  return (
    <div>
      <div className="h-8 rounded-md overflow-hidden flex relative">
        {data.map((ex) => {
          const pct = (ex.value / total) * 100;
          return (
            <div
              key={ex.exchange}
              className="relative flex items-center justify-center transition-all group"
              style={{
                width: `${pct}%`,
                backgroundColor: `${colors[ex.exchange] || "#6B7280"}20`,
                borderRight: "1px solid rgba(0,0,0,0.3)",
              }}
            >
              <span className="text-[10px] font-mono font-bold" style={{ color: colors[ex.exchange] || "#6B7280" }}>
                {pct.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex gap-4 mt-2">
        {data.map((ex) => (
          <div key={ex.exchange} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[ex.exchange] || "#6B7280" }} />
            <span className="text-[10px] font-mono text-text-secondary">{ex.exchange}</span>
            <span className="text-[10px] font-mono text-text-muted">{formatLargeNumber(ex.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */
export default function OpenInterestPage() {
  const { selectedAsset } = useAppStore();
  const hydrated = useHydrated();

  const oiData = useMemo(() => generateOIData(selectedAsset), [selectedAsset]);

  const instrument = useMemo(
    () => MOCK_INSTRUMENTS.find((i) => i.symbol === selectedAsset) ?? MOCK_INSTRUMENTS[0],
    [selectedAsset]
  );

  const historyValues = useMemo(() => oiData.history.map((h) => h.value), [oiData]);

  // Price sparkline for correlation
  const priceData = useMemo(() => instrument.sparkline || [], [instrument]);

  // OI momentum: compare last 24 points avg to previous 24 points avg
  const oiMomentum = useMemo(() => {
    const hist = oiData.history;
    if (hist.length < 48) return 0;
    const recent = hist.slice(-24).reduce((s, h) => s + h.value, 0) / 24;
    const prior = hist.slice(-48, -24).reduce((s, h) => s + h.value, 0) / 24;
    return prior > 0 ? ((recent - prior) / prior) * 100 : 0;
  }, [oiData]);

  const momentumLabel = oiMomentum > 3 ? "SURGING" : oiMomentum > 1 ? "RISING" : oiMomentum > -1 ? "FLAT" : oiMomentum > -3 ? "DECLINING" : "PLUNGING";
  const momentumVariant = oiMomentum > 3 ? "green" as const : oiMomentum > 1 ? "green" as const : oiMomentum > -1 ? "gray" as const : oiMomentum > -3 ? "yellow" as const : "red" as const;

  // Simple correlation estimate (deterministic based on values)
  const correlation = useMemo(() => {
    const oiChange = oiData.change24h;
    const priceChange = instrument.change24h;
    const seed = Math.abs(oiChange * 1000 + priceChange * 100) % 1;
    if (Math.sign(oiChange) === Math.sign(priceChange)) return 0.65 + seed * 0.25;
    return -0.3 + seed * 0.4;
  }, [oiData, instrument]);

  const exchangeTotal = oiData.byExchange.reduce((s, e) => s + e.value, 0);

  // Top OI assets
  const allOI = useMemo(
    () =>
      MOCK_INSTRUMENTS.map((inst) => {
        const oi = generateOIData(inst.symbol);
        return { symbol: inst.symbol, oi: oi.aggregateOI, change24h: oi.change24h };
      }).sort((a, b) => b.oi - a.oi),
    []
  );

  if (!hydrated) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-3 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold font-display text-text-primary">Open Interest</h1>
          <Badge variant="blue">{selectedAsset}</Badge>
        </div>
        <div className="text-[10px] font-mono text-text-dim uppercase tracking-widest">
          Aggregate Futures Open Interest
        </div>
      </div>

      {/* Big aggregate OI card */}
      <div className="grid grid-cols-5 gap-3 shrink-0">
        <NeuCard glow className="col-span-2">
          <div className="text-[10px] font-mono text-text-muted uppercase tracking-wider mb-2">
            Total Open Interest
          </div>
          <div className="text-3xl font-bold font-mono text-accent-blue">
            {formatLargeNumber(oiData.aggregateOI)}
          </div>
          <div className="flex items-center gap-3 mt-2">
            <span className={cn("text-sm font-mono font-semibold", getChangeColor(oiData.change24h))}>
              {formatPercent(oiData.change24h)} <span className="text-text-dim text-[10px]">24h</span>
            </span>
            <span className={cn("text-sm font-mono font-semibold", getChangeColor(oiData.change4h))}>
              {formatPercent(oiData.change4h)} <span className="text-text-dim text-[10px]">4h</span>
            </span>
            <span className={cn("text-sm font-mono font-semibold", getChangeColor(oiData.change1h))}>
              {formatPercent(oiData.change1h)} <span className="text-text-dim text-[10px]">1h</span>
            </span>
          </div>
        </NeuCard>

        <DataCell
          label="OI / Market Cap"
          value={((oiData.aggregateOI / instrument.marketCap) * 100).toFixed(2) + "%"}
          subtitle="Leverage ratio proxy"
          color="#3B82F6"
        />
        <DataCell
          label="Momentum"
          value={momentumLabel}
          subtitle={formatPercent(oiMomentum)}
          color={oiMomentum > 1 ? "#10B981" : oiMomentum < -1 ? "#EF4444" : "#6B7280"}
        />
        <DataCell
          label="OI vs Price Corr."
          value={correlation.toFixed(2)}
          subtitle={correlation > 0.5 ? "Strong positive" : correlation > 0 ? "Weak positive" : "Diverging"}
          color={correlation > 0.5 ? "#10B981" : correlation > 0 ? "#F59E0B" : "#EF4444"}
        />
      </div>

      {/* Charts row */}
      <div className="flex-1 flex gap-3 min-h-0">
        {/* OI History Chart */}
        <NeuCard className="flex-[3] flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-text-muted uppercase tracking-wider">
              OI History &mdash; 7 Day
            </span>
            <Badge variant={momentumVariant}>{momentumLabel}</Badge>
          </div>
          <div className="flex-1 min-h-0 flex flex-col justify-center">
            <MiniChart data={historyValues} color="#3B82F6" height={200} />
          </div>
          <div className="flex justify-between text-[9px] font-mono text-text-dim mt-2">
            <span>7d ago</span>
            <span>5d</span>
            <span>3d</span>
            <span>1d</span>
            <span>Now</span>
          </div>
        </NeuCard>

        {/* Right panel */}
        <div className="flex-[2] flex flex-col gap-3 min-h-0">
          {/* Exchange breakdown */}
          <NeuCard className="shrink-0">
            <div className="text-xs font-mono text-text-muted uppercase tracking-wider mb-3">
              OI by Exchange
            </div>
            <ExchangeBar data={oiData.byExchange} total={exchangeTotal} />
          </NeuCard>

          {/* OI Leaderboard */}
          <NeuCard noPadding className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-white/5 shrink-0">
              <span className="text-xs font-mono text-text-muted uppercase tracking-wider">
                OI Leaderboard
              </span>
            </div>
            <div className="overflow-auto flex-1">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-white/5 text-text-dim uppercase text-[10px] tracking-wider sticky top-0 bg-bg-elevated/90 backdrop-blur-sm">
                    <th className="text-left py-2 px-4">#</th>
                    <th className="text-left py-2 px-3">Asset</th>
                    <th className="text-right py-2 px-3">OI</th>
                    <th className="text-right py-2 px-4">24h</th>
                  </tr>
                </thead>
                <tbody>
                  {allOI.map((row, idx) => (
                    <tr
                      key={row.symbol}
                      className={cn(
                        "border-b border-white/[0.03]",
                        row.symbol === selectedAsset && "bg-accent-blue/5"
                      )}
                    >
                      <td className="py-1.5 px-4 text-text-dim">{idx + 1}</td>
                      <td className="py-1.5 px-3 text-text-primary font-semibold">{row.symbol}</td>
                      <td className="py-1.5 px-3 text-right text-accent-blue">{formatLargeNumber(row.oi)}</td>
                      <td className={cn("py-1.5 px-4 text-right", getChangeColor(row.change24h))}>
                        {formatPercent(row.change24h)}
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
