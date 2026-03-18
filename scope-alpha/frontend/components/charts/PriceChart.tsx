"use client";
import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { createChart, type IChartApi, type ISeriesApi, ColorType } from "lightweight-charts";
import { useAppStore } from "@/lib/store";

interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface PriceChartProps {
  data: CandleData[];
  loading?: boolean;
}

export interface PriceChartRef {
  chart: IChartApi | null;
  series: ISeriesApi<"Candlestick"> | null;
  container: HTMLDivElement | null;
}

export const PriceChart = forwardRef<PriceChartRef, PriceChartProps>(
  function PriceChart({ data, loading }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
    const { selectedAsset, selectedTimeframe } = useAppStore();

    useImperativeHandle(ref, () => ({
      get chart() { return chartRef.current; },
      get series() { return candleSeriesRef.current; },
      get container() { return containerRef.current; },
    }));

    useEffect(() => {
      if (!containerRef.current) return;

      const isDark = document.documentElement.getAttribute("data-theme") === "dark";
      const gridColor = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.05)";
      const textColor = isDark ? "#64748B" : "#94a3b8";
      const crosshairColor = isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)";
      const borderColor = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)";

      const chart = createChart(containerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: "transparent" },
          textColor,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
        },
        grid: {
          vertLines: { color: gridColor },
          horzLines: { color: gridColor },
        },
        crosshair: {
          vertLine: { color: crosshairColor, width: 1, style: 2 },
          horzLine: { color: crosshairColor, width: 1, style: 2 },
        },
        rightPriceScale: {
          borderColor,
          scaleMargins: { top: 0.1, bottom: 0.25 },
        },
        timeScale: {
          borderColor,
          timeVisible: true,
          secondsVisible: false,
        },
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });

      const candleSeries = chart.addCandlestickSeries({
        upColor: "#10B981",
        downColor: "#EF4444",
        borderUpColor: "#10B981",
        borderDownColor: "#EF4444",
        wickUpColor: "#10B981",
        wickDownColor: "#EF4444",
      });

      const volumeSeries = chart.addHistogramSeries({
        priceFormat: { type: "volume" },
        priceScaleId: "volume",
      });

      chart.priceScale("volume").applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });

      chartRef.current = chart;
      candleSeriesRef.current = candleSeries;
      volumeSeriesRef.current = volumeSeries;

      const handleResize = () => {
        if (containerRef.current) {
          chart.applyOptions({
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight,
          });
        }
      };

      const observer = new MutationObserver(() => {
        const nowDark = document.documentElement.getAttribute("data-theme") === "dark";
        const g = nowDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.05)";
        const t = nowDark ? "#64748B" : "#94a3b8";
        const c = nowDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)";
        const b = nowDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)";
        chart.applyOptions({
          layout: { textColor: t },
          grid: { vertLines: { color: g }, horzLines: { color: g } },
          crosshair: { vertLine: { color: c }, horzLine: { color: c } },
          rightPriceScale: { borderColor: b },
          timeScale: { borderColor: b },
        });
      });
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

      window.addEventListener("resize", handleResize);
      return () => {
        window.removeEventListener("resize", handleResize);
        observer.disconnect();
        chart.remove();
        chartRef.current = null;
        candleSeriesRef.current = null;
        volumeSeriesRef.current = null;
      };
    }, []);

    useEffect(() => {
      if (!candleSeriesRef.current || !volumeSeriesRef.current || !data.length) return;

      const candleData = data.map((d) => ({
        time: d.time as any,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }));

      const volumeData = data.map((d) => ({
        time: d.time as any,
        value: d.volume,
        color: d.close >= d.open ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)",
      }));

      candleSeriesRef.current.setData(candleData);
      volumeSeriesRef.current.setData(volumeData);
      chartRef.current?.timeScale().fitContent();
    }, [data]);

    if (loading) {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 rounded-full" style={{ borderColor: "var(--glass-border)", borderTopColor: "var(--accent-green)", animation: "spin 1s linear infinite" }} />
            <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>Loading {selectedAsset} chart...</span>
          </div>
        </div>
      );
    }

    return (
      <div className="relative w-full h-full">
        <div className="absolute top-2 left-3 z-10 flex items-center gap-2">
          <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{selectedAsset}/USDT</span>
          <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{selectedTimeframe}</span>
        </div>
        <div ref={containerRef} className="w-full h-full" />
      </div>
    );
  }
);
