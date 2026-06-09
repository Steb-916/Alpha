"use client";

import { Download, RefreshCw } from "lucide-react";
import { useScreener } from "@/hooks/useScreener";
import { ScreenerFilters } from "@/components/tools/screener/ScreenerFilters";
import { ScreenerTable } from "@/components/tools/screener/ScreenerTable";
import { ScreenerPresets } from "@/components/tools/screener/ScreenerPresets";
import { exportScreenerCsv } from "@/lib/utils/exportCsv";

export default function ScreenerPage() {
  const {
    allRows,
    filtered,
    isLoading,
    updatedAt,
    rules,
    addRule,
    removeRule,
    clearRules,
    loadRules,
    sortField,
    sortDir,
    toggleSort,
  } = useScreener();

  const lastUpdate = updatedAt
    ? new Date(updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="h-full flex flex-col gap-4 p-4 overflow-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1
            className="text-xl font-bold font-display"
            style={{ color: "var(--text-primary)" }}
          >
            Multi-Factor Screener
          </h1>
          <p className="text-xs font-mono mt-0.5" style={{ color: "var(--text-muted)" }}>
            Filter across derivatives, options, on-chain, and regime data
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>
            {isLoading && <RefreshCw size={11} className="animate-spin" />}
            {lastUpdate && !isLoading && <span>Updated {lastUpdate}</span>}
          </div>

          <ScreenerPresets rules={rules} onLoad={loadRules} />

          <button
            onClick={() => exportScreenerCsv(filtered)}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-pill)] text-xs font-mono transition-all disabled:opacity-40 hover:opacity-80"
            style={{
              background: "var(--glass-bg)",
              border: "1px solid var(--glass-border)",
              color: "var(--text-secondary)",
            }}
          >
            <Download size={12} />
            CSV
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <ScreenerFilters
        rules={rules}
        onAdd={addRule}
        onRemove={removeRule}
        onClear={clearRules}
      />

      {/* Stats bar */}
      <div className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>
        Showing{" "}
        <span style={{ color: "var(--text-secondary)" }}>{filtered.length}</span>{" "}
        of {allRows.length} assets
        {rules.length > 0 && (
          <span>
            {" "}· {rules.length} filter{rules.length !== 1 ? "s" : ""} active
          </span>
        )}
      </div>

      {/* Table */}
      <ScreenerTable
        rows={filtered}
        isLoading={isLoading}
        sortField={sortField}
        sortDir={sortDir}
        onSort={toggleSort}
      />

      <p className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
        Data refreshed via background cron. Not financial advice. Filters are evaluated
        client-side against cached data.
      </p>
    </div>
  );
}
