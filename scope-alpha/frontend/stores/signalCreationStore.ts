/**
 * Signal creation store.
 *
 * Holds the form/chart-mode state for the Pro signal creation flow:
 *   - useProForm: when true, the analyst sidebar shows SignalCreationForm
 *     instead of the legacy NewSignalForm.
 *   - chartMode: when set, the chart subscribes to clicks and walks the
 *     state machine (entry → stop → TP1 → TP2 → TP3) to set prices visually.
 *   - pending: the prices captured from chart clicks, handed back to the
 *     SignalCreationForm via prefill props when the overlay completes.
 */

import { create } from "zustand";
import type { Direction } from "@/config/signals";
import type { SignalTargetInput } from "@/lib/signals/validation";

export type ChartMode =
  | { type: "idle" }
  | { type: "setting_entry"; direction: Direction }
  | { type: "setting_stop"; direction: Direction; entry: number }
  | {
      type: "setting_targets";
      direction: Direction;
      entry: number;
      stop: number;
      targets: SignalTargetInput[];
    };

interface PendingPrices {
  direction: Direction;
  entry: number;
  stop: number;
  targets: SignalTargetInput[];
}

interface SignalCreationState {
  useProForm: boolean;
  chartMode: ChartMode;
  /** When the chart-overlay completes, the form pre-fills from this. */
  pending: PendingPrices | null;

  setUseProForm: (use: boolean) => void;
  enterChartMode: (direction: Direction) => void;
  cancelChartMode: () => void;
  setChartMode: (mode: ChartMode) => void;
  completeChartMode: (pending: PendingPrices) => void;
  clearPending: () => void;
}

export const useSignalCreationStore = create<SignalCreationState>((set) => ({
  useProForm: false,
  chartMode: { type: "idle" },
  pending: null,

  setUseProForm: (useProForm) => set({ useProForm }),

  enterChartMode: (direction) =>
    set({ chartMode: { type: "setting_entry", direction } }),

  cancelChartMode: () => set({ chartMode: { type: "idle" } }),

  setChartMode: (chartMode) => set({ chartMode }),

  completeChartMode: (pending) =>
    set({ chartMode: { type: "idle" }, pending }),

  clearPending: () => set({ pending: null }),
}));
