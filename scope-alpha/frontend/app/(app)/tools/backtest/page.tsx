"use client";

import { useState } from "react";
import { Play, AlertCircle } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { ConditionBuilder } from "@/components/tools/backtest/ConditionBuilder";
import { BacktestStatsPanel } from "@/components/tools/backtest/BacktestStats";
import { EquityCurve } from "@/components/tools/backtest/EquityCurve";
import { MonthlyHeatmap } from "@/components/tools/backtest/MonthlyHeatmap";
import { TradeLog } from "@/components/tools/backtest/TradeLog";
import { useBacktest } from "@/hooks/useBacktest";
import type { BacktestCondition } from "@/lib/analytics/backtest-engine";

const ASSETS = ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "AVAX", "LINK", "ARB", "OP"];

const inputStyle = {
  background: "var(--glass-bg)",
  border: "1px solid var(--glass-border)",
  color: "var(--text-primary)",
  outline: "none",
  borderRadius: "var(--radius-sm, 4px)",
};

export default function BacktestPage() {
  const { result, isLoading, error, run } = useBacktest();

  const [asset, setAsset] = useState("BTC");
  const [from, setFrom] = useState("2023-01-01");
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [direction, setDirection] = useState<"long" | "short">("long");
  const [entry, setEntry] = useState<BacktestCondition[]>([
    { field: "healthScore", operator: "<", value: 40 },
  ]);
  const [exitConds, setExitConds] = useState<BacktestCondition[]>([
    { field: "healthScore", operator: ">", value: 65 },
  ]);
  const [stopLossPct, setStopLossPct] = useState<string>("10");
  const [takeProfitPct, setTakeProfitPct] = useState<string>("20");
  const [capital, setCapital] = useState<string>("10000");

  function handleRun() {
    run({
      asset,
      from,
      to,
      direction,
      entry,
      exit: exitConds,
      stopLossPct: stopLossPct ? parseFloat(stopLossPct) : undefined,
      takeProfitPct: takeProfitPct ? parseFloat(takeProfitPct) : undefined,
      initialCapital: parseFloat(capital) || 10000,
    });
  }

  return (
    <div className="h-full flex flex-col gap-4 p-4 overflow-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold font-display" style={{ color: "var(--text-primary)" }}>
          Strategy Backtester
        </h1>
        <p className="text-xs font-mono mt-0.5" style={{ color: "var(--text-muted)" }}>
          Visual strategy builder — no coding required. Daily resolution, long/short.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-4 flex-1">
        {/* ── Left: Builder ── */}
        <div className="space-y-3">
          {/* Config */}
          <GlassCard>
            <div className="space-y-3">
              <p className="text-[10px] uppercase tracking-wider font-mono font-semibold" style={{ color: "var(--text-muted)" }}>
                Configuration
              </p>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>Asset</label>
                  <select value={asset} onChange={(e) => setAsset(e.target.value)} className="w-full px-2 py-1.5 text-xs font-mono" style={inputStyle}>
                    {ASSETS.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>Direction</label>
                  <select value={direction} onChange={(e) => setDirection(e.target.value as "long" | "short")} className="w-full px-2 py-1.5 text-xs font-mono" style={inputStyle}>
                    <option value="long">Long</option>
                    <option value="short">Short</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>From</label>
                  <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full px-2 py-1.5 text-xs font-mono" style={inputStyle} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>To</label>
                  <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full px-2 py-1.5 text-xs font-mono" style={inputStyle} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>Capital ($)</label>
                  <input type="number" value={capital} onChange={(e) => setCapital(e.target.value)} className="w-full px-2 py-1.5 text-xs font-mono" style={inputStyle} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>Stop Loss %</label>
                  <input type="number" value={stopLossPct} onChange={(e) => setStopLossPct(e.target.value)} placeholder="—" className="w-full px-2 py-1.5 text-xs font-mono" style={inputStyle} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>Take Profit %</label>
                  <input type="number" value={takeProfitPct} onChange={(e) => setTakeProfitPct(e.target.value)} placeholder="—" className="w-full px-2 py-1.5 text-xs font-mono" style={inputStyle} />
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Entry conditions */}
          <GlassCard>
            <ConditionBuilder label="Entry Conditions" conditions={entry} onChange={setEntry} />
          </GlassCard>

          {/* Exit conditions */}
          <GlassCard>
            <ConditionBuilder label="Exit Conditions" conditions={exitConds} onChange={setExitConds} />
          </GlassCard>

          {/* Run button */}
          <button
            onClick={handleRun}
            disabled={isLoading || entry.length === 0}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[var(--radius-lg)] text-sm font-mono font-semibold transition-all disabled:opacity-50"
            style={{ background: "var(--accent-blue)", color: "#000" }}
          >
            <Play size={14} />
            {isLoading ? "Running…" : "Run Backtest"}
          </button>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg text-xs font-mono" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "var(--data-red)" }}>
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* Disclaimer */}
          <p className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
            Results are hypothetical and based on historical data. Past performance is not indicative of future results. Not financial advice.
          </p>
        </div>

        {/* ── Right: Results ── */}
        <div className="space-y-3">
          {!result && !isLoading && (
            <GlassCard>
              <div className="py-12 text-center space-y-2">
                <p className="text-sm font-mono" style={{ color: "var(--text-muted)" }}>
                  Configure a strategy and click Run Backtest to see results.
                </p>
                <p className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>
                  Requires historical data from the cron pipeline (CandleHistory, HealthScoreSnapshot, etc.).
                </p>
              </div>
            </GlassCard>
          )}

          {isLoading && (
            <GlassCard>
              <div className="py-12 text-center">
                <p className="text-sm font-mono" style={{ color: "var(--text-muted)" }}>
                  Running backtest…
                </p>
              </div>
            </GlassCard>
          )}

          {result && !isLoading && (
            <>
              <BacktestStatsPanel stats={result.stats} />
              <EquityCurve data={result.equity} />
              <MonthlyHeatmap monthlyReturns={result.monthlyReturns} />
              <TradeLog trades={result.trades} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
