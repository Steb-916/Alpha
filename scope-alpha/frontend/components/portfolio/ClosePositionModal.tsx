"use client";

/**
 * Close position modal. Prompts for the close price and submits to
 * /api/portfolio/[id]/close.
 */

import { useMemo, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { calculateLegacySinglePnL } from "@/lib/signals/validation";

interface PositionLike {
  id: string;
  signal: {
    assetSymbol: string;
    direction: string;
    entryPrice: number;
  };
  personalEntry: number | null;
}

interface Props {
  position: PositionLike;
  onClose: () => void;
  onClosed: () => void;
}

export function ClosePositionModal({ position, onClose, onClosed }: Props) {
  const entry = position.personalEntry ?? position.signal.entryPrice;
  const [closePrice, setClosePrice] = useState<string>(String(entry));
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewPnl = useMemo(() => {
    const n = parseFloat(closePrice);
    if (!Number.isFinite(n)) return null;
    return calculateLegacySinglePnL(
      n,
      position.signal.direction as "long" | "short",
      entry,
    );
  }, [closePrice, entry, position.signal.direction]);

  const submit = async () => {
    setError(null);
    const n = parseFloat(closePrice);
    if (!Number.isFinite(n) || n <= 0) {
      setError("Close price must be a positive number");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/portfolio/${position.id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ closePrice: n, notes: notes || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `HTTP ${res.status}`);
        setSubmitting(false);
        return;
      }
      onClosed();
      onClose();
    } catch (e) {
      setError((e as Error).message || "Failed to close position");
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
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md">
        <GlassCard>
          <div className="flex items-center justify-between mb-3">
            <h2
              className="text-base font-bold font-display"
              style={{ color: "var(--text-primary)" }}
            >
              Close {position.signal.assetSymbol} {position.signal.direction.toUpperCase()}
            </h2>
            <button
              onClick={onClose}
              className="text-xs cursor-pointer"
              style={{ color: "var(--text-muted)" }}
            >
              ✕
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label
                className="block text-[10px] font-body uppercase tracking-wider mb-1"
                style={{ color: "var(--text-tertiary)" }}
              >
                Your entry was ${entry.toLocaleString()}
              </label>
            </div>

            <div>
              <label
                className="block text-[10px] font-body uppercase tracking-wider mb-1"
                style={{ color: "var(--text-tertiary)" }}
              >
                Close price
              </label>
              <input
                type="number"
                step="any"
                value={closePrice}
                onChange={(e) => setClosePrice(e.target.value)}
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

            {previewPnl != null && (
              <div
                className="py-2 px-3 rounded-[var(--radius-sm)] text-center"
                style={{
                  background:
                    previewPnl >= 0 ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                }}
              >
                <span className="text-[10px] font-body" style={{ color: "var(--text-muted)" }}>
                  Personal P&L:{" "}
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
                className="py-2 px-3 rounded-[var(--radius-sm)] text-xs font-body"
                style={{
                  background: "rgba(239,68,68,0.1)",
                  color: "#EF4444",
                  border: "1px solid rgba(239,68,68,0.3)",
                }}
              >
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
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
                type="button"
                onClick={submit}
                disabled={submitting}
                className="px-4 py-2 text-xs font-bold cursor-pointer rounded-[var(--radius-sm)]"
                style={{
                  background: "var(--accent-green)",
                  color: "#fff",
                  opacity: submitting ? 0.5 : 1,
                }}
              >
                {submitting ? "Closing…" : "Close Position"}
              </button>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
