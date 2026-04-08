"use client";

/**
 * Advanced marketplace filters — Phase 5A.
 *
 * Collapsible panel layered above the existing simple filter bar. Sends
 * range filters and asset multi-select to /api/analysts via the parent
 * marketplace page.
 */

import { useState } from "react";
import type { AdvancedFilterState } from "@/app/marketplace/page";

interface Props {
  value: AdvancedFilterState;
  onChange: (next: AdvancedFilterState) => void;
}

const ASSET_OPTIONS = ["BTC", "ETH", "SOL", "DOGE", "ARB", "AVAX", "LINK", "MATIC"];

const inputStyle: React.CSSProperties = {
  background: "var(--glass-bg)",
  border: "1px solid var(--glass-border)",
  color: "var(--text-primary)",
};

function activeCount(v: AdvancedFilterState): number {
  let n = 0;
  if (v.minWinRate != null) n++;
  if (v.maxWinRate != null) n++;
  if (v.minPnl != null) n++;
  if (v.maxPnl != null) n++;
  if (v.minPrice != null) n++;
  if (v.maxPrice != null) n++;
  if (v.minSignals != null) n++;
  if (v.minSubscribers != null) n++;
  if (v.assets.length > 0) n++;
  if (v.rating != null) n++;
  return n;
}

