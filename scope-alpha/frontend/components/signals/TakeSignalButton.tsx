"use client";

/**
 * "Take Signal" button + inline form for non-owner subscribers.
 *
 * Three states:
 *   - Signal is not active → "Signal Closed" disabled
 *   - Already tracking → "Tracking ✓" link to /portfolio
 *   - Not yet tracking → toggleable inline form that POSTs /api/portfolio/track
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Signal } from "@/lib/signals";
import { usePortfolioStore } from "@/stores/portfolioStore";

interface Props {
  signal: Signal;
}

const inputStyle: React.CSSProperties = {
  background: "var(--glass-bg)",
  border: "1px solid var(--glass-border)",
  color: "var(--text-primary)",
};

export function TakeSignalButton({ signal }: Props) {
  const tracked = usePortfolioStore((s) => s.trackedSignalIds.has(signal.id));
  const loaded = usePortfolioStore((s) => s.loaded);
  const loadActiveTracked = usePortfolioStore((s) => s.loadActiveTracked);
  const markTracked = usePortfolioStore((s) => s.markTracked);

  const [open, setOpen] = useState(false);
  const [personalEntry, setPersonalEntry] = useState<string>(
    String(signal.entryPrice),
  );
  const [personalStop, setPersonalStop] = useState<string>("");
  const [positionSize, setPositionSize] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lazy-load on first render so the button shows the right state.
  useEffect(() => {
    if (!loaded) loadActiveTracked();
  }, [loaded, loadActiveTracked]);

  if (signal.status !== "active") {
    return (
      <span
        className="text-[10px] font-body opacity-50"
        style={{ color: "var(--text-muted)" }}
      >
        Signal closed
      </span>
    );
  }

  if (tracked) {
    return (
      <Link
        href="/portfolio"
        className="text-[10px] font-body cursor-pointer no-underline"
        style={{ color: "var(--accent-green)" }}
      >
        Tracking ✓
      </Link>
    );
  }

  const handleSubmit = async () => {
    setError(null);
    const entryNum = parseFloat(personalEntry);
    if (!Number.isFinite(entryNum) || entryNum <= 0) {
      setError("Entry price required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/portfolio/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signalId: signal.id,
          personalEntry: entryNum,
          personalStop: personalStop ? parseFloat(personalStop) : undefined,
          positionSize: positionSize ? parseFloat(positionSize) : undefined,
          notes: notes || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `HTTP ${res.status}`);
        setSubmitting(false);
        return;
      }
      markTracked(signal.id);
      setOpen(false);
    } catch (e) {
      setError((e as Error).message || "Failed to track signal");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[10px] font-body cursor-pointer"
        style={{ color: "var(--accent-green)" }}
      >
        Take Signal
      </button>
    );
  }

  return (
    <div
      className="absolute right-0 top-full mt-1 z-30 w-72 p-3 rounded-[var(--radius-md)] space-y-2"
      style={{
        background: "rgba(11, 14, 20, 0.97)",
        backdropFilter: "blur(20px)",
        border: "1px solid var(--accent-green)",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between">
        <span
          className="text-[10px] font-bold font-body uppercase tracking-wider"
          style={{ color: "var(--accent-green)" }}
        >
          Take {signal.assetSymbol} {signal.direction.toUpperCase()}
        </span>
        <button
          onClick={() => setOpen(false)}
          className="text-xs cursor-pointer"
          style={{ color: "var(--text-muted)" }}
        >
          ✕
        </button>
      </div>

      <div>
        <label
          className="block text-[9px] font-body uppercase tracking-wider"
          style={{ color: "var(--text-tertiary)" }}
        >
          Your entry price
        </label>
        <input
          type="number"
          step="any"
          value={personalEntry}
          onChange={(e) => setPersonalEntry(e.target.value)}
          className="w-full px-2 py-1.5 text-xs font-mono rounded-[var(--radius-sm)] outline-none"
          style={inputStyle}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label
            className="block text-[9px] font-body uppercase tracking-wider"
            style={{ color: "var(--text-tertiary)" }}
          >
            Stop (opt.)
          </label>
          <input
            type="number"
            step="any"
            value={personalStop}
            onChange={(e) => setPersonalStop(e.target.value)}
            className="w-full px-2 py-1.5 text-xs font-mono rounded-[var(--radius-sm)] outline-none"
            style={inputStyle}
          />
        </div>
        <div>
          <label
            className="block text-[9px] font-body uppercase tracking-wider"
            style={{ color: "var(--text-tertiary)" }}
          >
            Size (opt.)
          </label>
          <input
            type="number"
            step="any"
            value={positionSize}
            onChange={(e) => setPositionSize(e.target.value)}
            className="w-full px-2 py-1.5 text-xs font-mono rounded-[var(--radius-sm)] outline-none"
            style={inputStyle}
          />
        </div>
      </div>

      <div>
        <label
          className="block text-[9px] font-body uppercase tracking-wider"
          style={{ color: "var(--text-tertiary)" }}
        >
          Notes (opt.)
        </label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full px-2 py-1.5 text-xs font-body rounded-[var(--radius-sm)] outline-none"
          style={inputStyle}
        />
      </div>

      {error && (
        <div className="text-[10px] font-body" style={{ color: "var(--accent-red)" }}>
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full px-3 py-1.5 text-[10px] font-bold cursor-pointer rounded-[var(--radius-sm)]"
        style={{
          background: "var(--accent-green)",
          color: "#fff",
          opacity: submitting ? 0.5 : 1,
        }}
      >
        {submitting ? "Tracking…" : "Track this signal"}
      </button>
    </div>
  );
}
