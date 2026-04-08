/**
 * Portfolio Zustand store.
 *
 * Holds the set of signal IDs the current subscriber is actively tracking.
 * Used by `<TakeSignalButton />` to render the "Tracking ✓" state without
 * having to re-fetch the full portfolio on every signal card render.
 *
 * Populated lazily on first call to `loadActiveTracked()` and updated
 * optimistically on track/close actions.
 */

import { create } from 'zustand';

interface PortfolioState {
  trackedSignalIds: Set<string>;
  loaded: boolean;
  loadActiveTracked: () => Promise<void>;
  markTracked: (signalId: string) => void;
  markUntracked: (signalId: string) => void;
  reset: () => void;
}

export const usePortfolioStore = create<PortfolioState>((set, get) => ({
  trackedSignalIds: new Set<string>(),
  loaded: false,

  loadActiveTracked: async () => {
    if (get().loaded) return;
    try {
      const res = await fetch('/api/portfolio?status=active&limit=100');
      if (!res.ok) {
        // 401 is fine — user not logged in. Don't error.
        set({ loaded: true });
        return;
      }
      const data = await res.json();
      const ids = new Set<string>(
        (data.positions ?? []).map((p: { signalId: string }) => p.signalId),
      );
      set({ trackedSignalIds: ids, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  markTracked: (signalId) =>
    set((state) => {
      const next = new Set(state.trackedSignalIds);
      next.add(signalId);
      return { trackedSignalIds: next };
    }),

  markUntracked: (signalId) =>
    set((state) => {
      const next = new Set(state.trackedSignalIds);
      next.delete(signalId);
      return { trackedSignalIds: next };
    }),

  reset: () => set({ trackedSignalIds: new Set<string>(), loaded: false }),
}));
