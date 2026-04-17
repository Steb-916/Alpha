import { create } from "zustand";

interface ChartToolbarState {
  showHeatmap: boolean;
  showCVD: boolean;
  showDivergences: boolean;
  toggleHeatmap: () => void;
  toggleCVD: () => void;
  toggleDivergences: () => void;
}

/**
 * Non-persisted Zustand store for the three chart-toolbar toggles.
 * Deliberately not persisted — these are per-session view preferences that
 * shouldn't fight with the user's last setup across tabs/sessions.
 */
export const useChartToolbar = create<ChartToolbarState>((set) => ({
  showHeatmap: false,
  showCVD: false,
  showDivergences: false,
  toggleHeatmap: () => set((s) => ({ showHeatmap: !s.showHeatmap })),
  toggleCVD: () => set((s) => ({ showCVD: !s.showCVD })),
  toggleDivergences: () => set((s) => ({ showDivergences: !s.showDivergences })),
}));
