"use client";

import { useEffect, useState, useCallback } from "react";
import type { ScreenerRow } from "@/lib/types";

export type FilterOperator = ">" | "<" | ">=" | "<=" | "==" | "!=";

export interface FilterRule {
  id: string;
  field: string;
  operator: FilterOperator;
  value: string;
}

export interface FilterField {
  key: string;
  label: string;
  type: "number" | "enum";
  unit?: string;
  options?: string[];
  domain: "Market" | "Derivatives" | "Options" | "Regime";
  /** multiply raw ScreenerRow value by this before comparing to user input */
  scale?: number;
}

export const FILTER_FIELDS: FilterField[] = [
  // Market
  { key: "price", label: "Price", type: "number", unit: "$", domain: "Market" },
  { key: "change24h", label: "24h Change", type: "number", unit: "%", domain: "Market" },
  { key: "volume24h", label: "Volume 24h", type: "number", unit: "$", domain: "Market" },
  // Derivatives
  {
    key: "fundingRate", label: "Funding Rate", type: "number",
    unit: "% (e.g. 0.01 = 0.01%)", domain: "Derivatives", scale: 100,
  },
  { key: "fundingZ", label: "Funding Z-Score", type: "number", unit: "σ", domain: "Derivatives" },
  { key: "oiChange24h", label: "OI Change 24h", type: "number", unit: "%", domain: "Derivatives" },
  { key: "liqRatio", label: "Liq Ratio (L/S)", type: "number", unit: "x", domain: "Derivatives" },
  {
    key: "basis", label: "Basis", type: "number",
    unit: "% (e.g. 0.5 = 0.5%)", domain: "Derivatives", scale: 100,
  },
  { key: "arbYield", label: "Arb Yield", type: "number", unit: "%/yr", domain: "Derivatives" },
  // Options
  {
    key: "atmIV30d", label: "ATM IV 30d", type: "number",
    unit: "% (e.g. 60 = 60%)", domain: "Options", scale: 100,
  },
  {
    key: "skew25d", label: "25d Skew", type: "number",
    unit: "% (e.g. 5 = 5%)", domain: "Options", scale: 100,
  },
  {
    key: "volRegime", label: "Vol Regime", type: "enum",
    options: ["low", "normal", "high", "extreme"], domain: "Options",
  },
  // Regime
  { key: "healthScore", label: "Health Score", type: "number", unit: "0–100", domain: "Regime" },
  {
    key: "cvdTrend", label: "CVD Trend", type: "enum",
    options: ["bullish", "bearish", "neutral"], domain: "Regime",
  },
  {
    key: "regimeV2", label: "Regime", type: "enum",
    options: ["extreme_fear", "bearish", "cautious", "neutral", "optimistic", "bullish", "euphoria"],
    domain: "Regime",
  },
];

function evaluateRule(row: ScreenerRow, rule: FilterRule): boolean {
  const fieldDef = FILTER_FIELDS.find((f) => f.key === rule.field);
  if (!fieldDef) return true;

  const raw = (row as Record<string, unknown>)[rule.field];
  if (raw == null) return false;

  if (fieldDef.type === "enum") {
    const s = String(raw).toLowerCase();
    const v = rule.value.toLowerCase();
    return rule.operator === "==" ? s === v : s !== v;
  }

  // numeric — apply scale so user inputs human-readable values
  const scale = fieldDef.scale ?? 1;
  const actual = (raw as number) * scale;
  const threshold = parseFloat(rule.value);
  if (isNaN(threshold)) return true;

  switch (rule.operator) {
    case ">": return actual > threshold;
    case "<": return actual < threshold;
    case ">=": return actual >= threshold;
    case "<=": return actual <= threshold;
    case "==": return Math.abs(actual - threshold) < 0.0001;
    case "!=": return Math.abs(actual - threshold) >= 0.0001;
  }
}

function applyFilters(rows: ScreenerRow[], rules: FilterRule[]): ScreenerRow[] {
  if (!rules.length) return rows;
  return rows.filter((row) => rules.every((rule) => evaluateRule(row, rule)));
}

export type SortField = keyof ScreenerRow | null;
export type SortDir = "asc" | "desc";

export function useScreener() {
  const [allRows, setAllRows] = useState<ScreenerRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [rules, setRules] = useState<FilterRule[]>([]);
  const [sortField, setSortField] = useState<SortField>("rank");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      try {
        const res = await fetch("/api/market/screener");
        if (res.ok && !cancelled) {
          const json = await res.json();
          setAllRows(json.rows ?? []);
          setUpdatedAt(json._cachedAt ? new Date(json._cachedAt).toISOString() : null);
        }
      } catch {
        /* silent */
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const addRule = useCallback((rule: Omit<FilterRule, "id">) => {
    setRules((prev) => [...prev, { ...rule, id: crypto.randomUUID() }]);
  }, []);

  const removeRule = useCallback((id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const clearRules = useCallback(() => setRules([]), []);

  const loadRules = useCallback((newRules: FilterRule[]) => setRules(newRules), []);

  const toggleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDir("asc");
      }
    },
    [sortField],
  );

  const filtered = applyFilters(allRows, rules);

  const sorted = [...filtered].sort((a, b) => {
    if (!sortField) return 0;
    const av = a[sortField] as number | string | undefined;
    const bv = b[sortField] as number | string | undefined;
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === "asc" ? cmp : -cmp;
  });

  return {
    allRows,
    filtered: sorted,
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
  };
}
