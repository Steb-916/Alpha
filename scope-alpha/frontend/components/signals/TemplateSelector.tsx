"use client";

/**
 * Template selector for the Pro signal creation form.
 *
 * - Lists the analyst's templates via SWR.
 * - "Apply" calls /api/signal-templates/[id]/apply with the current entry
 *   price and direction → returns absolute prices the form merges in.
 * - "Save as Template" prompts for a name and POSTs the current form
 *   state as a new template (relative percentages computed from absolute
 *   prices).
 */

import { useState } from "react";
import useSWR from "swr";
import type { SignalTemplate } from "@prisma/client";
import type { SignalTargetInput } from "@/lib/signals/validation";
import type { Direction } from "@/config/signals";
import type { AppliedTemplate, RelativeTarget } from "@/lib/signals/templates";

interface Props {
  entryPrice: number;
  direction: Direction;
  stopLossPrice: number;
  targets: SignalTargetInput[];
  onApply: (applied: AppliedTemplate) => void;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const inputStyle: React.CSSProperties = {
  background: "var(--glass-bg)",
  border: "1px solid var(--glass-border)",
  color: "var(--text-primary)",
};

export function TemplateSelector({
  entryPrice,
  direction,
  stopLossPrice,
  targets,
  onApply,
}: Props) {
  const { data, mutate } = useSWR<SignalTemplate[]>("/api/signal-templates", fetcher);
  const [selectedId, setSelectedId] = useState<string>("");
  const [savingMode, setSavingMode] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const apply = async () => {
    if (!selectedId) return;
    if (!entryPrice || entryPrice <= 0) {
      setError("Enter an entry price first");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/signal-templates/${selectedId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryPrice, direction }),
      });
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
        return;
      }
      const applied: AppliedTemplate = await res.json();
      onApply(applied);
    } finally {
      setBusy(false);
    }
  };

  const saveAsTemplate = async () => {
    if (!newName.trim()) {
      setError("Template name is required");
      return;
    }
    if (!entryPrice || entryPrice <= 0) {
      setError("Enter an entry price first so percentages can be computed");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Compute relative percentages from current absolute prices.
      const sign = direction === "long" ? 1 : -1;
      const stopPercent =
        stopLossPrice > 0
          ? Math.abs(((entryPrice - stopLossPrice) / entryPrice) * 100)
          : null;
      const relativeTargets: RelativeTarget[] = targets.map((t) => ({
        label: t.label,
        percentFromEntry: ((t.price - entryPrice) / entryPrice) * 100 * sign,
        closePercent: t.closePercent,
      }));

      const res = await fetch("/api/signal-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          direction,
          stopPercent,
          targets: relativeTargets,
        }),
      });
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
        return;
      }
      await mutate();
      setSavingMode(false);
      setNewName("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <label
        className="block text-[10px] font-bold font-body mb-1 uppercase tracking-wider"
        style={{ color: "var(--text-tertiary)" }}
      >
        Templates
      </label>
      <div className="flex items-center gap-2">
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="flex-1 px-2 py-1.5 rounded-[var(--radius-sm)] text-xs font-body outline-none"
          style={inputStyle}
        >
          <option value="">— Select template —</option>
          {(data || []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={apply}
          disabled={!selectedId || busy}
          className="px-3 py-1.5 text-[10px] font-bold cursor-pointer rounded-[var(--radius-sm)]"
          style={{
            background: "var(--accent-green)",
            color: "#fff",
            opacity: !selectedId || busy ? 0.5 : 1,
          }}
        >
          Apply
        </button>
        <button
          type="button"
          onClick={() => setSavingMode((p) => !p)}
          className="px-3 py-1.5 text-[10px] font-body cursor-pointer rounded-[var(--radius-sm)]"
          style={{
            background: "var(--glass-bg)",
            border: "1px solid var(--glass-border)",
            color: "var(--text-secondary)",
          }}
        >
          {savingMode ? "Cancel" : "Save as…"}
        </button>
      </div>

      {savingMode && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="text"
            placeholder="Template name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 px-2 py-1.5 rounded-[var(--radius-sm)] text-xs font-body outline-none"
            style={inputStyle}
          />
          <button
            type="button"
            onClick={saveAsTemplate}
            disabled={busy}
            className="px-3 py-1.5 text-[10px] font-bold cursor-pointer rounded-[var(--radius-sm)]"
            style={{ background: "var(--accent-green)", color: "#fff" }}
          >
            Save
          </button>
        </div>
      )}

      {error && (
        <div
          className="mt-2 text-[10px] font-body"
          style={{ color: "var(--accent-red)" }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
