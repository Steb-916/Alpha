"use client";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { TimeFrame } from "@/lib/types";

const timeframes: TimeFrame[] = ["1m", "5m", "15m", "1H", "4H", "1D", "1W"];

export function TopBar() {
  const { selectedAsset, selectedTimeframe, setTimeframe, connectionStatus } = useAppStore();

  const statusColors = {
    connected: "bg-accent-green",
    connecting: "bg-accent-yellow",
    disconnected: "bg-accent-red",
  };

  const statusLabels = {
    connected: "Live",
    connecting: "Connecting",
    disconnected: "Disconnected",
  };

  return (
    <header
      className="h-12 flex items-center justify-between px-4 border-b border-white/[0.05] shrink-0"
      style={{ background: "rgba(15, 18, 25, 0.8)", backdropFilter: "blur(12px)" }}
    >
      {/* Asset Selector */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
          <div className="w-2 h-2 rounded-full bg-accent-yellow" />
          <span className="text-sm font-semibold text-text-primary">{selectedAsset} / USDT</span>
          <span className="text-text-dim text-xs">▾</span>
        </div>
      </div>

      {/* Timeframe Pills */}
      <div className="flex items-center gap-1">
        {timeframes.map((tf) => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={cn(
              "px-3 py-1 rounded-md text-[11px] font-mono font-semibold transition-all duration-200",
              tf === selectedTimeframe
                ? "bg-accent-green/[0.15] text-accent-green"
                : "text-text-muted hover:text-text-secondary hover:bg-white/[0.04]"
            )}
            style={
              tf === selectedTimeframe
                ? { boxShadow: "inset 2px 2px 6px rgba(0,0,0,0.3)" }
                : { boxShadow: "2px 2px 6px rgba(0,0,0,0.2), -1px -1px 4px rgba(255,255,255,0.02)" }
            }
          >
            {tf}
          </button>
        ))}
      </div>

      {/* Right: Connection + Settings */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div
            className={cn("w-2 h-2 rounded-full", statusColors[connectionStatus])}
            style={connectionStatus === "connected" ? { animation: "pulse 2s infinite" } : undefined}
          />
          <span className="text-[11px] font-mono text-text-secondary">{statusLabels[connectionStatus]}</span>
        </div>
        <button className="text-text-dim hover:text-text-secondary transition-colors">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 10a2 2 0 100-4 2 2 0 000 4z"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M13.6 10a1.2 1.2 0 00.24 1.32l.04.04a1.46 1.46 0 11-2.06 2.06l-.04-.04A1.2 1.2 0 0010 13.6v.08A1.46 1.46 0 017.08 15.14H6.92A1.46 1.46 0 015.46 13.68v-.04A1.2 1.2 0 003.68 12.4l-.04.04a1.46 1.46 0 11-2.06-2.06l.04-.04A1.2 1.2 0 001.86 8.66h-.08A1.46 1.46 0 01.32 7.2V7.04a1.46 1.46 0 011.46-1.46h.04A1.2 1.2 0 003.08 4.34l-.04-.04a1.46 1.46 0 112.06-2.06l.04.04A1.2 1.2 0 006.8 2.52V2.44A1.46 1.46 0 018.26.98h.16a1.46 1.46 0 011.46 1.46v.04a1.2 1.2 0 001.76.24l.04-.04a1.46 1.46 0 112.06 2.06l-.04.04a1.2 1.2 0 00-.24 1.76h.08a1.46 1.46 0 011.46 1.46v.16"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </header>
  );
}
