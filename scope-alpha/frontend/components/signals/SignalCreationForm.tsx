"use client";

/**
 * Pro signal creation form.
 *
 * The new (Phase 4) form that talks to /api/signals via the API. Supports:
 *  - Multi-target signals (1..5 TPs)
 *  - Drafts (Save Draft button)
 *  - Templates (load/save via TemplateSelector)
 *  - Chart-click price setting (delegated to parent — see onActivateChartMode)
 *  - Screenshot upload (delegated through SignalScreenshotPicker)
 *
 * The legacy NewSignalForm continues to work in parallel — this form is
 * opt-in via "Switch to Pro form" link.
 */

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { useAppStore } from "@/lib/store";
import { useSignalStore } from "@/lib/signalStore";
import { useSignalCreationStore } from "@/stores/signalCreationStore";
import {
  ALLOWED_CONVICTIONS,
  ALLOWED_TIMEFRAMES,
  type Conviction,
  type Direction,
  type Timeframe,
} from "@/config/signals";
import {
  validateSignalBody,
  validateTargets,
  type SignalBodyInput,
  type SignalTargetInput,
} from "@/lib/signals/validation";
import type { AppliedTemplate } from "@/lib/signals/templates";
import { MultiTargetInput } from "./MultiTargetInput";
import { TemplateSelector } from "./TemplateSelector";
import { SignalScreenshotPicker } from "./SignalScreenshotPicker";

interface Props {
  /** Provided by the terminal page so we can ask the chart to enter signal-creation mode. */
  onActivateChartMode?: (direction: Direction) => void;
  /** Optional ref to the chart container so the screenshot picker can find the canvas. */
  chartContainerRef?: React.RefObject<HTMLDivElement>;
  /** Pre-fill values from the chart-click overlay (when called by SignalCreationOverlay). */
  prefillEntry?: number;
  prefillStop?: number;
  prefillTargets?: SignalTargetInput[];
}

const initialTargets = (): SignalTargetInput[] => [
  { label: "TP1", price: 0, closePercent: 100 },
];

const inputStyle: React.CSSProperties = {
  background: "var(--glass-bg)",
  border: "1px solid var(--glass-border)",
  color: "var(--text-primary)",
};

