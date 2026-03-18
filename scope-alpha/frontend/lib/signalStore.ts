import { create } from "zustand";
import type { Signal, CreateSignalInput } from "./signals";
import { calculatePnl } from "./signals";

interface SignalState {
  signals: Signal[];
  showNewSignalForm: boolean;

  setSignals: (signals: Signal[]) => void;
  addSignal: (signal: Signal) => void;
  updateSignal: (id: string, data: Partial<Signal>) => void;
  cancelSignal: (id: string) => void;
  resolveSignal: (id: string, resolvedPrice: number, status: "target_hit" | "stopped_out") => void;
  setShowNewSignalForm: (show: boolean) => void;
}

export const useSignalStore = create<SignalState>((set) => ({
  signals: [],
  showNewSignalForm: false,

  setSignals: (signals) => set({ signals }),

  addSignal: (signal) =>
    set((state) => ({ signals: [signal, ...state.signals] })),

  updateSignal: (id, data) =>
    set((state) => ({
      signals: state.signals.map((s) => (s.id === id ? { ...s, ...data } : s)),
    })),

  cancelSignal: (id) =>
    set((state) => ({
      signals: state.signals.map((s) =>
        s.id === id ? { ...s, status: "cancelled" as const } : s
      ),
    })),

  resolveSignal: (id, resolvedPrice, status) =>
    set((state) => ({
      signals: state.signals.map((s) => {
        if (s.id !== id) return s;
        const pnl = calculatePnl(s.direction, s.entryPrice, resolvedPrice);
        return {
          ...s,
          status,
          resolvedAt: new Date().toISOString(),
          resolvedPrice,
          resultPnlPercent: Math.round(pnl * 100) / 100,
        };
      }),
    })),

  setShowNewSignalForm: (show) => set({ showNewSignalForm: show }),
}));
