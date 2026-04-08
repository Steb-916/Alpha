"use client";

/**
 * Multi-target input for the Pro signal creation form.
 *
 * Renders up to 5 target rows with label/price/closePercent inputs, an
 * Add/Remove button, an "Equal split" helper, and a live "Total: 100%"
 * indicator that turns red when the percents don't sum to 100.
 */

import { useMemo } from "react";
import { CLOSE_PERCENT_EPSILON, MAX_TARGETS } from "@/config/signals";
import type { SignalTargetInput } from "@/lib/signals/validation";

interface Props {
  targets: SignalTargetInput[];
  onChange: (targets: SignalTargetInput[]) => void;
}

const inputStyle: React.CSSProperties = {
  background: "var(--glass-bg)",
  border: "1px solid var(--glass-border)",
  color: "var(--text-primary)",
};

export function MultiTargetInput({ targets, onChange }: Props) {
  const totalPct = useMemo(
    () => targets.reduce((s, t) => s + (Number(t.closePercent) || 0), 0),
    [targets],
  );
  const isValid = Math.abs(totalPct - 100) < CLOSE_PERCENT_EPSILON;

  const updateTarget = (idx: number, patch: Partial<SignalTargetInput>) => {
    onChange(targets.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  };

  const addTarget = () => {
    if (targets.length >= MAX_TARGETS) return;
    const next = `TP${targets.length + 1}`;
    onChange([...targets, { label: next, price: 0, closePercent: 0 }]);
  };

  const removeTarget = (idx: number) => {
    if (targets.length <= 1) return;
    onChange(targets.filter((_, i) => i !== idx));
  };

  const equalSplit = () => {
    const n = targets.length;
    if (n === 0) return;
    const each = Math.round((100 / n) * 100) / 100;
    // Last row absorbs the rounding difference so the sum is exactly 100.
    onChange(
      targets.map((t, i) => ({
        ...t,
        closePercent: i === n - 1 ? Math.round((100 - each * (n - 1)) * 100) / 100 : each,
      })),
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label
          className="text-[10px] font-bold font-body uppercase tracking-wider"
          style={{ color: "var(--text-tertiary)" }}
        >
          Targets ({targets.length}/{MAX_TARGETS})
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={equalSplit}
            className="text-[10px] font-body cursor-pointer"
            style={{ color: "var(--accent-green)" }}
          >
            Equal split
          </button>
          <span
            className="text-[10px] font-mono font-bold"
            style={{ color: isValid ? "var(--accent-green)" : "var(--accent-red)" }}
          >
            {totalPct.toFixed(2)}% / 100%
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {targets.map((t, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input
              type="text"
              value={t.label}
              maxLength={6}
              onChange={(e) => updateTarget(idx, { label: e.target.value })}
              className="w-14 px-2 py-1.5 rounded-[var(--radius-sm)] text-xs font-mono outline-none"
              style={inputStyle}
            />
            <input
              type="number"
              step="any"
              placeholder="price"
              value={t.price || ""}
              onChange={(e) =>
                updateTarget(idx, { price: parseFloat(e.target.value) || 0 })
              }
              className="flex-1 px-2 py-1.5 rounded-[var(--radius-sm)] text-xs font-mono outline-none"
              style={inputStyle}
            />
            <input
              type="number"
              step="any"
              placeholder="%"
              value={t.closePercent || ""}
              onChange={(e) =>
                updateTarget(idx, { closePercent: parseFloat(e.target.value) || 0 })
              }
              className="w-16 px-2 py-1.5 rounded-[var(--radius-sm)] text-xs font-mono outline-none text-center"
              style={inputStyle}
            />
            <button
              type="button"
              onClick={() => removeTarget(idx)}
              disabled={targets.length <= 1}
              className="text-xs cursor-pointer w-6 h-6 flex items-center justify-center"
              style={{
                color: targets.length <= 1 ? "var(--text-muted)" : "var(--accent-red)",
                opacity: targets.length <= 1 ? 0.4 : 1,
              }}
              title="Remove target"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {targets.length < MAX_TARGETS && (
        <button
          type="button"
          onClick={addTarget}
          className="mt-2 text-[10px] font-body cursor-pointer"
          style={{ color: "var(--accent-green)" }}
        >
          + Add target
        </button>
      )}
    </div>
  );
}
