"use client";

import { useSignalStore } from "@/lib/signalStore";
import { useAppStore } from "@/lib/store";
import { SignalCard } from "./SignalCard";
import { GlassButton } from "@/components/ui/GlassButton";

export function SignalsPanel() {
  const { signals, cancelSignal, setShowNewSignalForm, showNewSignalForm } =
    useSignalStore();
  const { selectedAsset } = useAppStore();

  const assetSignals = signals.filter((s) => s.assetSymbol === selectedAsset);
  const activeSignals = assetSignals.filter((s) => s.status === "active");
  const resolvedSignals = assetSignals.filter(
    (s) => s.status !== "active" && s.status !== "cancelled"
  );

  return (
    <div className="p-3 flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h3
          className="text-xs font-bold font-body uppercase tracking-wider"
          style={{ color: "var(--text-tertiary)" }}
        >
          Signals
        </h3>
        <GlassButton
          variant="primary"
          size="sm"
          onClick={() => setShowNewSignalForm(true)}
        >
          + New
        </GlassButton>
      </div>

      <div className="flex-1 overflow-auto space-y-2">
        {/* Active Signals */}
        {activeSignals.length > 0 && (
          <div>
            <span
              className="text-[10px] font-bold font-body uppercase tracking-wider block mb-1.5"
              style={{ color: "var(--accent-blue)" }}
            >
              Active ({activeSignals.length})
            </span>
            <div className="space-y-1.5">
              {activeSignals.map((signal) => (
                <SignalCard
                  key={signal.id}
                  signal={signal}
                  onCancel={cancelSignal}
                  compact
                />
              ))}
            </div>
          </div>
        )}

        {/* Resolved Signals */}
        {resolvedSignals.length > 0 && (
          <div>
            <span
              className="text-[10px] font-bold font-body uppercase tracking-wider block mb-1.5 mt-3"
              style={{ color: "var(--text-tertiary)" }}
            >
              History ({resolvedSignals.length})
            </span>
            <div className="space-y-1.5">
              {resolvedSignals.map((signal) => (
                <SignalCard key={signal.id} signal={signal} compact />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {assetSignals.length === 0 && (
          <div className="text-center py-6">
            <p
              className="text-xs font-body"
              style={{ color: "var(--text-muted)" }}
            >
              No signals for {selectedAsset} yet.
            </p>
            <p
              className="text-xs font-body mt-1"
              style={{ color: "var(--text-muted)" }}
            >
              Click &quot;+ New&quot; to publish your first signal.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
