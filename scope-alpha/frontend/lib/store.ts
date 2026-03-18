import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TimeFrame } from "./types";

interface AppState {
  selectedAsset: string;
  selectedTimeframe: TimeFrame;
  sidebarCollapsed: boolean;
  connectionStatus: "connected" | "connecting" | "disconnected";
  theme: "light" | "dark" | "system";
  setAsset: (symbol: string) => void;
  setTimeframe: (tf: TimeFrame) => void;
  toggleSidebar: () => void;
  setConnectionStatus: (s: "connected" | "connecting" | "disconnected") => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      selectedAsset: "BTC",
      selectedTimeframe: "1D",
      sidebarCollapsed: false,
      connectionStatus: "connected",
      theme: "system",
      setAsset: (symbol) => set({ selectedAsset: symbol }),
      setTimeframe: (tf) => set({ selectedTimeframe: tf }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
      setTheme: (theme) => set({ theme }),
    }),
    { name: "scope-alpha-state" }
  )
);
