"use client";
import { useMemo, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { PriceChart, type PriceChartRef } from "@/components/charts/PriceChart";
import { useAnnotationRenderer } from "@/components/charts/AnnotationOverlay";
import { useChartDrawingHandler } from "@/components/charts/ChartDrawingHandler";
import { DrawingToolbar } from "@/components/terminal/DrawingToolbar";
import { LayersPanel } from "@/components/terminal/LayersPanel";
import { SignalsPanel } from "@/components/terminal/SignalsPanel";
import { NewSignalForm } from "@/components/terminal/NewSignalForm";
import { Watchlist } from "@/components/terminal/Watchlist";
import { DataCell } from "@/components/ui/DataCell";
import { GlassCard } from "@/components/ui/GlassCard";
import Link from "next/link";
import { useAppStore } from "@/lib/store";
import { useAnnotationStore } from "@/lib/annotationStore";
import { useSignalStore } from "@/lib/signalStore";
import { useHydrated } from "@/lib/useHydrated";
import { MOCK_INSTRUMENTS, generateCandles, generateFundingData, generateOIData, generateHealthScore } from "@/lib/mockData";
import { formatFundingRate, formatLargeNumber, formatPercent } from "@/lib/utils";
import type { Annotation } from "@/lib/annotations";

// Mock analyst layers for demo
const MOCK_LAYERS = [
  { id: "local-analyst", name: "My Annotations", color: "#00D4AA", annotationCount: 0 },
];

export default function TerminalDashboard() {
  const { selectedAsset, selectedTimeframe } = useAppStore();
  const { data: session } = useSession();
  const hydrated = useHydrated();
  const chartRef = useRef<PriceChartRef>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const { addAnnotation, removeAnnotation, annotations } = useAnnotationStore();
  const { showNewSignalForm } = useSignalStore();

  const isAnalyst = session?.user?.role === "analyst";

  const candles = useMemo(() => {
    const instrument = MOCK_INSTRUMENTS.find(i => i.symbol === selectedAsset);
    const basePrice = instrument?.price || 67000;
    const count = selectedTimeframe === "1D" ? 90 : selectedTimeframe === "4H" ? 180 : 360;
    return generateCandles(basePrice, count);
  }, [selectedAsset, selectedTimeframe]);

  const funding = useMemo(() => generateFundingData(selectedAsset), [selectedAsset]);
  const oi = useMemo(() => generateOIData(selectedAsset), [selectedAsset]);
  const health = useMemo(() => generateHealthScore(selectedAsset), [selectedAsset]);

  const handleAnnotationCreated = useCallback(
    (annotationData: Omit<Annotation, "id" | "createdAt" | "updatedAt" | "expiresAt">) => {
      const annotation: Annotation = {
        ...annotationData,
        id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        analystId: session?.user?.id || "local-analyst",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        expiresAt: null,
      };
      addAnnotation(annotation);
    },
    [addAnnotation, session?.user?.id]
  );

  const handleAnnotationDeleted = useCallback(
    (id: string) => {
      removeAnnotation(id);
    },
    [removeAnnotation]
  );

  // Annotation rendering hook
  useAnnotationRenderer({
    chart: chartRef.current?.chart || null,
    series: chartRef.current?.series || null,
    containerRef: chartContainerRef,
  });

  // Chart drawing handler hook
  useChartDrawingHandler({
    chart: chartRef.current?.chart || null,
    series: chartRef.current?.series || null,
    containerRef: chartContainerRef,
    assetSymbol: selectedAsset,
    timeframe: selectedTimeframe,
    onAnnotationCreated: handleAnnotationCreated,
    onAnnotationDeleted: handleAnnotationDeleted,
  });

  if (!hydrated) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-t-[var(--accent-green)] rounded-full" style={{ borderColor: "var(--glass-border)", borderTopColor: "var(--accent-green)", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-2">
      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-2 shrink-0">
        <GlassCard noPadding glow="green">
          <DataCell
            label="Health Score"
            value={health.score.toString()}
            subtitle={health.regime}
            color={
              health.score >= 70 ? "var(--data-green)" :
              health.score >= 50 ? "var(--text-muted)" :
              health.score >= 30 ? "var(--data-yellow)" : "var(--data-red)"
            }
          />
        </GlassCard>
        <GlassCard noPadding glow="green">
          <DataCell
            label="Funding Rate"
            value={formatFundingRate(funding.currentRate)}
            subtitle="8h avg"
            color={funding.currentRate > 0 ? "var(--data-green)" : "var(--data-red)"}
          />
        </GlassCard>
        <GlassCard noPadding glow="blue">
          <DataCell
            label="Open Interest"
            value={formatLargeNumber(oi.aggregateOI)}
            change={oi.change24h}
            color="var(--data-blue)"
          />
        </GlassCard>
        <GlassCard noPadding glow="purple">
          <DataCell
            label="Basis (Ann.)"
            value={formatPercent(funding.annualizedCarry, false)}
            subtitle="perp vs spot"
            color="var(--data-purple)"
          />
        </GlassCard>
      </div>

      {/* Drawing Toolbar (analysts only) */}
      {isAnalyst && (
        <div className="shrink-0 flex items-center gap-2">
          <DrawingToolbar />
          <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
            {annotations.filter(a => a.assetSymbol === selectedAsset).length} annotations
          </span>
        </div>
      )}

      {/* Chart + Sidebar */}
      <div className="flex-1 flex gap-2 min-h-0">
        {/* Chart */}
        <GlassCard noPadding className="flex-[2] min-h-0 overflow-hidden">
          <div className="h-full relative pt-2" ref={chartContainerRef}>
            <PriceChart ref={chartRef} data={candles} />
          </div>
        </GlassCard>

        {/* Right Sidebar */}
        <div className="w-[360px] shrink-0 flex flex-col gap-2 min-h-0">
          {/* New Signal Form (overlay) */}
          {isAnalyst && showNewSignalForm && (
            <NewSignalForm />
          )}

          {/* Signals Panel (analysts) */}
          {isAnalyst && !showNewSignalForm && (
            <GlassCard noPadding className="shrink-0 max-h-[280px] overflow-hidden">
              <SignalsPanel />
            </GlassCard>
          )}

          {/* Layers Panel */}
          <GlassCard noPadding className="shrink-0">
            <LayersPanel layers={MOCK_LAYERS} />
          </GlassCard>

          {/* Watchlist */}
          <GlassCard noPadding className="flex-1 min-h-0 overflow-hidden">
            <Watchlist data={MOCK_INSTRUMENTS} />
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
