"use client";

import { Plus, X } from "lucide-react";
import type { BacktestCondition, BacktestOperator } from "@/lib/analytics/backtest-engine";

const METRIC_FIELDS: { key: string; label: string; unit: string; hint: string }[] = [
  { key: "healthScore", label: "Health Score", unit: "0–100", hint: "e.g. 40" },
  { key: "fundingRate", label: "Funding Rate", unit: "decimal", hint: "e.g. -0.0003" },
  { key: "priceChange1d", label: "Price Change 1d", unit: "%", hint: "e.g. -3" },
  { key: "mvrvZScore", label: "MVRV Z-Score", unit: "σ", hint: "e.g. -0.5" },
  { key: "sopr", label: "SOPR", unit: "", hint: "e.g. 0.98" },
  { key: "iv30d", label: "IV 30d", unit: "decimal", hint: "e.g. 0.6" },
  { key: "close", label: "Price", unit: "$", hint: "e.g. 50000" },
  { key: "volume", label: "Volume", unit: "$", hint: "e.g. 1e9" },
];

const OPS: { op: BacktestOperator; label: string }[] = [
  { op: ">", label: ">" },
  { op: "<", label: "<" },
  { op: ">=", label: "≥" },
  { op: "<=", label: "≤" },
  { op: "==", label: "=" },
  { op: "!=", label: "≠" },
];

function ConditionRow({
  cond,
  onChange,
  onRemove,
}: {
  cond: BacktestCondition;
  onChange: (c: BacktestCondition) => void;
  onRemove: () => void;
}) {
  const field = METRIC_FIELDS.find((f) => f.key === cond.field);
  const inputStyle = {
    background: "var(--glass-bg)",
    border: "1px solid var(--glass-border)",
    color: "var(--text-primary)",
    outline: "none",
    borderRadius: "var(--radius-sm, 4px)",
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Field select */}
      <select
        value={cond.field}
        onChange={(e) => onChange({ ...cond, field: e.target.value })}
        className="px-2 py-1.5 text-xs font-mono"
        style={inputStyle}
      >
        {METRIC_FIELDS.map((f) => (
          <option key={f.key} value={f.key}>
            {f.label}
          </option>
        ))}
      </select>

      {/* Operator */}
      <select
        value={cond.operator}
        onChange={(e) => onChange({ ...cond, operator: e.target.value as BacktestOperator })}
        className="px-2 py-1.5 text-xs font-mono w-12"
        style={inputStyle}
      >
        {OPS.map((o) => (
          <option key={o.op} value={o.op}>
            {o.label}
          </option>
        ))}
      </select>

      {/* Value */}
      <input
        type="number"
        value={cond.value}
        onChange={(e) => onChange({ ...cond, value: parseFloat(e.target.value) || 0 })}
        placeholder={field?.hint ?? "0"}
        className="px-2 py-1.5 text-xs font-mono w-24"
        style={inputStyle}
      />

      {field && (
        <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
          {field.unit}
        </span>
      )}

      <button onClick={onRemove} style={{ color: "var(--text-muted)" }} className="hover:opacity-70">
        <X size={12} />
      </button>
    </div>
  );
}

export function ConditionBuilder({
  label,
  conditions,
  onChange,
}: {
  label: string;
  conditions: BacktestCondition[];
  onChange: (conds: BacktestCondition[]) => void;
}) {
  function addCondition() {
    onChange([...conditions, { field: "healthScore", operator: "<", value: 40 }]);
  }

  function updateCondition(i: number, c: BacktestCondition) {
    const next = [...conditions];
    next[i] = c;
    onChange(next);
  }

  function removeCondition(i: number) {
    onChange(conditions.filter((_, j) => j !== i));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wider font-mono font-semibold" style={{ color: "var(--text-muted)" }}>
          {label}
        </p>
        <button
          onClick={addCondition}
          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono transition-all hover:opacity-80"
          style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--text-secondary)" }}
        >
          <Plus size={10} /> Add
        </button>
      </div>

      {conditions.length === 0 && (
        <p className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>
          No conditions — click Add to define when to {label.toLowerCase().includes("entry") ? "enter" : "exit"}.
        </p>
      )}

      <div className="space-y-1.5">
        {conditions.map((cond, i) => (
          <ConditionRow
            key={i}
            cond={cond}
            onChange={(c) => updateCondition(i, c)}
            onRemove={() => removeCondition(i)}
          />
        ))}
      </div>

      {conditions.length > 1 && (
        <p className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
          All conditions must be true simultaneously (AND logic).
        </p>
      )}
    </div>
  );
}
