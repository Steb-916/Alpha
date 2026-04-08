"use client";

/**
 * Signal creation overlay.
 *
 * Mounted on top of PriceChart when the analyst clicks "Use chart to set
 * prices" in the SignalCreationForm. Subscribes to chart click events,
 * walks the state machine (entry → stop → TP1 → optional TP2 → optional TP3),
 * draws price lines as it goes, and on Enter/last-click hands the captured
 * prices back to the form via the store.
 *
 * Press Esc at any point to cancel and clear the lines.
 */

import { useEffect, useRef } from "react";
import type { IPriceLine, MouseEventParams } from "lightweight-charts";
import type { PriceChartRef } from "@/components/charts/PriceChart";
import { useSignalCreationStore } from "@/stores/signalCreationStore";
import type { SignalTargetInput } from "@/lib/signals/validation";

interface Props {
  chartRef: React.RefObject<PriceChartRef>;
}

export function SignalCreationOverlay({ chartRef }: Props) {
  const chartMode = useSignalCreationStore((s) => s.chartMode);
  const setChartMode = useSignalCreationStore((s) => s.setChartMode);
  const completeChartMode = useSignalCreationStore((s) => s.completeChartMode);
  const cancelChartMode = useSignalCreationStore((s) => s.cancelChartMode);

  // Tracks all price lines drawn during this session so we can clean them up.
  const linesRef = useRef<IPriceLine[]>([]);

  // Esc to cancel.
  useEffect(() => {
    if (chartMode.type === "idle") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cancelChartMode();
      } else if (e.key === "Enter" && chartMode.type === "setting_targets") {
        // Confirm with whatever targets we have so far.
        commit(chartMode.entry, chartMode.stop, chartMode.targets, chartMode.direction);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chartMode, cancelChartMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear lines whenever we leave chart mode.
  useEffect(() => {
    if (chartMode.type !== "idle") return;
    const series = chartRef.current?.series;
    if (!series) {
      linesRef.current = [];
      return;
    }
    for (const line of linesRef.current) {
      try {
        series.removePriceLine(line);
      } catch {
        /* line already removed */
      }
    }
    linesRef.current = [];
  }, [chartMode.type, chartRef]);

  // Click handler — wired only while we're in non-idle mode.
  useEffect(() => {
    if (chartMode.type === "idle") return;
    const chart = chartRef.current?.chart;
    const series = chartRef.current?.series;
    if (!chart || !series) return;

    const handler = (param: MouseEventParams) => {
      if (!param.point) return;
      const price = series.coordinateToPrice(param.point.y);
      if (price == null || !Number.isFinite(price)) return;
      const numeric = Number(price);

      if (chartMode.type === "setting_entry") {
        const entryLine = series.createPriceLine({
          price: numeric,
          color: "#10B981",
          lineWidth: 2,
          axisLabelVisible: true,
          title: "Entry",
        } as Parameters<typeof series.createPriceLine>[0]);
        linesRef.current.push(entryLine);
        setChartMode({ type: "setting_stop", direction: chartMode.direction, entry: numeric });
        return;
      }

      if (chartMode.type === "setting_stop") {
        const stopLine = series.createPriceLine({
          price: numeric,
          color: "#EF4444",
          lineWidth: 2,
          axisLabelVisible: true,
          title: "Stop",
        } as Parameters<typeof series.createPriceLine>[0]);
        linesRef.current.push(stopLine);
        setChartMode({
          type: "setting_targets",
          direction: chartMode.direction,
          entry: chartMode.entry,
          stop: numeric,
          targets: [],
        });
        return;
      }

      if (chartMode.type === "setting_targets") {
        const idx = chartMode.targets.length + 1;
        const targetLine = series.createPriceLine({
          price: numeric,
          color: "#10B981",
          lineWidth: 1,
          axisLabelVisible: true,
          title: `TP${idx}`,
        } as Parameters<typeof series.createPriceLine>[0]);
        linesRef.current.push(targetLine);

        const newTargets = [
          ...chartMode.targets,
          { label: `TP${idx}`, price: numeric, closePercent: 0 },
        ];

        // After 3 targets, auto-commit. Earlier the analyst can press Enter
        // to commit with fewer.
        if (newTargets.length >= 3) {
          commit(chartMode.entry, chartMode.stop, newTargets, chartMode.direction);
        } else {
          setChartMode({
            type: "setting_targets",
            direction: chartMode.direction,
            entry: chartMode.entry,
            stop: chartMode.stop,
            targets: newTargets,
          });
        }
      }
    };

    chart.subscribeClick(handler);
    return () => {
      try {
        chart.unsubscribeClick(handler);
      } catch {
        /* chart already disposed */
      }
    };
  }, [chartMode, chartRef, setChartMode]); // eslint-disable-line react-hooks/exhaustive-deps

  function commit(
    entry: number,
    stop: number,
    rawTargets: SignalTargetInput[],
    direction: "long" | "short",
  ) {
    // Distribute closePercent equally across the captured targets.
    const n = rawTargets.length || 1;
    const each = Math.round((100 / n) * 100) / 100;
    const targets: SignalTargetInput[] = rawTargets.map((t, i) => ({
      ...t,
      closePercent: i === n - 1 ? Math.round((100 - each * (n - 1)) * 100) / 100 : each,
    }));

    completeChartMode({ direction, entry, stop, targets });
  }

  if (chartMode.type === "idle") return null;

  // Floating instruction banner.
  const stepLabel =
    chartMode.type === "setting_entry"
      ? "Click chart to set ENTRY"
      : chartMode.type === "setting_stop"
        ? "Click chart to set STOP LOSS"
        : `Click chart to add TP${chartMode.targets.length + 1} (Enter to commit, Esc to cancel)`;

  return (
    <div
      className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-[var(--radius-md)] pointer-events-none"
      style={{
        background: "rgba(11, 14, 20, 0.95)",
        border: "1px solid var(--accent-green)",
        boxShadow: "0 4px 16px var(--accent-green-glow)",
        color: "var(--text-primary)",
      }}
    >
      <div className="text-xs font-mono font-bold">{stepLabel}</div>
    </div>
  );
}
