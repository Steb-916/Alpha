"use client";

import { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { useAppStore } from "@/lib/store";
import { useSignalStore } from "@/lib/signalStore";
import { useSignalCreationStore } from "@/stores/signalCreationStore";
import { SignalCreationForm } from "@/components/signals/SignalCreationForm";
import type { Signal, SignalDirection, SignalConviction } from "@/lib/signals";

const TIMEFRAMES = ["1H", "4H", "1D", "1W"];
const CONVICTIONS: { value: SignalConviction; label: string; color: string }[] = [
  { value: "low", label: "Low", color: "var(--text-muted)" },
  { value: "medium", label: "Medium", color: "var(--accent-yellow)" },
  { value: "high", label: "High", color: "var(--accent-green)" },
];

export function NewSignalForm() {
  const useProForm = useSignalCreationStore((s) => s.useProForm);
  // Phase 4: when the analyst toggles "Pro form", swap in the new
  // multi-target/draft/template/screenshot form.
  if (useProForm) {
    return <NewSignalFormProWrapper />;
  }
  return <LegacyNewSignalForm />;
}

function NewSignalFormProWrapper() {
  const setUseProForm = useSignalCreationStore((s) => s.setUseProForm);
  return (
    <div>
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          onClick={() => setUseProForm(false)}
          className="text-[10px] font-body cursor-pointer"
          style={{ color: "var(--text-muted)" }}
        >
          ← Switch to basic form
        </button>
      </div>
      <SignalCreationForm />
    </div>
  );
}

function LegacyNewSignalForm() {
  const setUseProForm = useSignalCreationStore((s) => s.setUseProForm);
  const { selectedAsset } = useAppStore();
  const { addSignal, setShowNewSignalForm } = useSignalStore();

  const [direction, setDirection] = useState<SignalDirection>("long");
  const [entryPrice, setEntryPrice] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [stopLossPrice, setStopLossPrice] = useState("");
  const [timeframe, setTimeframe] = useState("4H");
  const [conviction, setConviction] = useState<SignalConviction>("medium");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const entry = parseFloat(entryPrice);
    const target = parseFloat(targetPrice);
    const stop = parseFloat(stopLossPrice);

    if (isNaN(entry) || isNaN(target) || isNaN(stop)) {
      setError("All prices must be valid numbers");
      return;
    }

    if (direction === "long" && target <= entry) {
      setError("Target must be above entry for long signals");
      return;
    }
    if (direction === "long" && stop >= entry) {
      setError("Stop loss must be below entry for long signals");
      return;
    }
    if (direction === "short" && target >= entry) {
      setError("Target must be below entry for short signals");
      return;
    }
    if (direction === "short" && stop <= entry) {
      setError("Stop loss must be above entry for short signals");
      return;
    }

    const signal: Signal = {
      id: `sig-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      analystId: "local-analyst",
      assetSymbol: selectedAsset,
      direction,
      entryPrice: entry,
      targetPrice: target,
      stopLossPrice: stop,
      timeframe,
      conviction,
      notes: notes || null,
      status: "active",
      publishedAt: new Date().toISOString(),
      resolvedAt: null,
      resolvedPrice: null,
      resultPnlPercent: null,
      createdAt: new Date().toISOString(),
    };

    addSignal(signal);
    setShowNewSignalForm(false);
  };

  // Calculate R:R ratio
  const entry = parseFloat(entryPrice);
  const target = parseFloat(targetPrice);
  const stop = parseFloat(stopLossPrice);
  let rrRatio = "";
  if (!isNaN(entry) && !isNaN(target) && !isNaN(stop) && stop !== entry) {
    const reward = Math.abs(target - entry);
    const risk = Math.abs(entry - stop);
    if (risk > 0) rrRatio = `${(reward / risk).toFixed(2)}R`;
  }

  const inputStyle = {
    background: "var(--glass-bg)",
    border: "1px solid var(--glass-border)",
    color: "var(--text-primary)",
  };

  return (
    <GlassCard glow="green">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold font-display" style={{ color: "var(--text-primary)" }}>
          New Signal — {selectedAsset}
        </h3>
        <button
          onClick={() => setShowNewSignalForm(false)}
          className="text-sm cursor-pointer"
          style={{ color: "var(--text-muted)" }}
        >
          ✕
        </button>
      </div>
      <div className="mb-3">
        <button
          type="button"
          onClick={() => setUseProForm(true)}
          className="text-[10px] font-body cursor-pointer"
          style={{ color: "var(--accent-green)" }}
        >
          ⚡ Switch to Pro form (multi-target, drafts, templates)
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

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Direction */}
        <div className="flex gap-2">
          {(["long", "short"] as SignalDirection[]).map((d) => (
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

        {/* Prices */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[10px] font-bold font-body mb-1 uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
              Entry
            </label>
            <input
              type="number"
              step="any"
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
              required
              className="w-full px-2.5 py-2 rounded-[var(--radius-sm)] text-xs font-mono outline-none"
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = "var(--accent-green)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--glass-border)")}
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold font-body mb-1 uppercase tracking-wider" style={{ color: "var(--accent-green)" }}>
              Target
            </label>
            <input
              type="number"
              step="any"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              required
              className="w-full px-2.5 py-2 rounded-[var(--radius-sm)] text-xs font-mono outline-none"
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = "var(--accent-green)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--glass-border)")}
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
              required
              className="w-full px-2.5 py-2 rounded-[var(--radius-sm)] text-xs font-mono outline-none"
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = "var(--accent-red)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--glass-border)")}
            />
          </div>
        </div>

        {/* R:R display */}
        {rrRatio && (
          <div className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
            Risk:Reward — <span style={{ color: "var(--accent-green)" }}>{rrRatio}</span>
          </div>
        )}

        {/* Timeframe + Conviction */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-[10px] font-bold font-body mb-1 uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
              Timeframe
            </label>
            <div className="flex gap-1">
              {TIMEFRAMES.map((tf) => (
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
              {CONVICTIONS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setConviction(c.value)}
                  className="px-2.5 py-1.5 rounded-[var(--radius-sm)] text-[10px] font-body cursor-pointer"
                  style={{
                    background: conviction === c.value ? "rgba(0, 212, 170, 0.15)" : "var(--glass-bg)",
                    color: conviction === c.value ? c.color : "var(--text-muted)",
                    border: `1px solid ${conviction === c.value ? "rgba(0, 212, 170, 0.3)" : "var(--glass-border)"}`,
                  }}
                >
                  {c.label}
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
            onFocus={(e) => (e.target.style.borderColor = "var(--accent-green)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--glass-border)")}
          />
        </div>

        <GlassButton variant="primary" size="md" className="w-full" onClick={() => {}}>
          Publish Signal
        </GlassButton>
      </form>
    </GlassCard>
  );
}