export function AdvancedFilters({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const count = activeCount(value);

  const update = (patch: Partial<AdvancedFilterState>) =>
    onChange({ ...value, ...patch });

  const toggleAsset = (a: string) => {
    if (value.assets.includes(a)) {
      update({ assets: value.assets.filter((x) => x !== a) });
    } else {
      update({ assets: [...value.assets, a] });
    }
  };

  const reset = () =>
    onChange({ q: value.q, assets: [] }); // keep search query

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-[10px] font-body cursor-pointer flex items-center gap-2"
        style={{ color: "var(--accent-green)" }}
      >
        {open ? "▼" : "▶"} Advanced filters
        {count > 0 && (
          <span
            className="px-1.5 py-0.5 text-[9px] font-bold rounded-[var(--radius-pill)]"
            style={{ background: "var(--accent-green)", color: "#fff" }}
          >
            {count}
          </span>
        )}
      </button>

      {open && (
        <div
          className="mt-3 p-4 rounded-[var(--radius-md)] grid grid-cols-1 md:grid-cols-3 gap-4"
          style={{
            background: "var(--glass-bg)",
            border: "1px solid var(--glass-border)",
          }}
        >
          {/* Win rate range */}
          <div>
            <label
              className="block text-[10px] font-bold font-body uppercase tracking-wider mb-1"
              style={{ color: "var(--text-tertiary)" }}
            >
              Win rate (%)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={100}
                placeholder="min"
                value={value.minWinRate ?? ""}
                onChange={(e) =>
                  update({
                    minWinRate: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
                className="w-20 px-2 py-1.5 text-xs font-mono rounded-[var(--radius-sm)] outline-none"
                style={inputStyle}
              />
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                –
              </span>
              <input
                type="number"
                min={0}
                max={100}
                placeholder="max"
                value={value.maxWinRate ?? ""}
                onChange={(e) =>
                  update({
                    maxWinRate: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
                className="w-20 px-2 py-1.5 text-xs font-mono rounded-[var(--radius-sm)] outline-none"
                style={inputStyle}
              />
            </div>
          </div>

          {/* P&L range */}
          <div>
            <label
              className="block text-[10px] font-bold font-body uppercase tracking-wider mb-1"
              style={{ color: "var(--text-tertiary)" }}
            >
              90d P&L (%)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="min"
                value={value.minPnl ?? ""}
                onChange={(e) =>
                  update({ minPnl: e.target.value ? parseFloat(e.target.value) : undefined })
                }
                className="w-20 px-2 py-1.5 text-xs font-mono rounded-[var(--radius-sm)] outline-none"
                style={inputStyle}
              />
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                –
              </span>
              <input
                type="number"
                placeholder="max"
                value={value.maxPnl ?? ""}
                onChange={(e) =>
                  update({ maxPnl: e.target.value ? parseFloat(e.target.value) : undefined })
                }
                className="w-20 px-2 py-1.5 text-xs font-mono rounded-[var(--radius-sm)] outline-none"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Price range */}
          <div>
            <label
              className="block text-[10px] font-bold font-body uppercase tracking-wider mb-1"
              style={{ color: "var(--text-tertiary)" }}
            >
              Price ($/mo)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="min"
                value={value.minPrice ?? ""}
                onChange={(e) =>
                  update({ minPrice: e.target.value ? parseFloat(e.target.value) : undefined })
                }
                className="w-20 px-2 py-1.5 text-xs font-mono rounded-[var(--radius-sm)] outline-none"
                style={inputStyle}
              />
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                –
              </span>
              <input
                type="number"
                placeholder="max"
                value={value.maxPrice ?? ""}
                onChange={(e) =>
                  update({ maxPrice: e.target.value ? parseFloat(e.target.value) : undefined })
                }
                className="w-20 px-2 py-1.5 text-xs font-mono rounded-[var(--radius-sm)] outline-none"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Min signals */}
          <div>
            <label
              className="block text-[10px] font-bold font-body uppercase tracking-wider mb-1"
              style={{ color: "var(--text-tertiary)" }}
            >
              Min signals
            </label>
            <input
              type="number"
              min={0}
              placeholder="0"
              value={value.minSignals ?? ""}
              onChange={(e) =>
                update({ minSignals: e.target.value ? parseInt(e.target.value, 10) : undefined })
              }
              className="w-24 px-2 py-1.5 text-xs font-mono rounded-[var(--radius-sm)] outline-none"
              style={inputStyle}
            />
          </div>

          {/* Min subscribers */}
          <div>
            <label
              className="block text-[10px] font-bold font-body uppercase tracking-wider mb-1"
              style={{ color: "var(--text-tertiary)" }}
            >
              Min subscribers
            </label>
            <input
              type="number"
              min={0}
              placeholder="0"
              value={value.minSubscribers ?? ""}
              onChange={(e) =>
                update({
                  minSubscribers: e.target.value ? parseInt(e.target.value, 10) : undefined,
                })
              }
              className="w-24 px-2 py-1.5 text-xs font-mono rounded-[var(--radius-sm)] outline-none"
              style={inputStyle}
            />
          </div>

          {/* Min rating */}
          <div>
            <label
              className="block text-[10px] font-bold font-body uppercase tracking-wider mb-1"
              style={{ color: "var(--text-tertiary)" }}
            >
              Min rating
            </label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((r) => {
                const active = (value.rating ?? 0) >= r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() =>
                      update({ rating: value.rating === r ? undefined : r })
                    }
                    className="text-sm cursor-pointer"
                    style={{ color: active ? "#F59E0B" : "var(--text-tertiary)" }}
                  >
                    ★
                  </button>
                );
              })}
            </div>
          </div>

          {/* Assets multi-select */}
          <div className="md:col-span-3">
            <label
              className="block text-[10px] font-bold font-body uppercase tracking-wider mb-1"
              style={{ color: "var(--text-tertiary)" }}
            >
              Assets
            </label>
            <div className="flex flex-wrap gap-2">
              {ASSET_OPTIONS.map((a) => {
                const active = value.assets.includes(a);
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggleAsset(a)}
                    className="px-3 py-1.5 text-[10px] font-mono cursor-pointer rounded-[var(--radius-pill)]"
                    style={{
                      background: active ? "rgba(0,212,170,0.15)" : "var(--glass-bg)",
                      color: active ? "var(--accent-green)" : "var(--text-muted)",
                      border: `1px solid ${active ? "rgba(0,212,170,0.3)" : "var(--glass-border)"}`,
                    }}
                  >
                    {a}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reset */}
          <div className="md:col-span-3 flex justify-end">
            <button
              type="button"
              onClick={reset}
              className="text-[10px] font-body cursor-pointer"
              style={{ color: "var(--text-muted)" }}
            >
              Reset filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
