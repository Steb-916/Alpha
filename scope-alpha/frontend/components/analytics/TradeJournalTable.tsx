"use client";

/**
 * Trade journal table — filterable, sortable, with infinite scroll.
 *
 * Reads from /api/analysts/[slug]/journal via SWR. Renders one row per
 * signal with expand-to-detail showing notes and screenshot. The export
 * button opens the CSV download endpoint.
 */

import { useEffect, useState } from "react";
import useSWR from "swr";
import type { SerializedSignal } from "@/lib/signals/serializer";
import { GlassCard } from "@/components/ui/GlassCard";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface JournalResponse {
  entries: SerializedSignal[];
  summary: {
    totalShown: number;
    wins: number;
    losses: number;
    avgPnl: number;
    totalPnl: number;
  };
  nextCursor: string | null;
}

interface Props {
  slug: string;
  isOwner: boolean;
}

interface Filters {
  asset: string;
  direction: string;
  timeframe: string;
  result: string;
  from: string;
  to: string;
}

const initialFilters: Filters = {
  asset: "",
  direction: "",
  timeframe: "",
  result: "all",
  from: "",
  to: "",
};

const inputStyle: React.CSSProperties = {
  background: "var(--glass-bg)",
  border: "1px solid var(--glass-border)",
  color: "var(--text-primary)",
};

