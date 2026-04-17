"use client";
import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
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

interface HoverInfo {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change: number;
}

function formatHoverNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (Math.abs(n) >= 1) return n.toFixed(2);
  return n.toPrecision(4);
}

function formatHoverVolume(v: number): string {
  if (!Number.isFinite(v)) return "—";
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(2) + "B";
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(2) + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(2) + "K";
  return v.toFixed(0);
}

export const PriceChart = forwardRef<PriceChartRef, PriceChartProps>(
  function PriceChart({ data, loading }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
    const dataRef = useRef<CandleData[]>(data);
    const [hover, setHover] = useState<HoverInfo | null>(null);
    const { selectedAsset, selectedTimeframe } = useAppStore();

    // Keep latest data available to the crosshair handler without re-binding
    // subscribeCrosshairMove on every data mutation.
    useEffect(() => {
      dataRef.current = data;
    }, [data]);

    useImperativeHandle(ref, () => ({
      get chart() { return chartRef.current; },
      get series() { return candleSeriesRef.current; },
      get container() { return containerRef.current; },
    }));

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

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
        width: container.clientWidth || 800,
        height: container.clientHeight || 400,
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

      // ResizeObserver handles both the initial layout pass (when the parent
      // flex/grid may not yet have computed real dimensions) and any
      // subsequent parent-driven resize (window resize, sibling panels
      // opening/closing). This replaces the old window.resize listener which
      // missed layout-only changes.
      const resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          chart.applyOptions({ width, height });
        }
      });
      resizeObserver.observe(container);

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

      // Crosshair HUD — surfaces O/H/L/C/V + Chg% for the bar under the cursor.
      const crosshairHandler = (param: any) => {
        const arr = dataRef.current;
        if (!arr.length) {
          setHover(null);
          return;
        }
        // Mouse off the chart: fall back to the latest candle.
        if (!param || param.time === undefined || param.time === null) {
          const last = arr[arr.length - 1];
          setHover({
            time: last.time,
            open: last.open,
            high: last.high,
            low: last.low,
            close: last.close,
            volume: last.volume,
            change: last.open === 0 ? 0 : ((last.close - last.open) / last.open) * 100,
          });
          return;
        }
        const t = param.time as number;
        const bar = arr.find((d) => d.time === t);
        if (!bar) return;
        setHover({
          time: bar.time,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          volume: bar.volume,
          change: bar.open === 0 ? 0 : ((bar.close - bar.open) / bar.open) * 100,
        });
      };
      chart.subscribeCrosshairMove(crosshairHandler);

      return () => {
        resizeObserver.disconnect();
        observer.disconnect();
        try {
          chart.unsubscribeCrosshairMove(crosshairHandler);
        } catch {
          // chart may already be disposed
        }
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

      // Prime the HUD to the most recent candle so the readout isn't empty
      // before the user hovers.
      if (data.length) {
        const last = data[data.length - 1];
        setHover({
          time: last.time,
          open: last.open,
          high: last.high,
          low: last.low,
          close: last.close,
          volume: last.volume,
          change: last.open === 0 ? 0 : ((last.close - last.open) / last.open) * 100,
        });
      }
    }, [data]);

    const changeColor = hover && hover.close >= hover.open ? "var(--positive)" : "var(--negative)";

    return (
      <div className="relative w-full h-full">
        <div className="absolute top-2 left-3 z-10 flex items-center gap-2">
          <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{selectedAsset}/USDT</span>
          <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{selectedTimeframe}</span>
        </div>
        {hover && (
          <div
            data-testid="chart-hud"
            className="absolute top-2 right-3 z-10 flex items-center gap-2 px-2 py-1 rounded font-mono pointer-events-none"
            style={{
              fontSize: "10px",
              background: "var(--glass-bg)",
              border: "1px solid var(--glass-border)",
              backdropFilter: "blur(10px)",
              color: "var(--text-primary)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <span style={{ color: "var(--text-muted)" }}>O</span>
            <span>{formatHoverNumber(hover.open)}</span>
            <span style={{ color: "var(--text-muted)" }}>H</span>
            <span>{formatHoverNumber(hover.high)}</span>
            <span style={{ color: "var(--text-muted)" }}>L</span>
            <span>{formatHoverNumber(hover.low)}</span>
            <span style={{ color: "var(--text-muted)" }}>C</span>
            <span style={{ color: changeColor }}>{formatHoverNumber(hover.close)}</span>
            <span style={{ color: "var(--text-muted)" }}>V</span>
            <span>{formatHoverVolume(hover.volume)}</span>
            <span style={{ color: changeColor }}>
              {hover.change >= 0 ? "+" : ""}
              {hover.change.toFixed(2)}%
            </span>
          </div>
        )}
        {/* Container is rendered unconditionally so the setup effect can
            always bind to a real DOM node. Without this, first-load hit a
            conditional-render-vs-effect race where the spinner branch
            returned early and the chart container never mounted before
            the effect ran. */}
        <div ref={containerRef} className="w-full h-full" />
        {loading && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ background: "rgba(10, 14, 20, 0.4)" }}
          >
            <div className="flex flex-col items-center gap-3">
              <div
                className="w-8 h-8 border-2 rounded-full"
                style={{
                  borderColor: "var(--glass-border)",
                  borderTopColor: "var(--accent-green)",
                  animation: "spin 1s linear infinite",
                }}
              />
              <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                Loading {selectedAsset} chart...
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }
);