export function SignalCreationForm({
  onActivateChartMode,
  chartContainerRef,
  prefillEntry,
  prefillStop,
  prefillTargets,
}: Props) {
  const { selectedAsset } = useAppStore();
  const { setShowNewSignalForm } = useSignalStore();
  const pending = useSignalCreationStore((s) => s.pending);
  const clearPending = useSignalCreationStore((s) => s.clearPending);
  const enterChartMode = useSignalCreationStore((s) => s.enterChartMode);

  const [direction, setDirection] = useState<Direction>("long");
  const [entryPrice, setEntryPrice] = useState<string>(
    prefillEntry ? String(prefillEntry) : "",
  );
  const [stopLossPrice, setStopLossPrice] = useState<string>(
    prefillStop ? String(prefillStop) : "",
  );
  const [targets, setTargets] = useState<SignalTargetInput[]>(
    prefillTargets && prefillTargets.length > 0 ? prefillTargets : initialTargets(),
  );
  const [timeframe, setTimeframe] = useState<Timeframe>("4H");
  const [conviction, setConviction] = useState<Conviction>("medium");
  const [notes, setNotes] = useState("");
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Phase 4: when the chart-overlay completes, the store carries the
  // captured prices. Pull them in once and clear so subsequent edits stick.
  useEffect(() => {
    if (!pending) return;
    setDirection(pending.direction);
    setEntryPrice(String(pending.entry));
    setStopLossPrice(String(pending.stop));
    if (pending.targets.length > 0) setTargets(pending.targets);
    clearPending();
  }, [pending, clearPending]);

  const entryNum = parseFloat(entryPrice);
  const stopNum = parseFloat(stopLossPrice);

  const buildBody = (status: "draft" | "active"): SignalBodyInput | null => {
    if (!Number.isFinite(entryNum) || !Number.isFinite(stopNum)) {
      setError("Entry and stop prices must be valid numbers");
      return null;
    }
    return {
      assetSymbol: selectedAsset,
      direction,
      entryPrice: entryNum,
      stopLossPrice: stopNum,
      timeframe,
      conviction,
      notes: notes || null,
      status,
      targets: targets.map((t) => ({
        label: t.label,
        price: Number(t.price),
        closePercent: Number(t.closePercent),
      })),
    };
  };

  const submit = async (status: "draft" | "active") => {
    setError(null);
    const body = buildBody(status);
    if (!body) return;

    // Client-side validation using the same module the server uses.
    const bodyResult = validateSignalBody(body);
    if (!bodyResult.ok) {
      setError(bodyResult.errors[0].message);
      return;
    }
    if (body.targets) {
      const tr = validateTargets(body.targets, body.direction, body.entryPrice);
      if (!tr.ok) {
        setError(tr.errors[0].message);
        return;
      }
    }

    setSubmitting(true);
    try {
      // 1) Create the signal (as draft if status='draft', else active).
      const res = await fetch("/api/signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `HTTP ${res.status}`);
        setSubmitting(false);
        return;
      }
      const created = await res.json();

      // 2) Upload screenshot if one was staged.
      if (screenshotFile) {
        const fd = new FormData();
        fd.append("file", screenshotFile);
        const upRes = await fetch(`/api/signals/${created.id}/screenshot`, {
          method: "POST",
          body: fd,
        });
        if (!upRes.ok) {
          // Non-fatal: signal already exists. Surface the error and let the
          // analyst try again from the drafts panel.
          const upData = await upRes.json().catch(() => ({}));
          setError(`Signal saved, but screenshot upload failed: ${upData.error || upRes.status}`);
          setSubmitting(false);
          return;
        }
      }

      // Done. Close the form.
      setShowNewSignalForm(false);
      setSubmitting(false);
    } catch (err) {
      setError((err as Error).message || "Failed to create signal");
      setSubmitting(false);
    }
  };

  const handleApplyTemplate = (applied: AppliedTemplate) => {
    if (applied.direction) setDirection(applied.direction);
    if (applied.timeframe && (ALLOWED_TIMEFRAMES as readonly string[]).includes(applied.timeframe)) {
      setTimeframe(applied.timeframe as Timeframe);
    }
    if (applied.conviction && (ALLOWED_CONVICTIONS as readonly string[]).includes(applied.conviction)) {
      setConviction(applied.conviction as Conviction);
    }
    if (applied.stopLossPrice != null) setStopLossPrice(String(applied.stopLossPrice));
    if (applied.targets.length > 0) setTargets(applied.targets);
    if (applied.notes) setNotes(applied.notes);
  };

  return (
    <GlassCard glow="green">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold font-display" style={{ color: "var(--text-primary)" }}>
          Pro Signal — {selectedAsset}
        </h3>
        <button
          onClick={() => setShowNewSignalForm(false)}
          className="text-sm cursor-pointer"
          style={{ color: "var(--text-muted)" }}
        >
          ✕
        </button>
      </div>

      {error && (
        <div
          className="mb-3 p-2 rounded-[var(--radius-sm)] text-xs"
          style={{
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "var(--accent-red)",
          }}
        >
          {error}
        </div>
      )}

      <div className="space-y-3">
        {/* Templates */}
        <TemplateSelector
          entryPrice={entryNum || 0}
          direction={direction}
          stopLossPrice={stopNum || 0}
          targets={targets}
          onApply={handleApplyTemplate}
        />

        {/* Direction */}
        <div className="flex gap-2">
          {(["long", "short"] as Direction[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDirection(d)}
              className="flex-1 py-2 rounded-[var(--radius-sm)] text-xs font-bold uppercase cursor-pointer transition-all"
              style={{
                background:
                  direction === d
                    ? d === "long"
                      ? "rgba(16, 185, 129, 0.2)"
                      : "rgba(239, 68, 68, 0.2)"
                    : "var(--glass-bg)",
                color:
                  direction === d
                    ? d === "long"
                      ? "#10B981"
                      : "#EF4444"
                    : "var(--text-muted)",
                border: `1px solid ${
                  direction === d
                    ? d === "long"
                      ? "rgba(16, 185, 129, 0.4)"
                      : "rgba(239, 68, 68, 0.4)"
                    : "var(--glass-border)"
                }`,
              }}
            >
              {d === "long" ? "▲ Long" : "▼ Short"}
            </button>
          ))}
        </div>

        {/* Entry + Stop */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-bold font-body mb-1 uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
              Entry
            </label>
            <input
              type="number"
              step="any"
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
              className="w-full px-2.5 py-2 rounded-[var(--radius-sm)] text-xs font-mono outline-none"
              style={inputStyle}
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold font-body mb-1 uppercase tracking-wider" style={{ color: "var(--accent-red)" }}>
              Stop Loss
            </label>
            <input
              type="number"
              step="any"
              value={stopLossPrice}
              onChange={(e) => setStopLossPrice(e.target.value)}
              className="w-full px-2.5 py-2 rounded-[var(--radius-sm)] text-xs font-mono outline-none"
              style={inputStyle}
            />
          </div>
        </div>

        {/* Multi-target */}
        <MultiTargetInput targets={targets} onChange={setTargets} />

        {/* Timeframe + Conviction */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-[10px] font-bold font-body mb-1 uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
              Timeframe
            </label>
            <div className="flex gap-1 flex-wrap">
              {ALLOWED_TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => setTimeframe(tf)}
                  className="px-2.5 py-1.5 rounded-[var(--radius-sm)] text-[10px] font-mono cursor-pointer"
                  style={{
                    background: timeframe === tf ? "rgba(0, 212, 170, 0.15)" : "var(--glass-bg)",
                    color: timeframe === tf ? "var(--accent-green)" : "var(--text-muted)",
                    border: `1px solid ${timeframe === tf ? "rgba(0, 212, 170, 0.3)" : "var(--glass-border)"}`,
                  }}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-[10px] font-bold font-body mb-1 uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
              Conviction
            </label>
            <div className="flex gap-1">
              {ALLOWED_CONVICTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setConviction(c)}
                  className="px-2.5 py-1.5 rounded-[var(--radius-sm)] text-[10px] font-body cursor-pointer"
                  style={{
                    background: conviction === c ? "rgba(0, 212, 170, 0.15)" : "var(--glass-bg)",
                    color: conviction === c ? "var(--accent-green)" : "var(--text-muted)",
                    border: `1px solid ${conviction === c ? "rgba(0, 212, 170, 0.3)" : "var(--glass-border)"}`,
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-[10px] font-bold font-body mb-1 uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full px-2.5 py-2 rounded-[var(--radius-sm)] text-xs font-body outline-none resize-none"
            style={inputStyle}
            placeholder="Your thesis..."
          />
        </div>

        {/* Screenshot */}
        <SignalScreenshotPicker
          onSelected={(file) => setScreenshotFile(file)}
          chartContainerRef={chartContainerRef}
        />

        {/* Actions */}
        <div className="flex gap-2">
          <GlassButton
            variant="default"
            size="md"
            className="flex-1"
            onClick={() => submit("draft")}
            disabled={submitting}
          >
            {submitting ? "Saving..." : "Save Draft"}
          </GlassButton>
          <GlassButton
            variant="primary"
            size="md"
            className="flex-1"
            onClick={() => submit("active")}
            disabled={submitting}
          >
            {submitting ? "Publishing..." : "Publish Now"}
          </GlassButton>
        </div>

        <button
          type="button"
          onClick={() => {
            enterChartMode(direction);
            onActivateChartMode?.(direction);
          }}
          className="w-full text-[10px] font-body cursor-pointer py-1"
          style={{ color: "var(--accent-green)" }}
        >
          ✎ Use chart to set prices
        </button>
      </div>
    </GlassCard>
  );
}
