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
    <span className={cn("ml-0.5 text-[8px]", sortKey === col ? "text-accent-green" : "text-text-dim")}>
      {sortKey === col ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
    </span>
  );

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.05]">
        <span className="text-xs font-semibold text-text-primary">Watchlist</span>
        <span className="text-[9px] font-mono text-text-dim">{data.length} assets</span>
      </div>

      {/* Header */}
      <div className="grid grid-cols-[32px_1fr_90px_72px_80px] gap-1 px-3 py-1.5 border-b border-white/[0.04] text-[9px] font-mono text-text-dim uppercase tracking-wider">
        <button onClick={() => handleSort("rank")} className="text-left hover:text-text-secondary">#<SortIcon col="rank" /></button>
        <div>Asset</div>
        <button onClick={() => handleSort("price")} className="text-right hover:text-text-secondary">Price<SortIcon col="price" /></button>
        <button onClick={() => handleSort("change24h")} className="text-right hover:text-text-secondary">24h<SortIcon col="change24h" /></button>
        <button onClick={() => handleSort("volume24h")} className="text-right hover:text-text-secondary">Vol<SortIcon col="volume24h" /></button>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {sorted.map((asset) => (
          <button
            key={asset.symbol}
            onClick={() => setAsset(asset.symbol)}
            className={cn(
              "w-full grid grid-cols-[32px_1fr_90px_72px_80px] gap-1 px-3 py-2 items-center transition-all duration-150 text-left",
              selectedAsset === asset.symbol
                ? "bg-accent-green/[0.06] border-l-2 border-accent-green"
                : "hover:bg-white/[0.02] border-l-2 border-transparent"
            )}
          >
            <span className="text-[10px] font-mono text-text-dim">{asset.rank}</span>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-text-primary truncate">{asset.symbol}</div>
              <div className="text-[9px] text-text-dim truncate">{asset.name}</div>
            </div>
            <div className="text-right text-xs font-mono text-text-primary">{formatPrice(asset.price)}</div>
            <div className={cn("text-right text-[11px] font-mono font-semibold", asset.change24h >= 0 ? "text-positive" : "text-negative")}>
              {formatPercent(asset.change24h)}
            </div>
            <div className="text-right text-[10px] font-mono text-text-muted">{formatLargeNumber(asset.volume24h).replace("$", "")}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
