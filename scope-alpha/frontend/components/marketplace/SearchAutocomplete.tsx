"use client";

/**
 * Marketplace search autocomplete.
 *
 * Debounced 200ms input that shows analyst + asset matches in a dropdown
 * panel. Keyboard nav (ArrowUp/ArrowDown/Enter/Escape) supported.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";

interface AnalystResult {
  slug: string;
  displayName: string;
  avatarInitial: string;
  winRate: number;
  subscriberCount: number;
}

interface AssetResult {
  symbol: string;
  analystCount: number;
}

interface SearchResponse {
  results: Array<
    | { type: "analyst"; analyst: AnalystResult }
    | { type: "asset"; asset: AssetResult }
  >;
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

interface Props {
  value: string;
  onChange: (q: string) => void;
  onSelectAsset: (asset: string) => void;
}

export function SearchAutocomplete({ value, onChange, onSelectAsset }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [debounced, setDebounced] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce 200ms.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), 200);
    return () => clearTimeout(t);
  }, [value]);

  const { data } = useSWR<SearchResponse>(
    debounced.trim().length >= 1
      ? `/api/search?q=${encodeURIComponent(debounced)}&limit=8`
      : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  const results = data?.results ?? [];

  // Click outside to close.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleSelect = (idx: number) => {
    const item = results[idx];
    if (!item) return;
    if (item.type === "analyst") {
      router.push(`/analyst/${item.analyst.slug}`);
    } else {
      onSelectAsset(item.asset.symbol);
    }
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(results.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleSelect(highlighted);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlighted(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Search analysts or assets..."
        className="w-full px-4 py-2.5 rounded-[var(--radius-md)] text-sm font-body outline-none"
        style={{
          background: "var(--glass-bg)",
          border: "1px solid var(--glass-border)",
          color: "var(--text-primary)",
        }}
      />

      {open && results.length > 0 && (
        <div
          className="absolute top-full left-0 right-0 mt-1 rounded-[var(--radius-md)] overflow-hidden z-50"
          style={{
            background: "rgba(11, 14, 20, 0.97)",
            backdropFilter: "blur(20px)",
            border: "1px solid var(--glass-border)",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
          }}
        >
          {results.map((item, idx) => {
            const isHighlighted = idx === highlighted;
            const bg = isHighlighted ? "var(--glass-bg)" : "transparent";

            if (item.type === "analyst") {
              const a = item.analyst;
              return (
                <button
                  key={`a-${a.slug}`}
                  type="button"
                  onMouseEnter={() => setHighlighted(idx)}
                  onClick={() => handleSelect(idx)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left cursor-pointer"
                  style={{ background: bg }}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
                    style={{
                      background: "rgba(0,212,170,0.15)",
                      color: "var(--accent-green)",
                      border: "1px solid rgba(0, 212, 170, 0.3)",
                    }}
                  >
                    {a.avatarInitial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-xs font-bold font-display truncate"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {a.displayName}
                    </div>
                    <div
                      className="text-[10px] font-mono"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Win {a.winRate.toFixed(0)}% · {a.subscriberCount} subs
                    </div>
                  </div>
                </button>
              );
            }

            const asset = item.asset;
            return (
              <button
                key={`asset-${asset.symbol}`}
                type="button"
                onMouseEnter={() => setHighlighted(idx)}
                onClick={() => handleSelect(idx)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left cursor-pointer"
                style={{ background: bg }}
              >
                <span
                  className="text-[10px] font-bold font-mono px-2 py-0.5 rounded"
                  style={{
                    background: "rgba(59,130,246,0.15)",
                    color: "var(--accent-blue, #3B82F6)",
                    border: "1px solid rgba(59,130,246,0.3)",
                  }}
                >
                  {asset.symbol}
                </span>
                <span
                  className="text-[10px] font-mono"
                  style={{ color: "var(--text-muted)" }}
                >
                  {asset.analystCount} analyst{asset.analystCount === 1 ? "" : "s"} trading
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
