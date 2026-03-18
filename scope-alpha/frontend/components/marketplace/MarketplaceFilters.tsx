"use client";

import {
  SORT_OPTIONS,
  ASSET_FILTERS,
  type SortOption,
  type MarketplaceFilters,
} from "@/lib/marketplace";

interface Props {
  filters: MarketplaceFilters;
  sort: SortOption;
  onFiltersChange: (filters: MarketplaceFilters) => void;
  onSortChange: (sort: SortOption) => void;
  resultCount: number;
}

export function MarketplaceFiltersBar({
  filters,
  sort,
  onFiltersChange,
  onSortChange,
  resultCount,
}: Props) {
  const selectStyle = {
    background: "var(--glass-bg)",
    border: "1px solid var(--glass-border)",
    color: "var(--text-primary)",
  };

  return (
    <div
      className="p-3 rounded-[var(--radius-md)] mb-4"
      style={{
        background: "var(--glass-bg)",
        border: "1px solid var(--glass-border)",
      }}
    >
      <div className="flex flex-wrap items-center gap-3">
        {/* Sort */}
        <div>
          <label className="text-[9px] font-body uppercase tracking-wider block mb-1" style={{ color: "var(--text-tertiary)" }}>
            Sort by
          </label>
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            className="px-2.5 py-1.5 rounded-[var(--radius-sm)] text-xs font-body outline-none cursor-pointer"
            style={selectStyle}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Asset filter */}
        <div>
          <label className="text-[9px] font-body uppercase tracking-wider block mb-1" style={{ color: "var(--text-tertiary)" }}>
            Asset
          </label>
          <div className="flex gap-1">
            <button
              onClick={() => onFiltersChange({ ...filters, asset: null })}
              className="px-2 py-1.5 rounded-[var(--radius-sm)] text-[10px] font-mono cursor-pointer"
              style={{
                background: !filters.asset ? "rgba(0, 212, 170, 0.15)" : "transparent",
                color: !filters.asset ? "var(--accent-green)" : "var(--text-muted)",
                border: `1px solid ${!filters.asset ? "rgba(0, 212, 170, 0.3)" : "var(--glass-border)"}`,
              }}
            >
              All
            </button>
            {ASSET_FILTERS.map((a) => (
              <button
                key={a}
                onClick={() => onFiltersChange({ ...filters, asset: a })}
                className="px-2 py-1.5 rounded-[var(--radius-sm)] text-[10px] font-mono cursor-pointer"
                style={{
                  background: filters.asset === a ? "rgba(0, 212, 170, 0.15)" : "transparent",
                  color: filters.asset === a ? "var(--accent-green)" : "var(--text-muted)",
                  border: `1px solid ${filters.asset === a ? "rgba(0, 212, 170, 0.3)" : "var(--glass-border)"}`,
                }}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* Max Price */}
        <div>
          <label className="text-[9px] font-body uppercase tracking-wider block mb-1" style={{ color: "var(--text-tertiary)" }}>
            Max ${filters.maxPrice}/mo
          </label>
          <input
            type="range"
            min={50}
            max={2000}
            step={50}
            value={filters.maxPrice}
            onChange={(e) =>
              onFiltersChange({ ...filters, maxPrice: parseInt(e.target.value) })
            }
            className="w-28 accent-emerald-500"
          />
        </div>

        {/* Min Win Rate */}
        <div>
          <label className="text-[9px] font-body uppercase tracking-wider block mb-1" style={{ color: "var(--text-tertiary)" }}>
            Min WR {filters.minWinRate}%
          </label>
          <input
            type="range"
            min={0}
            max={90}
            step={5}
            value={filters.minWinRate}
            onChange={(e) =>
              onFiltersChange({ ...filters, minWinRate: parseInt(e.target.value) })
            }
            className="w-24 accent-emerald-500"
          />
        </div>

        {/* Min Rating */}
        <div>
          <label className="text-[9px] font-body uppercase tracking-wider block mb-1" style={{ color: "var(--text-tertiary)" }}>
            Min ★ {filters.minRating}
          </label>
          <input
            type="range"
            min={0}
            max={5}
            step={0.5}
            value={filters.minRating}
            onChange={(e) =>
              onFiltersChange({ ...filters, minRating: parseFloat(e.target.value) })
            }
            className="w-20 accent-emerald-500"
          />
        </div>

        {/* Result count */}
        <div className="ml-auto">
          <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
            {resultCount} analyst{resultCount !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
