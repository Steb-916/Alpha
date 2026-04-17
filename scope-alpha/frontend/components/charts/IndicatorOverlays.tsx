"use client";

/**
 * useIndicatorOverlays — manages the lifecycle of overlay series (SMA, EMA,
 * Bollinger Bands, VWAP) on the main candlestick chart.
 *
 * RSI and MACD are NOT handled here — they live in their own sub-pane
 * charts (see RSIPane, MACDPane).
 */

import { useEffect, useRef } from "react";
import type { IChartApi, ISeriesApi } from "lightweight-charts";
import { useIndicatorStore, type IndicatorInstance } from "@/lib/indicatorStore";
import {
  sma,
  ema,
  bollingerBands,
  vwap,
  type Candle,
} from "@/lib/indicators";

interface UseIndicatorOverlaysArgs {
  chart: IChartApi | null;
  candles: Candle[];
}

// Kinds rendered on the main pane. RSI/MACD render in their own panes.
const OVERLAY_KINDS = new Set(["sma", "ema", "bollinger", "vwap"]);

function withAlpha(hex: string, alpha: number): string {
  // Accept #rrggbb or #rgb; fall back to the input if neither.
  if (hex.length === 7 && hex.startsWith("#")) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  if (hex.length === 4 && hex.startsWith("#")) {
    const r = parseInt(hex[1] + hex[1], 16);
    const g = parseInt(hex[2] + hex[2], 16);
    const b = parseInt(hex[3] + hex[3], 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return hex;
}

export function useIndicatorOverlays({
  chart,
  candles,
}: UseIndicatorOverlaysArgs) {
  const indicators = useIndicatorStore((s) => s.indicators);

  // Maps an indicator id to the series (or array of series for multi-line)
  // attached to the chart, so we can remove or update them per render.
  const seriesMapRef = useRef<Map<string, ISeriesApi<"Line">[]>>(new Map());

  useEffect(() => {
    if (!chart) return;

    const map = seriesMapRef.current;
    const active: IndicatorInstance[] = indicators.filter(
      (i) => OVERLAY_KINDS.has(i.kind) && i.visible,
    );
    const activeIds = new Set(active.map((i) => i.id));

    // Remove series for indicators that are gone or hidden.
    for (const [id, list] of map.entries()) {
      if (!activeIds.has(id)) {
        for (const s of list) {
          try {
            chart.removeSeries(s);
          } catch {
            /* chart may be torn down */
          }
        }
        map.delete(id);
      }
    }

    // Add or update series for active indicators.
    for (const inst of active) {
      const expectedLineCount =
        inst.kind === "bollinger" ? 3 : 1;

      let series = map.get(inst.id);
      if (!series || series.length !== expectedLineCount) {
        // Tear down any stale set, then rebuild.
        if (series) {
          for (const s of series) {
            try {
              chart.removeSeries(s);
            } catch {
              /* ignore */
            }
          }
        }
        series = [];
        if (inst.kind === "bollinger") {
          // upper / middle / lower
          series.push(
            chart.addLineSeries({
              color: withAlpha(inst.color, 0.85),
              lineWidth: 1,
              priceLineVisible: false,
              lastValueVisible: false,
            }),
            chart.addLineSeries({
              color: inst.color,
              lineWidth: 1,
              priceLineVisible: false,
              lastValueVisible: false,
            }),
            chart.addLineSeries({
              color: withAlpha(inst.color, 0.85),
              lineWidth: 1,
              priceLineVisible: false,
              lastValueVisible: false,
            }),
          );
        } else {
          series.push(
            chart.addLineSeries({
              color: inst.color,
              lineWidth: 2,
              priceLineVisible: false,
              lastValueVisible: false,
            }),
          );
        }
        map.set(inst.id, series);
      }

      // Compute + set data.
      if (inst.kind === "sma") {
        const data = sma(candles, Math.max(1, Math.floor(inst.params.period)));
        series[0].setData(data as any);
      } else if (inst.kind === "ema") {
        const data = ema(candles, Math.max(1, Math.floor(inst.params.period)));
        series[0].setData(data as any);
      } else if (inst.kind === "vwap") {
        const data = vwap(candles);
        series[0].setData(data as any);
      } else if (inst.kind === "bollinger") {
        const bb = bollingerBands(
          candles,
          Math.max(1, Math.floor(inst.params.period)),
          Math.max(0.1, inst.params.stdDev),
        );
        series[0].setData(bb.upper as any);
        series[1].setData(bb.middle as any);
        series[2].setData(bb.lower as any);
      }
    }
  }, [chart, candles, indicators]);

  // Teardown when the chart itself unmounts.
  useEffect(() => {
    return () => {
      const map = seriesMapRef.current;
      // Don't call removeSeries here — if chart is gone, it'll throw. Just
      // drop our references; the chart's own cleanup removes the series.
      map.clear();
    };
  }, []);
}