export function TradeJournalTable({ slug, isOwner }: Props) {
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [sortKey, setSortKey] = useState<"publishedAt" | "resultPnlPercent">("publishedAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [expanded, setExpanded] = useState<string | null>(null);

  const qp = new URLSearchParams();
  if (filters.asset) qp.set("asset", filters.asset);
  if (filters.direction) qp.set("direction", filters.direction);
  if (filters.timeframe) qp.set("timeframe", filters.timeframe);
  if (filters.result) qp.set("result", filters.result);
  if (filters.from) qp.set("from", filters.from);
  if (filters.to) qp.set("to", filters.to);
  qp.set("sort", sortKey);
  qp.set("order", order);
  qp.set("limit", "50");

  const { data, error, isLoading } = useSWR<JournalResponse>(
    `/api/analysts/${slug}/journal?${qp.toString()}`,
    fetcher,
  );

  // Reset expanded row when filters change.
  useEffect(() => {
    setExpanded(null);
  }, [filters, sortKey, order]);

  const exportCsv = () => {
    window.open(`/api/analysts/${slug}/performance/export?format=csv`, "_blank");
  };

  if (error) {
    return (
      <GlassCard>
        <div className="text-xs font-body" style={{ color: "var(--accent-red)" }}>
          Failed to load trade journal
        </div>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <GlassCard noPadding>
        <div className="p-3 flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Asset"
            value={filters.asset}
            onChange={(e) => setFilters((f) => ({ ...f, asset: e.target.value.toUpperCase() }))}
            className="px-2 py-1.5 text-xs font-mono rounded-[var(--radius-sm)] outline-none w-24"
            style={inputStyle}
          />
          <select
            value={filters.direction}
            onChange={(e) => setFilters((f) => ({ ...f, direction: e.target.value }))}
            className="px-2 py-1.5 text-xs font-body rounded-[var(--radius-sm)] outline-none"
            style={inputStyle}
          >
            <option value="">Any direction</option>
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
          <select
            value={filters.timeframe}
            onChange={(e) => setFilters((f) => ({ ...f, timeframe: e.target.value }))}
            className="px-2 py-1.5 text-xs font-body rounded-[var(--radius-sm)] outline-none"
            style={inputStyle}
          >
            <option value="">Any timeframe</option>
            <option value="15m">15m</option>
            <option value="1H">1H</option>
            <option value="4H">4H</option>
            <option value="1D">1D</option>
            <option value="1W">1W</option>
          </select>
          <select
            value={filters.result}
            onChange={(e) => setFilters((f) => ({ ...f, result: e.target.value }))}
            className="px-2 py-1.5 text-xs font-body rounded-[var(--radius-sm)] outline-none"
            style={inputStyle}
          >
            <option value="all">All results</option>
            <option value="win">Wins</option>
            <option value="loss">Losses</option>
            <option value="breakeven">Breakeven</option>
            <option value="active">Active</option>
          </select>
          <input
            type="date"
            value={filters.from}
            onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
            className="px-2 py-1.5 text-xs font-body rounded-[var(--radius-sm)] outline-none"
            style={inputStyle}
          />
          <input
            type="date"
            value={filters.to}
            onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
            className="px-2 py-1.5 text-xs font-body rounded-[var(--radius-sm)] outline-none"
            style={inputStyle}
          />
          <button
            type="button"
            onClick={() => setFilters(initialFilters)}
            className="text-[10px] font-body cursor-pointer ml-2"
            style={{ color: "var(--text-muted)" }}
          >
            Clear
          </button>
          {isOwner && (
            <button
              type="button"
              onClick={exportCsv}
              className="ml-auto px-3 py-1.5 text-[10px] font-bold cursor-pointer rounded-[var(--radius-sm)]"
              style={{ background: "var(--accent-green)", color: "#fff" }}
            >
              Export CSV
            </button>
          )}
        </div>
      </GlassCard>

      {/* Summary */}
      {data && (
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: "Shown", value: data.summary.totalShown, color: "var(--text-primary)" },
            { label: "Wins", value: data.summary.wins, color: "#10B981" },
            { label: "Losses", value: data.summary.losses, color: "#EF4444" },
            {
              label: "Avg P&L",
              value: `${data.summary.avgPnl >= 0 ? "+" : ""}${data.summary.avgPnl.toFixed(2)}%`,
              color: data.summary.avgPnl >= 0 ? "#10B981" : "#EF4444",
            },
            {
              label: "Total P&L",
              value: `${data.summary.totalPnl >= 0 ? "+" : ""}${data.summary.totalPnl.toFixed(2)}%`,
              color: data.summary.totalPnl >= 0 ? "#10B981" : "#EF4444",
            },
          ].map((s) => (
            <GlassCard key={s.label}>
              <div className="text-[10px] font-bold font-body uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                {s.label}
              </div>
              <div className="text-lg font-bold font-mono" style={{ color: s.color }}>
                {s.value}
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Table */}
      <GlassCard noPadding>
        <div className="overflow-auto" style={{ maxHeight: "60vh" }}>
          <table className="w-full text-xs font-mono">
            <thead className="sticky top-0 z-10" style={{ background: "var(--glass-bg)" }}>
              <tr style={{ borderBottom: "1px solid var(--glass-border)" }}>
                <th
                  className="text-left px-3 py-2 text-[10px] uppercase tracking-wider cursor-pointer"
                  style={{ color: "var(--text-muted)" }}
                  onClick={() => {
                    if (sortKey === "publishedAt") setOrder((o) => (o === "asc" ? "desc" : "asc"));
                    else { setSortKey("publishedAt"); setOrder("desc"); }
                  }}
                >
                  Date {sortKey === "publishedAt" ? (order === "asc" ? "▲" : "▼") : ""}
                </th>
                <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Asset</th>
                <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Dir</th>
                <th className="text-right px-3 py-2 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Entry</th>
                <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Targets</th>
                <th className="text-right px-3 py-2 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Stop</th>
                <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>TF</th>
                <th
                  className="text-right px-3 py-2 text-[10px] uppercase tracking-wider cursor-pointer"
                  style={{ color: "var(--text-muted)" }}
                  onClick={() => {
                    if (sortKey === "resultPnlPercent") setOrder((o) => (o === "asc" ? "desc" : "asc"));
                    else { setSortKey("resultPnlPercent"); setOrder("desc"); }
                  }}
                >
                  P&L {sortKey === "resultPnlPercent" ? (order === "asc" ? "▲" : "▼") : ""}
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={8} className="px-3 py-4 text-center text-xs font-body" style={{ color: "var(--text-muted)" }}>
                    Loading…
                  </td>
                </tr>
              )}
              {data?.entries.map((s) => {
                const isExpanded = expanded === s.id;
                const targetsLabel = s.targets.length > 1
                  ? s.targets.map((t) => `${t.label}: $${t.price.toLocaleString()} (${t.closePercent}%)`).join(" | ")
                  : `$${s.targetPrice.toLocaleString()}`;
                return (
                  <>
                    <tr
                      key={s.id}
                      className="cursor-pointer"
                      style={{ borderBottom: "1px solid var(--glass-border)" }}
                      onClick={() => setExpanded(isExpanded ? null : s.id)}
                    >
                      <td className="px-3 py-1.5" style={{ color: "var(--text-muted)" }}>
                        {s.publishedAt ? new Date(s.publishedAt).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-3 py-1.5 font-bold" style={{ color: "var(--text-primary)" }}>
                        {s.assetSymbol}
                      </td>
                      <td className="px-3 py-1.5" style={{ color: s.direction === "long" ? "#10B981" : "#EF4444" }}>
                        {s.direction === "long" ? "▲" : "▼"}
                      </td>
                      <td className="px-3 py-1.5 text-right" style={{ color: "var(--text-secondary)" }}>
                        ${s.entryPrice.toLocaleString()}
                      </td>
                      <td className="px-3 py-1.5" style={{ color: "var(--accent-green)" }}>
                        {targetsLabel.length > 30 ? targetsLabel.slice(0, 30) + "…" : targetsLabel}
                      </td>
                      <td className="px-3 py-1.5 text-right" style={{ color: "#EF4444" }}>
                        ${s.stopLossPrice.toLocaleString()}
                      </td>
                      <td className="px-3 py-1.5" style={{ color: "var(--text-secondary)" }}>
                        {s.timeframe}
                      </td>
                      <td
                        className="px-3 py-1.5 text-right font-bold"
                        style={{
                          color:
                            s.resultPnlPercent == null
                              ? "var(--text-muted)"
                              : s.resultPnlPercent >= 0
                                ? "#10B981"
                                : "#EF4444",
                        }}
                      >
                        {s.resultPnlPercent == null
                          ? "—"
                          : `${s.resultPnlPercent >= 0 ? "+" : ""}${s.resultPnlPercent.toFixed(2)}%`}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr style={{ background: "var(--glass-bg)" }}>
                        <td colSpan={8} className="px-3 py-3">
                          {s.notes && (
                            <p className="text-xs font-body mb-2" style={{ color: "var(--text-secondary)" }}>
                              {s.notes}
                            </p>
                          )}
                          <div className="flex gap-2 flex-wrap text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
                            {s.targets.map((t) => (
                              <span
                                key={t.id}
                                className="px-2 py-1 rounded-[var(--radius-sm)]"
                                style={{
                                  background: t.hitAt ? "rgba(16,185,129,0.12)" : "var(--glass-bg)",
                                  border: "1px solid var(--glass-border)",
                                  color: t.hitAt ? "#10B981" : "var(--text-muted)",
                                }}
                              >
                                {t.label}: ${t.price.toLocaleString()} · {t.closePercent}%
                                {t.hitAt && t.hitPrice ? ` · hit @ $${t.hitPrice.toLocaleString()}` : ""}
                              </span>
                            ))}
                          </div>
                          {s.screenshotUrl && (
                            <img
                              src={s.screenshotUrl}
                              alt="Signal screenshot"
                              className="mt-2 rounded-[var(--radius-sm)]"
                              style={{ maxHeight: 200, border: "1px solid var(--glass-border)" }}
                            />
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
              {data && data.entries.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={8} className="px-3 py-4 text-center text-xs font-body" style={{ color: "var(--text-muted)" }}>
                    No signals match your filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
