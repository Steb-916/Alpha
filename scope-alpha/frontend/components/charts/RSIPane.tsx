"use client";

import { forwardRef, useMemo } from "react";
import { SubPaneChart, type SubPaneChartRef } from "./SubPaneChart";
import { rsi, type Candle } from "@/lib/indicators";
import type { IndicatorInstance } from "@/lib/indicatorStore";

interface RSIPaneProps {
  inst: IndicatorInstance;
  candles: Candle[];
}

export const RSIPane = forwardRef<SubPaneChartRef, RSIPaneProps>(
  function RSIPane({ inst, candles }, ref) {
    const period = Math.max(2, Math.floor(inst.params.period || 14));
    const data = useMemo(() => rsi(candles, period), [candles, period]);

    const series = useMemo(
      () => [
        {
          id: "rsi",
          type: "line" as const,
          color: inst.color,
          lineWidth: 2 as const,
          data,
        },
      ],
      [data, inst.color],
    );

    const guideLines = useMemo(
      () => [
        { price: 70, color: "rgba(239, 68, 68, 0.5)", label: "70" },
        { price: 30, color: "rgba(16, 185, 129, 0.5)", label: "30" },
      ],
      [],
    );

    return (
      <SubPaneChart
        ref={ref}
        series={series}
        guideLines={guideLines}
        height={120}
        priceRange={{ min: 0, max: 100 }}
      />
    );
  },
);
