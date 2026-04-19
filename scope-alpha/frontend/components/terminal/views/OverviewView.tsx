"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useSession } from "next-auth/react";
import { PriceChart, type PriceChartRef } from "@/components/charts/PriceChart";
import { useAnnotationRenderer } from "@/components/charts/AnnotationOverlay";
import { useChartDrawingHandler } from "@/components/charts/ChartDrawingHandler";
import { useIndicatorOverlays } from "@/components/charts/IndicatorOverlays";
import { RSIPane } from "@/components/charts/RSIPane";
import { MACDPane } from "@/components/charts/MACDPane";
import type { SubPaneChartRef } from "@/components/charts/SubPaneChart";
import { DrawingToolbar } from "@/components/terminal/DrawingToolbar";
import { LayersPanel } from "@/components/terminal/LayersPanel";
import { IndicatorsPanel } from "@/components/terminal/IndicatorsPanel";
import { Watchlist } from "@/components/terminal/Watchlist";
import { ChartToolbar } from "@/components/terminal/ChartToolbar";
import { CVDPane } from "@/components/terminal/CVDPane";
import { LiquidationHeatmap } from "@/components/terminal/LiquidationHeatmap";
import { ExchangeNetflowOverlay } from "@/components/terminal/ExchangeNetflowOverlay";
import { useChartToolbar } from "@/lib/chartToolbarStore";
import { DataCell } from "@/components/ui/DataCell";
import { GlassCard } from "@/components/ui/GlassCard";
import { useAppStore } from "@/lib/store";
import { useAnnotationStore } from "@/lib/annotationStore";
import { useIndicatorStore } from "@/lib/indicatorStore";
import { useHydrated } from "@/lib/useHydrated";
import { MOCK_INSTRUMENTS } from "@/lib/mockData";
import { formatFundingRate, formatLargeNumber, formatPercent } from "@/lib/utils";
import {
  useLiveCandles,
  useLiveFundingData,
  useLiveOIData,
  useLiveHealthScore,
  useLiveTickers,
} from "@/hooks/useLiveTerminalData";
import type { Annotation } from "@/lib/annotations";

const LOCAL_LAYERS = [
  { id: "local-user", name: "My Annotations", color: "#00D4AA", annotationCount: 0 },
];

