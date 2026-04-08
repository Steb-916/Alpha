"use client";

/**
 * Manual signal resolution modal.
 *
 * Lets the analyst tick which targets were hit, enter actual fill prices,
 * provide a final close price for the remaining position, and previews
 * the calculated total P&L before submitting to /api/signals/[id]/resolve.
 *
 * For legacy single-target signals (synthesized targets[] from targetPrice)
 * the modal degrades to a single "Final close price" field.
 */

import { useMemo, useState } from "react";
import type { Signal, SignalTarget } from "@/lib/signals";
import {
  calculateLegacySinglePnL,
  calculateMultiTargetPnL,
} from "@/lib/signals/validation";
import { GlassCard } from "@/components/ui/GlassCard";

interface Props {
  signal: Signal;
  onClose: () => void;
  onResolved: (updated: Signal) => void;
}

interface HitState {
  hit: boolean;
  hitPrice: string; // string for input control
  hitAt: string;    // ISO local datetime input value
}

function nowLocalIso(): string {
  const d = new Date();
  // datetime-local needs YYYY-MM-DDTHH:mm
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ResolveSignalModal({ signal, onClose, onResolved }: Props) {
  const isMulti = Array.isArray(signal.targets) && signal.targets.length > 1;
  const targets = signal.targets ?? [];

  const [hits, setHits] = useState<Record<string, HitState>>(() => {
    const map: Record<string, HitState> = {};
    for (const t of targets) {
      map[t.id] = {
        hit: false,
        hitPrice: String(t.price),
        hitAt: nowLocalIso(),
      };
    }
    return map;
  });

  const [finalClosePrice, setFinalClosePrice] = useState<string>(
    String(signal.entryPrice),
  );
  const [notes, setNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live P&L preview.
  const previewPnl = useMemo(() => {
    const finalNum = parseFloat(finalClosePrice);
    if (!Number.isFinite(finalNum)) return null;

    if (isMulti) {
      const hitTargets = targets
        .filter((t) => hits[t.id]?.hit)
        .map((t) => ({
          closePercent: t.closePercent,
          hitPrice: parseFloat(hits[t.id].hitPrice),
        }))
        .filter((t) => Number.isFinite(t.hitPrice));
      return calculateMultiTargetPnL(
        hitTargets,
        finalNum,
        signal.direction,
        signal.entryPrice,
      );
    }
    return calculateLegacySinglePnL(finalNum, signal.direction, signal.entryPrice);
  }, [hits, finalClosePrice, isMulti, targets, signal.direction, signal.entryPrice]);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const finalNum = parseFloat(finalClosePrice);
      if (!Number.isFinite(finalNum) || finalNum <= 0) {
        setError("Final close price must be a positive number");
        setSubmitting(false);
        return;
      }

      const targetHits = isMulti
        ? targets
            .filter((t) => hits[t.id]?.hit)
            .map((t) => {
              const h = hits[t.id];
              return {
                targetId: t.id,
                hitPrice: parseFloat(h.hitPrice),
                hitAt: new Date(h.hitAt).toISOString(),
              };
            })
        : undefined;

      const res = await fetch(`/api/signals/${signal.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetHits,
          finalClosePrice: finalNum,
          notes: notes || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `HTTP ${res.status}`);
        setSubmitting(false);
        return;
      }
      const updated = await res.json();
      onResolved(updated);
      onClose();
    } catch (e) {
      setError((e as Error).message || "Failed to resolve signal");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0, 0, 0, 0.6)" }}
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg">
        <GlassCard>
          <div className="flex items-center justify-between mb-3">
            <h2
              className="text-base font-bold font-display"
              style={{ color: "var(--text-primary)" }}
            >
              Resolve {signal.assetSymbol} {signal.direction.toUpperCase()}
            </h2>
            <button
              onClick={onClose}
              className="text-xs font-body cursor-pointer"
              style={{ color: "var(--text-muted)" }}
            >
              ✕
            </button>
          </div>

          {isMulti && (
            <div className="space-y-2 mb-4">
              {targets.map((t: SignalTarget) => {
                const h = hits[t.id];
                return (
                  <div
                    key={t.id}
                    className="flex items-center gap-2 p-2 rounded-[var(--radius-sm)]"
                    style={{
                      background: h.hit ? "rgba(16,185,129,0.08)" : "var(--glass-bg)",
                      border: "1px solid var(--glass-border)",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={h.hit}
                      onChange={(e) =>
                        setHits((p) => ({ ...p, [t.id]: { ...h, hit: e.target.checked } }))
                      }
                      className="cursor-pointer"
                    />
                    <span
                      className="text-xs font-mono font-bold w-8"
                      style={{ color: "var(--accent-green)" }}
                    >
                      {t.label}
                    </span>
                    <span
                      className="text-xs font-mono w-20"
                      style={{ color: "var(--text-muted)" }}
                    >
                      ${t.price.toLocaleString()}
                    </span>
                    <input
                      type="number"
                      step="any"
                      placeholder="hit price"
                      value={h.hitPrice}
                      disabled={!h.hit}
                      onChange={(e) =>
                        setHits((p) => ({ ...p, [t.id]: { ...h, hitPrice: e.target.value } }))
                      }
                      className="flex-1 px-2 py-1 text-xs font-mono rounded-[var(--radius-sm)] outline-none"
                      style={{
                        background: "var(--glass-bg)",
                        border: "1px solid var(--glass-border)",
                        color: "var(--text-primary)",
                      }}
                    />
                    <span
                      className="text-[10px] font-mono"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {t.closePercent}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="space-y-3 mb-4">
            <div>
              <label
                className="block text-[10px] font-body uppercase tracking-wider mb-1"
                style={{ color: "var(--text-tertiary)" }}
              >
                Final close price (remaining position)
              </label>
              <input
                type="number"
                step="any"
                value={finalClosePrice}
                onChange={(e) => setFinalClosePrice(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono rounded-[var(--radius-sm)] outline-none"
                style={{
                  background: "var(--glass-bg)",
                  border: "1px solid var(--glass-border)",
                  color: "var(--text-primary)",
                }}
              />
            </div>

            <div>
              <label
                className="block text-[10px] font-body uppercase tracking-wider mb-1"
                style={{ color: "var(--text-tertiary)" }}
              >
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-xs font-body rounded-[var(--radius-sm)] outline-none resize-none"
                style={{
                  background: "var(--glass-bg)",
                  border: "1px solid var(--glass-border)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
          </div>

          {previewPnl !== null && (
            <div
              className="py-2 px-3 rounded-[var(--radius-sm)] text-center mb-4"
              style={{
                background:
                  previewPnl >= 0 ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
              }}
            >
              <span className="text-[10px] font-body" style={{ color: "var(--text-muted)" }}>
                Estimated total P&L:{" "}
              </span>
              <span
                className="text-sm font-mono font-bold"
                style={{ color: previewPnl >= 0 ? "#10B981" : "#EF4444" }}
              >
                {previewPnl >= 0 ? "+" : ""}
                {previewPnl.toFixed(4)}%
              </span>
            </div>
          )}

          {error && (
            <div
              className="py-2 px-3 rounded-[var(--radius-sm)] mb-3 text-xs font-body"
              style={{
                background: "rgba(239, 68, 68, 0.1)",
                color: "#EF4444",
                border: "1px solid rgba(239, 68, 68, 0.3)",
              }}
            >
              {error}
            </div>
          )}

          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-body cursor-pointer rounded-[var(--radius-sm)]"
              style={{
                background: "var(--glass-bg)",
                border: "1px solid var(--glass-border)",
                color: "var(--text-secondary)",
              }}
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={submitting}
              className="px-4 py-2 text-xs font-bold font-body cursor-pointer rounded-[var(--radius-sm)]"
              style={{
                background: "var(--accent-green)",
                color: "#fff",
                opacity: submitting ? 0.5 : 1,
              }}
            >
              {submitting ? "Resolving…" : "Resolve Signal"}
            </button>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
