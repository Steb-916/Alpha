"use client";

import { forwardRef, useMemo } from "react";
import { SubPaneChart, type SubPaneChartRef } from "./SubPaneChart";
import { macd, type Candle } from "@/lib/indicators";
import type { IndicatorInstance } from "@/lib/indicatorStore";

interface MACDPaneProps {
  inst: IndicatorInstance;
  candles: Candle[];
}

export const MACDPane = forwardRef<SubPaneChartRef, MACDPaneProps>(
  function MACDPane({ inst, candles }, ref) {
    const fast = Math.max(1, Math.floor(inst.params.fast || 12));
    const slow = Math.max(1, Math.floor(inst.params.slow || 26));
    const signal = Math.max(1, Math.floor(inst.params.signal || 9));

    const { macd: macdLine, signal: signalLine, histogram } = useMemo(
      () => macd(candles, fast, slow, signal),
      [candles, fast, slow, signal],
    );

    const series = useMemo(
      () => [
        {
          // Render histogram first so the lines draw over the top.
          id: "macd-histogram",
          type: "histogram" as const,
          color: (v: number) =>
            v >= 0 ? "rgba(16,185,129,0.7)" : "rgba(239,68,68,0.7)",
          data: histogram,
        },
        {
          id: "macd-line",
          type: "line" as const,
          color: inst.color,
          lineWidth: 2 as const,
          data: macdLine,
        },
        {
          id: "macd-signal",
          type: "line" as const,
          color: "#F59E0B", // signal line — always amber
          lineWidth: 1 as const,
          data: signalLine,
        },
      ],
      [histogram, macdLine, signalLine, inst.color],
    );

    return <SubPaneChart ref={ref} series={series} height={120} />;
  },
);
