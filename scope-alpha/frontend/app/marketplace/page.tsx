"use client";

import { useState, useMemo } from "react";
import { AnalystCardItem } from "@/components/marketplace/AnalystCardItem";
import { MarketplaceFiltersBar } from "@/components/marketplace/MarketplaceFilters";
import {
  MOCK_ANALYSTS,
  filterAndSortAnalysts,
  type SortOption,
  type MarketplaceFilters,
} from "@/lib/marketplace";

const DEFAULT_FILTERS: MarketplaceFilters = {
  maxPrice: 2000,
  minWinRate: 0,
  asset: null,
  minSubscribers: 0,
  minRating: 0,
};

export default function MarketplacePage() {
  const [filters, setFilters] = useState<MarketplaceFilters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortOption>("subscribers");
  const [search, setSearch] = useState("");

  const results = useMemo(() => {
    let list = filterAndSortAnalysts(MOCK_ANALYSTS, filters, sort);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.displayName.toLowerCase().includes(q) ||
          a.slug.toLowerCase().includes(q)
      );
    }
    return list;
  }, [filters, sort, search]);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      {/* Header */}
      <div
        className="sticky top-0 z-50 px-6 py-3 flex items-center justify-between"
        style={{
          background: "rgba(10, 14, 20, 0.85)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--glass-border)",
        }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="text-sm font-body cursor-pointer"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-green)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            ← Back
          </button>
          <span className="text-xs font-mono" style={{ color: "var(--text-tertiary)" }}>
            /marketplace
          </span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Title */}
        <div className="mb-6">
          <h1
            className="text-3xl font-bold font-display"
            style={{ color: "var(--text-primary)" }}
          >
            Analyst Marketplace
          </h1>
          <p className="text-sm font-body mt-1" style={{ color: "var(--text-muted)" }}>
            Discover verified trading analysts. Every signal timestamped, every result auto-graded.
          </p>
        </div>

        {/* Search */}
        <div className="mb-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search analysts by name..."
            className="w-full max-w-md px-4 py-2.5 rounded-[var(--radius-md)] text-sm font-body outline-none"
            style={{
              background: "var(--glass-bg)",
              border: "1px solid var(--glass-border)",
              color: "var(--text-primary)",
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--accent-green)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--glass-border)")}
          />
        </div>

        {/* Filters */}
        <MarketplaceFiltersBar
          filters={filters}
          sort={sort}
          onFiltersChange={setFilters}
          onSortChange={setSort}
          resultCount={results.length}
        />

        {/* Grid */}
        {results.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">🔍</div>
            <h2 className="text-lg font-bold font-display" style={{ color: "var(--text-primary)" }}>
              No analysts match your filters
            </h2>
            <p className="text-sm font-body mt-1" style={{ color: "var(--text-muted)" }}>
              Try broadening your search criteria.
            </p>
            <button
              onClick={() => setFilters(DEFAULT_FILTERS)}
              className="mt-3 text-sm font-body cursor-pointer"
              style={{ color: "var(--accent-green)" }}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map((analyst) => (
              <AnalystCardItem key={analyst.id} analyst={analyst} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
