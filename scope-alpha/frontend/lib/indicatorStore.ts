/**
 * Indicator store — tracks which indicators are enabled on the chart,
 * their parameters, colors, and visibility. Persisted to localStorage so
 * analyst layouts survive reload.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type IndicatorKind =
  | "sma"
  | "ema"
  | "bollinger"
  | "vwap"
  | "rsi"
  | "macd";

export interface IndicatorInstance {
  id: string;
  kind: IndicatorKind;
  params: Record<string, number>;
  color: string;
  visible: boolean;
}

// Default parameters per kind. Callers may override via addIndicator's
// second argument.
export const DEFAULT_PARAMS: Record<IndicatorKind, Record<string, number>> = {
  sma: { period: 20 },
  ema: { period: 50 },
  bollinger: { period: 20, stdDev: 2 },
  vwap: {},
  rsi: { period: 14 },
  macd: { fast: 12, slow: 26, signal: 9 },
};

// Default color per kind. Using hex so they survive theme changes (the
// chart library doesn't resolve CSS vars). These are the dark-mode accent
// values from globals.css and read acceptably in light mode too.
export const DEFAULT_COLORS: Record<IndicatorKind, string> = {
  sma: "#3B82F6", // blue
  ema: "#F59E0B", // yellow
  bollinger: "#8B5CF6", // purple
  vwap: "#00D4AA", // green
  rsi: "#8B5CF6", // purple (separate pane)
  macd: "#3B82F6", // blue (separate pane)
};

export const INDICATOR_LABELS: Record<IndicatorKind, string> = {
  sma: "SMA",
  ema: "EMA",
  bollinger: "Bollinger Bands",
  vwap: "VWAP",
  rsi: "RSI",
  macd: "MACD",
};

export function formatIndicatorName(inst: IndicatorInstance): string {
  switch (inst.kind) {
    case "sma":
    case "ema":
    case "rsi":
      return `${INDICATOR_LABELS[inst.kind]} ${inst.params.period ?? ""}`.trim();
    case "bollinger":
      return `BB ${inst.params.period}/${inst.params.stdDev}σ`;
    case "macd":
      return `MACD ${inst.params.fast}/${inst.params.slow}/${inst.params.signal}`;
    case "vwap":
      return "VWAP";
  }
}

interface IndicatorState {
  indicators: IndicatorInstance[];
  addIndicator: (kind: IndicatorKind, params?: Record<string, number>) => void;
  removeIndicator: (id: string) => void;
  updateIndicatorParams: (id: string, params: Record<string, number>) => void;
  toggleVisibility: (id: string) => void;
  setColor: (id: string, color: string) => void;
}

function genId(kind: IndicatorKind, params: Record<string, number>): string {
  const suffix = Object.values(params).join("-") || "x";
  return `${kind}-${suffix}-${Math.random().toString(36).slice(2, 6)}`;
}

export const useIndicatorStore = create<IndicatorState>()(
  persist(
    (set) => ({
      indicators: [],
      addIndicator: (kind, params) => {
        const finalParams = { ...DEFAULT_PARAMS[kind], ...(params ?? {}) };
        const instance: IndicatorInstance = {
          id: genId(kind, finalParams),
          kind,
          params: finalParams,
          color: DEFAULT_COLORS[kind],
          visible: true,
        };
        set((state) => ({ indicators: [...state.indicators, instance] }));
      },
      removeIndicator: (id) =>
        set((state) => ({
          indicators: state.indicators.filter((i) => i.id !== id),
        })),
      updateIndicatorParams: (id, params) =>
        set((state) => ({
          indicators: state.indicators.map((i) =>
            i.id === id ? { ...i, params: { ...i.params, ...params } } : i,
          ),
        })),
      toggleVisibility: (id) =>
        set((state) => ({
          indicators: state.indicators.map((i) =>
            i.id === id ? { ...i, visible: !i.visible } : i,
          ),
        })),
      setColor: (id, color) =>
        set((state) => ({
          indicators: state.indicators.map((i) =>
            i.id === id ? { ...i, color } : i,
          ),
        })),
    }),
    {
      name: "scope-alpha-indicators",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);