export function OverviewView() {
  const selectedAsset = useAppStore((s) => s.selectedAsset);
  const selectedTimeframe = useAppStore((s) => s.selectedTimeframe);
  const { data: session } = useSession();
  const hydrated = useHydrated();
  const chartRef = useRef<PriceChartRef>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const rsiPaneRef = useRef<SubPaneChartRef>(null);
  const macdPaneRef = useRef<SubPaneChartRef>(null);
  const { addAnnotation, removeAnnotation, annotations } = useAnnotationStore();
  const indicators = useIndicatorStore((s) => s.indicators);

  const { data: candles, isLoading: chartLoading } = useLiveCandles();
  const funding = useLiveFundingData();
  const oi = useLiveOIData();
  const health = useLiveHealthScore();
  const liveTickers = useLiveTickers();

  const watchlistData = useMemo(() => {
    return MOCK_INSTRUMENTS.map((inst) => {
      const ticker = liveTickers[inst.symbol + "USDT"];
      if (ticker) {
        return {
          ...inst,
          price: ticker.lastPrice,
          change24h: ticker.priceChangePercent24h,
          volume24h: ticker.volume24h,
        };
      }
      return inst;
    });
  }, [liveTickers]);

  const handleAnnotationCreated = useCallback(
    (annotationData: Omit<Annotation, "id" | "createdAt" | "updatedAt" | "expiresAt">) => {
      const annotation: Annotation = {
        ...annotationData,
        id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        analystId: session?.user?.id || "local-user",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        expiresAt: null,
      };
      addAnnotation(annotation);
    },
    [addAnnotation, session?.user?.id],
  );

  const handleAnnotationDeleted = useCallback(
    (id: string) => {
      removeAnnotation(id);
    },
    [removeAnnotation],
  );

  useAnnotationRenderer({
    chart: chartRef.current?.chart || null,
    series: chartRef.current?.series || null,
    containerRef: chartContainerRef,
  });

  useChartDrawingHandler({
    chart: chartRef.current?.chart || null,
    series: chartRef.current?.series || null,
    containerRef: chartContainerRef,
    assetSymbol: selectedAsset,
    timeframe: selectedTimeframe,
    onAnnotationCreated: handleAnnotationCreated,
    onAnnotationDeleted: handleAnnotationDeleted,
  });

  useIndicatorOverlays({
    chart: chartRef.current?.chart || null,
    candles,
  });

  const activeRsi = useMemo(
    () => indicators.find((i) => i.kind === "rsi" && i.visible) ?? null,
    [indicators],
  );
  const activeMacd = useMemo(
    () => indicators.find((i) => i.kind === "macd" && i.visible) ?? null,
    [indicators],
  );

  useEffect(() => {
    const main = chartRef.current?.chart;
    if (!main) return;
    const handler = (range: unknown) => {
      if (!range) return;
      try {
        rsiPaneRef.current?.chart?.timeScale().setVisibleLogicalRange(range as never);
      } catch {
        /* pane unmounted */
      }
      try {
        macdPaneRef.current?.chart?.timeScale().setVisibleLogicalRange(range as never);
      } catch {
        /* pane unmounted */
      }
    };
    main.timeScale().subscribeVisibleLogicalRangeChange(handler);
    return () => {
      try {
        main.timeScale().unsubscribeVisibleLogicalRangeChange(handler);
      } catch {
        /* chart disposed */
      }
    };
  }, [activeRsi?.id, activeMacd?.id]);

  if (!hydrated) {
    return (
      <div className="h-full flex items-center justify-center">
        <div
          className="w-8 h-8 border-2 border-t-[var(--accent-green)] rounded-full"
          style={{
            borderColor: "var(--glass-border)",
            borderTopColor: "var(--accent-green)",
            animation: "spin 1s linear infinite",
          }}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-2">
      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-2 shrink-0">
        <GlassCard noPadding glow="green">
          <DataCell
            label="Health Score"
            value={health.score.toString()}
            subtitle={health.regime}
            color={
              health.score >= 70
                ? "var(--data-green)"
                : health.score >= 50
                  ? "var(--text-muted)"
                  : health.score >= 30
                    ? "var(--data-yellow)"
                    : "var(--data-red)"
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

      {/* Drawing toolbar + chart toolbar (everyone) */}
      <div className="shrink-0 flex items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <DrawingToolbar />
          <span
            className="text-[10px] font-mono"
            style={{ color: "var(--text-muted)" }}
          >
            {annotations.filter((a) => a.assetSymbol === selectedAsset).length}{" "}
            annotations
          </span>
        </div>
        <ChartToolbar />
      </div>

      {/* Chart + right sidebar */}
      <div className="flex-1 flex gap-2 min-h-0">
        <GlassCard noPadding className="flex-[2] min-h-0 overflow-hidden flex flex-col">
          <div className="flex-1 relative min-h-0" ref={chartContainerRef}>
            <PriceChart ref={chartRef} data={candles} loading={chartLoading} />
            <LiquidationHeatmap asset={selectedAsset} />
          </div>
          {activeRsi && (
            <div
              className="shrink-0 relative"
              style={{ borderTop: "1px solid var(--glass-border)" }}
            >
              <span
                className="absolute top-1 left-2 z-10 text-[10px] font-mono"
                style={{ color: "var(--text-muted)" }}
              >
                RSI {activeRsi.params.period}
              </span>
              <RSIPane ref={rsiPaneRef} inst={activeRsi} candles={candles} />
            </div>
          )}
          {activeMacd && (
            <div
              className="shrink-0 relative"
              style={{ borderTop: "1px solid var(--glass-border)" }}
            >
              <span
                className="absolute top-1 left-2 z-10 text-[10px] font-mono"
                style={{ color: "var(--text-muted)" }}
              >
                MACD {activeMacd.params.fast}/{activeMacd.params.slow}/{activeMacd.params.signal}
              </span>
              <MACDPane ref={macdPaneRef} inst={activeMacd} candles={candles} />
            </div>
          )}
        </GlassCard>

        <div className="w-[360px] shrink-0 flex flex-col gap-2 min-h-0">
          <GlassCard noPadding className="shrink-0">
            <LayersPanel layers={LOCAL_LAYERS} />
          </GlassCard>
          <GlassCard noPadding className="shrink-0">
            <IndicatorsPanel />
          </GlassCard>
          <GlassCard noPadding className="flex-1 min-h-0 overflow-hidden">
            <Watchlist data={watchlistData} />
          </GlassCard>
        </div>
      </div>
      <CVDPaneGated />
      <ExchangeNetflowPaneGated />
    </div>
  );
}

/** Only mount CVDPane when the toolbar toggle is on. Avoids wasted fetches. */
function CVDPaneGated() {
  const showCVD = useChartToolbar((s) => s.showCVD);
  if (!showCVD) return null;
  return <CVDPane />;
}

/**
 * Phase 5 Slice 2: exchange-netflow strip. Only mounts for BTC/ETH when the
 * toolbar toggle is on. The overlay itself handles inert-mode (provider off,
 * data missing) with a muted inline card — no full banner.
 */
function ExchangeNetflowPaneGated() {
  const show = useChartToolbar((s) => s.showExchangeNetflow);
  const selectedAsset = useAppStore((s) => s.selectedAsset);
  if (!show) return null;
  if (selectedAsset !== "BTC" && selectedAsset !== "ETH") return null;
  return <ExchangeNetflowOverlay asset={selectedAsset} />;
}
