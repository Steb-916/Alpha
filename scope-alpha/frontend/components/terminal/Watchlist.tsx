"use client";
import { useState, useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { formatPrice, formatLargeNumber, formatPercent, cn } from "@/lib/utils";
import type { MarketSnapshot } from "@/lib/types";

interface WatchlistProps {
  data: MarketSnapshot[];
}

type SortKey = "rank" | "price" | "change24h" | "volume24h" | "marketCap";
type SortDir = "asc" | "desc";

export function Watchlist({ data }: WatchlistProps) {
  const { selectedAsset, setAsset } = useAppStore();
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "rank" ? "asc" : "desc");
    }
  };

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      const mul = sortDir === "asc" ? 1 : -1;
      return mul * ((a[sortKey] as number) - (b[sortKey] as number));
    });
  }, [data, sortKey, sortDir]);

  const SortIcon = ({ col }: { col: SortKey }) => (
    <span
      className="ml-0.5 text-[8px]"
      style={{ color: sortKey === col ? "var(--accent-green)" : "var(--text-muted)" }}
    >
      {sortKey === col ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
    </span>
  );

  return (
    <div className="h-full flex flex-col">
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ borderBottom: "1px solid var(--glass-border)" }}
      >
        <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Watchlist</span>
      </div>

      {/* Header */}
      <div
        className="grid grid-cols-[32px_1fr_90px_72px_80px] gap-1 px-3 py-1.5 text-[9px] font-mono uppercase tracking-wider"
        style={{
          borderBottom: "1px solid var(--glass-border)",
          background: "var(--glass-bg)",
          color: "var(--text-muted)",
        }}
      >
        <button onClick={() => handleSort("rank")} className="text-left cursor-pointer">#<SortIcon col="rank" /></button>
        <div>Asset</div>
        <button onClick={() => handleSort("price")} className="text-right cursor-pointer">Price<SortIcon col="price" /></button>
        <button onClick={() => handleSort("change24h")} className="text-right cursor-pointer">24h<SortIcon col="change24h" /></button>
        <button onClick={() => handleSort("volume24h")} className="text-right cursor-pointer">Vol<SortIcon col="volume24h" /></button>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {sorted.map((asset) => {
          const isSelected = selectedAsset === asset.symbol;
          return (
            <button
              key={asset.symbol}
              onClick={() => setAsset(asset.symbol)}
              className="w-full grid grid-cols-[32px_1fr_90px_72px_80px] gap-1 px-3 py-2 items-center text-left cursor-pointer"
              style={{
                background: isSelected ? "rgba(0, 212, 170, 0.08)" : "transparent",
                borderLeft: isSelected ? "3px solid var(--accent-green)" : "3px solid transparent",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = "var(--glass-bg)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{asset.rank}</span>
              <div className="min-w-0">
                <div className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>{asset.symbol}</div>
                <div className="text-[9px] truncate" style={{ color: "var(--text-muted)" }}>{asset.name}</div>
              </div>
              <div className="text-right text-xs font-mono" style={{ color: "var(--text-primary)" }}>{formatPrice(asset.price)}</div>
              <div
                className="text-right text-[11px] font-mono font-semibold"
                style={{ color: asset.change24h >= 0 ? "var(--positive)" : "var(--negative)" }}
              >
                {formatPercent(asset.change24h)}
              </div>
              <div className="text-right text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
                {formatLargeNumber(asset.volume24h).replace("$", "")}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
