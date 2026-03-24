"use client";
import { useMemo } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { DataCell } from "@/components/ui/DataCell";
import { Badge } from "@/components/ui/Badge";
import { useAppStore } from "@/lib/store";
import { useHydrated } from "@/lib/useHydrated";
import { MOCK_INSTRUMENTS } from "@/lib/mockData";
import { generateOIData } from "@/lib/mockData";
import { formatLargeNumber, formatPercent, cn, getChangeColor } from "@/lib/utils";
import { useLiveOIData } from "@/hooks/useLiveTerminalData";

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

function ExchangeBar({ data, total }: { data: { exchange: string; value: number }[]; total: number }) {
  const colors: Record<string, string> = {
    Binance: "#F0B90B",
    OKX: "var(--text-primary)",
    Bybit: "#F7A600",
  };
  return (
    <div>
      <div className="h-8 rounded-[var(--radius-sm)] overflow-hidden flex relative" style={{ background: "var(--glass-bg)" }}>
        {data.map((ex) => {
          const pct = (ex.value / total) * 100;
          return (
            <div
              key={ex.exchange}
              className="relative flex items-center justify-center transition-all group"
              style={{
                width: `${pct}%`,
                backgroundColor: `${colors[ex.exchange] || "#6B7280"}20`,
                borderRight: "1px solid var(--glass-border)",
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
            <span className="text-[10px] font-mono" style={{ color: "var(--text-secondary)" }}>{ex.exchange}</span>
            <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{formatLargeNumber(ex.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OpenInterestPage() {
  const { selectedAsset } = useAppStore();
  const hydrated = useHydrated();

  const oiData = useLiveOIData();
  const instrument = useMemo(
    () => MOCK_INSTRUMENTS.find((i) => i.symbol === selectedAsset) ?? MOCK_INSTRUMENTS[0],
    [selectedAsset]
  );
  const historyValues = useMemo(() => oiData.history.map((h) => h.value), [oiData]);

  const oiMomentum = useMemo(() => {
    const hist = oiData.history;
    if (hist.length < 48) return 0;
    const recent = hist.slice(-24).reduce((s, h) => s + h.value, 0) / 24;
    const prior = hist.slice(-48, -24).reduce((s, h) => s + h.value, 0) / 24;
    return prior > 0 ? ((recent - prior) / prior) * 100 : 0;
  }, [oiData]);

  const momentumLabel = oiMomentum > 3 ? "SURGING" : oiMomentum > 1 ? "RISING" : oiMomentum > -1 ? "FLAT" : oiMomentum > -3 ? "DECLINING" : "PLUNGING";
  const momentumVariant = oiMomentum > 3 ? "green" as const : oiMomentum > 1 ? "green" as const : oiMomentum > -1 ? "gray" as const : oiMomentum > -3 ? "yellow" as const : "red" as const;

  const correlation = useMemo(() => {
    const oiChange = oiData.change24h;
    const priceChange = instrument.change24h;
    const seed = Math.abs(oiChange * 1000 + priceChange * 100) % 1;
    if (Math.sign(oiChange) === Math.sign(priceChange)) return 0.65 + seed * 0.25;
    return -0.3 + seed * 0.4;
  }, [oiData, instrument]);

  const exchangeTotal = oiData.byExchange.reduce((s, e) => s + e.value, 0);

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
        <div className="w-8 h-8 border-2 rounded-full" style={{ borderColor: "var(--glass-border)", borderTopColor: "var(--data-blue)", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-3 overflow-auto">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold font-display" style={{ color: "var(--text-primary)" }}>Open Interest</h1>
          <Badge variant="blue">{selectedAsset}</Badge>
        </div>
        <div className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
          Aggregate Futures Open Interest
        </div>
      </div>

      <div className="grid grid-cols-5 gap-3 shrink-0">
        <GlassCard glow="blue" interactive className="col-span-2">
          <div className="text-[10px] font-mono uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
            Total Open Interest
          </div>
          <div className="text-3xl font-bold font-mono" style={{ color: "var(--data-blue)" }}>
            {formatLargeNumber(oiData.aggregateOI)}
          </div>
          <div className="flex items-center gap-3 mt-2">
            <span className={cn("text-sm font-mono font-semibold", getChangeColor(oiData.change24h))}>
              {formatPercent(oiData.change24h)} <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>24h</span>
            </span>
            <span className={cn("text-sm font-mono font-semibold", getChangeColor(oiData.change4h))}>
              {formatPercent(oiData.change4h)} <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>4h</span>
            </span>
            <span className={cn("text-sm font-mono font-semibold", getChangeColor(oiData.change1h))}>
              {formatPercent(oiData.change1h)} <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>1h</span>
            </span>
          </div>
        </GlassCard>

        <DataCell label="OI / Market Cap" value={((oiData.aggregateOI / instrument.marketCap) * 100).toFixed(2) + "%"} subtitle="Leverage ratio proxy" color="var(--data-blue)" />
        <DataCell label="Momentum" value={momentumLabel} subtitle={formatPercent(oiMomentum)} color={oiMomentum > 1 ? "var(--data-green)" : oiMomentum < -1 ? "var(--data-red)" : "var(--text-muted)"} />
        <DataCell label="OI vs Price Corr." value={correlation.toFixed(2)} subtitle={correlation > 0.5 ? "Strong positive" : correlation > 0 ? "Weak positive" : "Diverging"} color={correlation > 0.5 ? "var(--data-green)" : correlation > 0 ? "var(--data-yellow)" : "var(--data-red)"} />
      </div>

      <div className="flex-1 flex gap-3 min-h-0">
        <GlassCard className="flex-[3] flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>OI History &mdash; 7 Day</span>
            <Badge variant={momentumVariant}>{momentumLabel}</Badge>
          </div>
          <div className="flex-1 min-h-0 flex flex-col justify-center">
            <MiniChart data={historyValues} color="var(--data-blue)" height={200} />
          </div>
          <div className="flex justify-between text-[9px] font-mono mt-2" style={{ color: "var(--text-muted)" }}>
            <span>7d ago</span><span>5d</span><span>3d</span><span>1d</span><span>Now</span>
          </div>
        </GlassCard>

        <div className="flex-[2] flex flex-col gap-3 min-h-0">
          <GlassCard className="shrink-0">
            <div className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>OI by Exchange</div>
            <ExchangeBar data={oiData.byExchange} total={exchangeTotal} />
          </GlassCard>

          <GlassCard noPadding className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <div className="px-4 py-3 shrink-0" style={{ borderBottom: "1px solid var(--glass-border)" }}>
              <span className="text-xs font-mono uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>OI Leaderboard</span>
            </div>
            <div className="overflow-auto flex-1">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="sticky top-0 z-10" style={{ background: "var(--glass-bg-hover)", borderBottom: "1px solid var(--glass-border)" }}>
                    <th className="text-left py-2 px-4 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>#</th>
                    <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Asset</th>
                    <th className="text-right py-2 px-3 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>OI</th>
                    <th className="text-right py-2 px-4 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>24h</th>
                  </tr>
                </thead>
                <tbody>
                  {allOI.map((row, idx) => (
                    <tr key={row.symbol} style={{ borderBottom: "1px solid var(--glass-border)", background: row.symbol === selectedAsset ? "rgba(59, 130, 246, 0.06)" : "transparent" }}>
                      <td className="py-1.5 px-4" style={{ color: "var(--text-muted)" }}>{idx + 1}</td>
                      <td className="py-1.5 px-3 font-semibold" style={{ color: "var(--text-primary)" }}>{row.symbol}</td>
                      <td className="py-1.5 px-3 text-right" style={{ color: "var(--data-blue)" }}>{formatLargeNumber(row.oi)}</td>
                      <td className={cn("py-1.5 px-4 text-right", getChangeColor(row.change24h))}>{formatPercent(row.change24h)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
