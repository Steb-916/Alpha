"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { DataCell } from "@/components/ui/DataCell";
import { useAppStore } from "@/lib/store";
import { useCrossExchange } from "@/hooks/useCrossExchange";
import {
  cn,
  formatFundingRate,
  formatLargeNumber,
  formatPercent,
  formatPrice,
} from "@/lib/utils";

function zScoreColor(z: number): string {
  const abs = Math.abs(z);
  if (abs >= 2) return "var(--data-red)";
  if (abs >= 1) return "var(--data-yellow)";
  return "var(--text-secondary)";
}

export function CrossExchangeView() {
  const selectedAsset = useAppStore((s) => s.selectedAsset);
  const { data, isLoading } = useCrossExchange(selectedAsset);

  if (isLoading && !data) {
    return (
      <div className="h-full flex items-center justify-center">
        <div
          className="w-8 h-8 border-2 rounded-full"
          style={{
            borderColor: "var(--glass-border)",
            borderTopColor: "var(--accent-green)",
            animation: "spin 1s linear infinite",
          }}
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="text-sm font-mono" style={{ color: "var(--text-muted)" }}>
          Cross-exchange data unavailable.
        </span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-3 overflow-auto">
      <div className="flex items-center justify-between shrink-0">
        <h1
          className="text-xl font-bold font-display"
          style={{ color: "var(--text-primary)" }}
        >
          Cross-Exchange — {data.asset}
        </h1>
        <span
          className="text-[10px] font-mono uppercase tracking-widest"
          style={{ color: "var(--text-muted)" }}
        >
          Binance vs Bybit
        </span>
      </div>

      {/* Price row */}
      <div className="grid grid-cols-3 gap-3 shrink-0">
        <GlassCard>
          <div
            className="text-[10px] font-mono uppercase tracking-wider mb-1"
            style={{ color: "var(--text-muted)" }}
          >
            Binance Price
          </div>
          <div
            className="text-xl font-bold font-mono"
            style={{ color: "var(--data-blue)" }}
          >
            {formatPrice(data.price.binance)}
          </div>
        </GlassCard>
        <GlassCard>
          <div
            className="text-[10px] font-mono uppercase tracking-wider mb-1"
            style={{ color: "var(--text-muted)" }}
          >
            Bybit Price
          </div>
          <div
            className="text-xl font-bold font-mono"
            style={{ color: "var(--accent-green)" }}
          >
            {formatPrice(data.price.bybit)}
          </div>
        </GlassCard>
        <GlassCard>
          <div
            className="text-[10px] font-mono uppercase tracking-wider mb-1"
            style={{ color: "var(--text-muted)" }}
          >
            Price Spread
          </div>
          <div
            className="text-xl font-bold font-mono"
            style={{
              color: zScoreColor(Math.abs(data.price.spreadPct) * 10),
            }}
          >
            {formatPrice(data.price.spread)} ({formatPercent(data.price.spreadPct, true)})
          </div>
        </GlassCard>
      </div>

      {/* Two-column comparison */}
      <div className="grid grid-cols-2 gap-3">
        <GlassCard>
          <div
            className="text-xs font-bold font-mono uppercase tracking-wider mb-3"
            style={{ color: "var(--data-blue)" }}
          >
            Binance
          </div>
          <div className="grid grid-cols-2 gap-2">
            <DataCell
              label="Funding Rate"
              value={formatFundingRate(data.funding.binance.rate)}
              subtitle={`Ann. ${formatPercent(data.funding.binance.annualized, true)}`}
              color={
                data.funding.binance.rate >= 0
                  ? "var(--data-red)"
                  : "var(--data-green)"
              }
            />
            <DataCell
              label="OI"
              value={formatLargeNumber(data.openInterest.binance.oi)}
              subtitle={`${data.openInterest.binanceShare.toFixed(1)}% share`}
              color="var(--data-blue)"
            />
            <DataCell
              label="Liq 24h"
              value={formatLargeNumber(
                data.liquidations24h.binance.long +
                  data.liquidations24h.binance.short,
              )}
              subtitle={`L ${formatLargeNumber(data.liquidations24h.binance.long)} / S ${formatLargeNumber(data.liquidations24h.binance.short)}`}
              color="var(--data-yellow)"
            />
            <DataCell
              label="Basis"
              value={formatPercent(data.basis.binance.basisPct, true)}
              subtitle={`Ann. ${formatPercent(data.basis.binance.annualized, true)}`}
              color="var(--data-purple)"
            />
          </div>
        </GlassCard>

        <GlassCard>
          <div
            className="text-xs font-bold font-mono uppercase tracking-wider mb-3"
            style={{ color: "var(--accent-green)" }}
          >
            Bybit
          </div>
          <div className="grid grid-cols-2 gap-2">
            <DataCell
              label="Funding Rate"
              value={formatFundingRate(data.funding.bybit.rate)}
              subtitle={`Ann. ${formatPercent(data.funding.bybit.annualized, true)}`}
              color={
                data.funding.bybit.rate >= 0
                  ? "var(--data-red)"
                  : "var(--data-green)"
              }
            />
            <DataCell
              label="OI"
              value={formatLargeNumber(data.openInterest.bybit.oi)}
              subtitle={`${data.openInterest.bybitShare.toFixed(1)}% share`}
              color="var(--accent-green)"
            />
            <DataCell
              label="Liq 24h"
              value={formatLargeNumber(
                data.liquidations24h.bybit.long +
                  data.liquidations24h.bybit.short,
              )}
              subtitle={`L ${formatLargeNumber(data.liquidations24h.bybit.long)} / S ${formatLargeNumber(data.liquidations24h.bybit.short)}`}
              color="var(--data-yellow)"
            />
            <DataCell
              label="Basis"
              value={formatPercent(data.basis.bybit.basisPct, true)}
              subtitle={`Ann. ${formatPercent(data.basis.bybit.annualized, true)}`}
              color="var(--data-purple)"
            />
          </div>
        </GlassCard>
      </div>

      {/* Spread analysis */}
      <GlassCard>
        <div
          className="text-xs font-bold font-mono uppercase tracking-wider mb-3"
          style={{ color: "var(--text-muted)" }}
        >
          Spread Analysis
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div
              className="text-[10px] font-mono uppercase tracking-wider mb-1"
              style={{ color: "var(--text-muted)" }}
            >
              Funding Differential
            </div>
            <div className="flex items-baseline gap-2">
              <span
                className="text-lg font-bold font-mono"
                style={{
                  color: zScoreColor(data.funding.differentialZScore),
                }}
              >
                {formatFundingRate(data.funding.differential)}
              </span>
              <span
                className="text-[10px] font-mono"
                style={{ color: "var(--text-muted)" }}
              >
                z: {data.funding.differentialZScore.toFixed(2)}
              </span>
            </div>
            <div
              className="text-[10px] font-mono mt-1"
              style={{ color: "var(--text-muted)" }}
            >
              Ann. {formatPercent(data.funding.differentialAnnualized, true)}
            </div>
          </div>

          <div>
            <div
              className="text-[10px] font-mono uppercase tracking-wider mb-1"
              style={{ color: "var(--text-muted)" }}
            >
              Basis Differential
            </div>
            <div
              className={cn(
                "text-lg font-bold font-mono",
                Math.abs(data.basis.differential) > 0.05
                  ? "text-yellow-400"
                  : "",
              )}
              style={{ color: "var(--text-primary)" }}
            >
              {formatPercent(data.basis.differential, true)}
            </div>
            <div
              className="text-[10px] font-mono mt-1"
              style={{ color: "var(--text-muted)" }}
            >
              Ann. {formatPercent(data.basis.differentialAnnualized, true)}
            </div>
          </div>

          <div>
            <div
              className="text-[10px] font-mono uppercase tracking-wider mb-1"
              style={{ color: "var(--text-muted)" }}
            >
              Arbitrage Yield
            </div>
            <div
              className="text-lg font-bold font-mono"
              style={{ color: "var(--data-yellow)" }}
            >
              {formatPercent(data.funding.arbitrageYield, true)}
            </div>
            <div
              className="text-[10px] font-mono mt-1"
              style={{ color: "var(--text-muted)" }}
            >
              Net annualized (funding delta)
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
