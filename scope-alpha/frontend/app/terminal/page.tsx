"use client";
import { useMemo } from "react";
import { PriceChart } from "@/components/charts/PriceChart";
import { Watchlist } from "@/components/terminal/Watchlist";
import { DataCell } from "@/components/ui/DataCell";
import { NeuCard } from "@/components/ui/NeuCard";
import { useAppStore } from "@/lib/store";
import { useHydrated } from "@/lib/useHydrated";
import { MOCK_INSTRUMENTS, generateCandles, generateFundingData, generateOIData, generateHealthScore } from "@/lib/mockData";
import { formatFundingRate, formatLargeNumber, formatPercent } from "@/lib/utils";

export default function TerminalDashboard() {
  const { selectedAsset, selectedTimeframe } = useAppStore();
  const hydrated = useHydrated();

  const candles = useMemo(() => {
    const instrument = MOCK_INSTRUMENTS.find(i => i.symbol === selectedAsset);
    const basePrice = instrument?.price || 67000;
    const count = selectedTimeframe === "1D" ? 90 : selectedTimeframe === "4H" ? 180 : 360;
    return generateCandles(basePrice, count);
  }, [selectedAsset, selectedTimeframe]);

  const funding = useMemo(() => generateFundingData(selectedAsset), [selectedAsset]);
  const oi = useMemo(() => generateOIData(selectedAsset), [selectedAsset]);
  const health = useMemo(() => generateHealthScore(selectedAsset), [selectedAsset]);

  if (!hydrated) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent-green/30 border-t-accent-green rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-3 shrink-0">
        <DataCell
          label="Health Score"
          value={health.score.toString()}
          subtitle={health.regime}
          color={
            health.score >= 70 ? "#10B981" :
            health.score >= 50 ? "#6B7280" :
            health.score >= 30 ? "#F59E0B" : "#EF4444"
          }
        />
        <DataCell
          label="Funding Rate"
          value={formatFundingRate(funding.currentRate)}
          subtitle="8h avg"
          color={funding.currentRate > 0 ? "#10B981" : "#EF4444"}
        />
        <DataCell
          label="Open Interest"
          value={formatLargeNumber(oi.aggregateOI)}
          change={oi.change24h}
          color="#3B82F6"
        />
        <DataCell
          label="Basis (Ann.)"
          value={formatPercent(funding.annualizedCarry, false)}
          subtitle="perp vs spot"
          color="#8B5CF6"
        />
      </div>

      {/* Chart + Watchlist */}
      <div className="flex-1 flex gap-3 min-h-0">
        {/* Chart */}
        <NeuCard noPadding className="flex-[2] min-h-0 overflow-hidden">
          <div className="h-full">
            <PriceChart data={candles} />
          </div>
        </NeuCard>

        {/* Watchlist */}
        <NeuCard noPadding className="w-[380px] shrink-0 min-h-0 overflow-hidden">
          <Watchlist data={MOCK_INSTRUMENTS} />
        </NeuCard>
      </div>
    </div>
  );
}
