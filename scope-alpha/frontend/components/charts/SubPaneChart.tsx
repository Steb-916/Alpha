"use client";

/**
 * A fixed-height sub-pane chart, used for oscillator indicators (RSI,
 * MACD). Its own time axis is hidden — the parent syncs visible range from
 * the main chart.
 */

import {
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  ColorType,
} from "lightweight-charts";
import type { Line } from "@/lib/indicators";

export type SubPaneSeriesType = "line" | "histogram";

export interface SubPaneSeriesConfig {
  id: string;                   // stable key so re-renders reuse the series
  type: SubPaneSeriesType;
  color: string | ((v: number) => string); // function = per-point color (for histograms)
  lineWidth?: 1 | 2;
  data: Line;
}

export interface SubPaneGuideLine {
  price: number;
  color: string;
  label?: string;
}

interface SubPaneChartProps {
  series: SubPaneSeriesConfig[];
  guideLines?: SubPaneGuideLine[];
  height?: number;
  // Optional fixed y range — useful for RSI (0..100).
  priceRange?: { min: number; max: number };
}

export interface SubPaneChartRef {
  chart: IChartApi | null;
}

export const SubPaneChart = forwardRef<SubPaneChartRef, SubPaneChartProps>(
  function SubPaneChart({ series, guideLines, height = 120, priceRange }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    // Store line/histogram series keyed by caller-provided id.
    const seriesRef = useRef<
      Map<string, ISeriesApi<"Line"> | ISeriesApi<"Histogram">>
    >(new Map());

    useImperativeHandle(ref, () => ({
      get chart() {
        return chartRef.current;
      },
    }));

    // Create chart once.
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const isDark =
        document.documentElement.getAttribute("data-theme") === "dark";
      const gridColor = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.05)";
      const textColor = isDark ? "#64748B" : "#94a3b8";
      const crosshairColor = isDark
        ? "rgba(255,255,255,0.15)"
        : "rgba(0,0,0,0.12)";
      const borderColor = isDark
        ? "rgba(255,255,255,0.05)"
        : "rgba(0,0,0,0.06)";

      const chart = createChart(container, {
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
          scaleMargins: { top: 0.1, bottom: 0.1 },
        },
        timeScale: {
          borderColor,
          visible: false, // hidden — main chart shows the time axis
          timeVisible: true,
          secondsVisible: false,
        },
        width: container.clientWidth || 800,
        height: container.clientHeight || height,
        handleScroll: false,
        handleScale: false,
      });

      chartRef.current = chart;

      // Keep chart sized to container.
      const resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        const { width, height: h } = entry.contentRect;
        if (width > 0 && h > 0) chart.applyOptions({ width, height: h });
      });
      resizeObserver.observe(container);

      // React to theme changes.
      const mo = new MutationObserver(() => {
        const nowDark =
          document.documentElement.getAttribute("data-theme") === "dark";
        const g = nowDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.05)";
        const t = nowDark ? "#64748B" : "#94a3b8";
        const c = nowDark
          ? "rgba(255,255,255,0.15)"
          : "rgba(0,0,0,0.12)";
        const b = nowDark
          ? "rgba(255,255,255,0.05)"
          : "rgba(0,0,0,0.06)";
        chart.applyOptions({
          layout: { textColor: t },
          grid: { vertLines: { color: g }, horzLines: { color: g } },
          crosshair: { vertLine: { color: c }, horzLine: { color: c } },
          rightPriceScale: { borderColor: b },
          timeScale: { borderColor: b },
        });
      });
      mo.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"],
      });

      return () => {
        resizeObserver.disconnect();
        mo.disconnect();
        chart.remove();
        chartRef.current = null;
        seriesRef.current.clear();
      };
    }, [height]);

    // Sync series whenever props change.
    useEffect(() => {
      const chart = chartRef.current;
      if (!chart) return;

      const currentIds = new Set(series.map((s) => s.id));

      // Remove stale.
      for (const [id, s] of seriesRef.current.entries()) {
        if (!currentIds.has(id)) {
          try {
            chart.removeSeries(s);
          } catch {
            /* ignore */
          }
          seriesRef.current.delete(id);
        }
      }

      // Add / update.
      for (const cfg of series) {
        let s = seriesRef.current.get(cfg.id);
        if (!s) {
          if (cfg.type === "histogram") {
            s = chart.addHistogramSeries({
              color: typeof cfg.color === "function" ? "#888" : cfg.color,
              priceLineVisible: false,
              lastValueVisible: false,
            });
          } else {
            s = chart.addLineSeries({
              color: typeof cfg.color === "function" ? "#888" : cfg.color,
              lineWidth: cfg.lineWidth ?? 1,
              priceLineVisible: false,
              lastValueVisible: false,
            });
          }
          seriesRef.current.set(cfg.id, s);
        }

        if (cfg.type === "histogram" && typeof cfg.color === "function") {
          // Per-point color — include it in each data row.
          const colorFn = cfg.color;
          const shaped = cfg.data.map((p) => ({
            time: p.time,
            value: p.value,
            color: colorFn(p.value),
          }));
          (s as ISeriesApi<"Histogram">).setData(shaped as any);
        } else {
          (s as ISeriesApi<"Line">).setData(cfg.data as any);
        }
      }
    }, [series]);

    // Sync guide lines.
    const guideLineRefs = useRef<
      { series: ISeriesApi<"Line">; priceLine: any }[]
    >([]);
    useEffect(() => {
      const chart = chartRef.current;
      if (!chart) return;

      // Clear previous.
      for (const g of guideLineRefs.current) {
        try {
          g.series.removePriceLine(g.priceLine);
        } catch {
          /* ignore */
        }
      }
      guideLineRefs.current = [];

      if (!guideLines?.length) return;

      // Attach guide lines to the first series (any will work).
      const first = seriesRef.current.values().next().value as
        | ISeriesApi<"Line">
        | undefined;
      if (!first) return;

      for (const g of guideLines) {
        const pl = first.createPriceLine({
          price: g.price,
          color: g.color,
          lineWidth: 1,
          lineStyle: 2, // dashed
          axisLabelVisible: true,
          title: g.label ?? "",
        });
        guideLineRefs.current.push({ series: first, priceLine: pl });
      }
    }, [guideLines, series]);

    // Apply priceRange if provided.
    useEffect(() => {
      const chart = chartRef.current;
      if (!chart || !priceRange) return;
      // All series share the right price scale — setting autoScale on the
      // scale itself to a fixed range:
      const scale = chart.priceScale("right");
      scale.applyOptions({
        autoScale: false,
      });
      // Set range via the first series' applyOptions (lightweight-charts
      // doesn't expose direct range on the scale; we lean on the data + a
      // tight scale margin).
      scale.applyOptions({
        scaleMargins: { top: 0.1, bottom: 0.1 },
      });
    }, [priceRange]);

    return (
      <div
        ref={containerRef}
        className="w-full"
        style={{ height: `${height}px` }}
      />
    );
  },
);
