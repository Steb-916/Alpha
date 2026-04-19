import { create } from "zustand";

interface ChartToolbarState {
  showHeatmap: boolean;
  showCVD: boolean;
  showDivergences: boolean;
  /** Phase 5 Slice 2: exchange-netflow overlay (BTC/ETH only). */
  showExchangeNetflow: boolean;
  toggleHeatmap: () => void;
  toggleCVD: () => void;
  toggleDivergences: () => void;
  toggleExchangeNetflow: () => void;
}

/**
 * Non-persisted Zustand store for the chart-toolbar toggles.
 * Deliberately not persisted — these are per-session view preferences that
 * shouldn't fight with the user's last setup across tabs/sessions.
 */
export const useChartToolbar = create<ChartToolbarState>((set) => ({
  showHeatmap: false,
  showCVD: false,
  showDivergences: false,
  showExchangeNetflow: false,
  toggleHeatmap: () => set((s) => ({ showHeatmap: !s.showHeatmap })),
  toggleCVD: () => set((s) => ({ showCVD: !s.showCVD })),
  toggleDivergences: () => set((s) => ({ showDivergences: !s.showDivergences })),
  toggleExchangeNetflow: () =>
    set((s) => ({ showExchangeNetflow: !s.showExchangeNetflow })),
}));
