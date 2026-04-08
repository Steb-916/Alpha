"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { AnalystCardItem } from "@/components/marketplace/AnalystCardItem";
import { MarketplaceFiltersBar } from "@/components/marketplace/MarketplaceFilters";
import { TrendingAnalysts } from "@/components/marketplace/TrendingAnalysts";
import { SearchAutocomplete } from "@/components/marketplace/SearchAutocomplete";
import { CompareBar } from "@/components/marketplace/CompareBar";
import { AdvancedFilters } from "@/components/marketplace/AdvancedFilters";
import {
  MOCK_ANALYSTS,
  filterAndSortAnalysts,
  type AnalystCard,
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

// Phase 5 advanced filter state. Layered ON TOP of the legacy MarketplaceFilters
// shape via the AdvancedFilters component (which still drives the existing
// simple bar). Range filters are sent server-side; legacy filters work both
// server-side (via the API query) and client-side (via filterAndSortAnalysts
// on the mock-fallback path).
export interface AdvancedFilterState {
  q: string;
  minWinRate?: number;
  maxWinRate?: number;
  minPnl?: number;
  maxPnl?: number;
  minPrice?: number;
  maxPrice?: number;
  minSignals?: number;
  minSubscribers?: number;
  assets: string[];
  rating?: number;
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

function buildQuery(adv: AdvancedFilterState, sort: SortOption): string {
  const params = new URLSearchParams();
  if (adv.q) params.set("q", adv.q);
  if (adv.minWinRate != null) params.set("minWinRate", String(adv.minWinRate));
  if (adv.maxWinRate != null) params.set("maxWinRate", String(adv.maxWinRate));
  if (adv.minPnl != null) params.set("minPnl", String(adv.minPnl));
  if (adv.maxPnl != null) params.set("maxPnl", String(adv.maxPnl));
  if (adv.minPrice != null) params.set("minPrice", String(adv.minPrice));
  if (adv.maxPrice != null) params.set("maxPrice", String(adv.maxPrice));
  if (adv.minSignals != null) params.set("minSignals", String(adv.minSignals));
  if (adv.minSubscribers != null)
    params.set("minSubscribers", String(adv.minSubscribers));
  if (adv.assets.length > 0) params.set("assets", adv.assets.join(","));
  if (adv.rating != null) params.set("rating", String(adv.rating));
  params.set("sort", sort);
  params.set("limit", "60");
  return params.toString();
}

export default function MarketplacePage() {
  const [filters, setFilters] = useState<MarketplaceFilters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortOption>("subscribers");
  const [advanced, setAdvanced] = useState<AdvancedFilterState>({
    q: "",
    assets: [],
  });
  // Phase 5 comparison selection (max 3 analyst slugs).
  const [compareSlugs, setCompareSlugs] = useState<string[]>([]);

  // Hybrid data source: try the API, fall back to MOCK_ANALYSTS if it returns
  // fewer than 3 results (fresh demo state).
  const apiQuery = buildQuery(advanced, sort);
  const { data: apiData } = useSWR<{ analysts: AnalystCard[]; total: number }>(
    `/api/analysts?${apiQuery}`,
    fetcher,
    { revalidateOnFocus: false },
  );

  const results = useMemo(() => {
    const apiList = apiData?.analysts ?? [];
    if (apiList.length >= 3) {
      // Real DB-backed list. Server has already filtered/sorted; just apply
      // any remaining client-side legacy filter (single-select asset still
      // works server-side via `assets`).
      return apiList;
    }

    // Fallback path: combine mock list with whatever the API returned (if
    // any), then run the legacy client-side filter pipeline.
    const combined = [...apiList, ...MOCK_ANALYSTS];
    let list = filterAndSortAnalysts(combined, filters, sort);
    if (advanced.q.trim()) {
      const q = advanced.q.toLowerCase();
      list = list.filter(
        (a) =>
          a.displayName.toLowerCase().includes(q) ||
          a.slug.toLowerCase().includes(q),
      );
    }
    if (advanced.assets.length > 0) {
      list = list.filter((a) =>
        a.primaryAssets.some((x) => advanced.assets.includes(x)),
      );
    }
    return list;
  }, [apiData, filters, sort, advanced]);

  const toggleCompare = (slug: string) => {
    setCompareSlugs((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug);
      if (prev.length >= 3) return prev;
      return [...prev, slug];
    });
  };

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
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "var(--accent-green)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "var(--text-muted)")
            }
          >
            ← Back
          </button>
          <span
            className="text-xs font-mono"
            style={{ color: "var(--text-tertiary)" }}
          >
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
          <p
            className="text-sm font-body mt-1"
            style={{ color: "var(--text-muted)" }}
          >
            Discover verified trading analysts. Every signal timestamped, every result auto-graded.
          </p>
        </div>

        {/* Phase 5: Trending row (silently hidden when empty) */}
        <TrendingAnalysts />

        {/* Phase 5: Search autocomplete (replaces basic search input) */}
        <div className="mb-4 max-w-md">
          <SearchAutocomplete
            value={advanced.q}
            onChange={(q) => setAdvanced((s) => ({ ...s, q }))}
            onSelectAsset={(asset) =>
              setAdvanced((s) => ({
                ...s,
                assets: s.assets.includes(asset) ? s.assets : [...s.assets, asset],
              }))
            }
          />
        </div>

        {/* Phase 5: Advanced filter panel */}
        <AdvancedFilters value={advanced} onChange={setAdvanced} />

        {/* Existing simple filters bar (kept for backward compat) */}
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
            <h2
              className="text-lg font-bold font-display"
              style={{ color: "var(--text-primary)" }}
            >
              No analysts match your filters
            </h2>
            <p
              className="text-sm font-body mt-1"
              style={{ color: "var(--text-muted)" }}
            >
              Try broadening your search criteria.
            </p>
            <button
              onClick={() => {
                setFilters(DEFAULT_FILTERS);
                setAdvanced({ q: "", assets: [] });
              }}
              className="mt-3 text-sm font-body cursor-pointer"
              style={{ color: "var(--accent-green)" }}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-24">
            {results.map((analyst) => (
              <AnalystCardItem
                key={analyst.id}
                analyst={analyst}
                isCompareSelected={compareSlugs.includes(analyst.slug)}
                onToggleCompare={() => toggleCompare(analyst.slug)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Phase 5: sticky compare bar — appears when ≥1 analyst selected */}
      <CompareBar slugs={compareSlugs} onClear={() => setCompareSlugs([])} />
    </div>
  );
}
