"use client";

import { Badge } from "@/components/ui/Badge";
import type { Signal } from "@/lib/signals";
import { getSignalStatusLabel, getConvictionColor } from "@/lib/signals";

interface SignalCardProps {
  signal: Signal;
  onCancel?: (id: string) => void;
  compact?: boolean;
}

export function SignalCard({ signal, onCancel, compact }: SignalCardProps) {
  const isLong = signal.direction === "long";
  const isResolved = signal.status === "target_hit" || signal.status === "stopped_out";
  const isWin = signal.status === "target_hit";
  const pnl = signal.resultPnlPercent;

  const statusVariant =
    signal.status === "active"
      ? "blue"
      : signal.status === "target_hit"
      ? "green"
      : signal.status === "stopped_out"
      ? "red"
      : signal.status === "expired"
      ? "gray"
      : "gray";

  if (compact) {
    return (
      <div
        className="flex items-center gap-2 px-2.5 py-2 rounded-[var(--radius-sm)]"
        style={{
          background: "var(--glass-bg)",
          border: "1px solid var(--glass-border)",
        }}
      >
        <span
          className="text-xs font-bold"
          style={{ color: isLong ? "#10B981" : "#EF4444" }}
        >
          {isLong ? "▲" : "▼"}
        </span>
        <span className="text-xs font-mono font-bold" style={{ color: "var(--text-primary)" }}>
          {signal.assetSymbol}
        </span>
        <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
          {signal.entryPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </span>
        <Badge variant={statusVariant}>{getSignalStatusLabel(signal.status)}</Badge>
        {pnl !== null && (
          <span
            className="text-[10px] font-mono font-bold ml-auto"
            style={{ color: pnl >= 0 ? "#10B981" : "#EF4444" }}
          >
            {pnl >= 0 ? "+" : ""}
            {pnl.toFixed(2)}%
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className="p-3 rounded-[var(--radius-md)]"
      style={{
        background: "var(--glass-bg)",
        border: `1px solid ${
          isResolved
            ? isWin
              ? "rgba(16, 185, 129, 0.3)"
              : "rgba(239, 68, 68, 0.3)"
            : "var(--glass-border)"
        }`,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className="text-sm font-bold"
            style={{ color: isLong ? "#10B981" : "#EF4444" }}
          >
            {isLong ? "▲ LONG" : "▼ SHORT"}
          </span>
          <span className="text-sm font-mono font-bold" style={{ color: "var(--text-primary)" }}>
            {signal.assetSymbol}
          </span>
          <Badge variant={statusVariant}>{getSignalStatusLabel(signal.status)}</Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="text-[10px] font-mono px-1.5 py-0.5 rounded"
            style={{
              background: "var(--glass-bg)",
              color: "var(--text-muted)",
              border: "1px solid var(--glass-border)",
            }}
          >
            {signal.timeframe}
          </span>
          <span
            className="text-[10px] font-body font-bold"
            style={{ color: getConvictionColor(signal.conviction) }}
          >
            {signal.conviction.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Prices */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        <div>
          <span className="text-[10px] font-body block" style={{ color: "var(--text-tertiary)" }}>
            Entry
          </span>
          <span className="text-xs font-mono font-bold" style={{ color: "var(--text-primary)" }}>
            ${signal.entryPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </span>
        </div>
        <div>
          <span className="text-[10px] font-body block" style={{ color: "var(--accent-green)" }}>
            Target
          </span>
          <span className="text-xs font-mono font-bold" style={{ color: "var(--accent-green)" }}>
            ${signal.targetPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </span>
        </div>
        <div>
          <span className="text-[10px] font-body block" style={{ color: "var(--accent-red)" }}>
            Stop
          </span>
          <span className="text-xs font-mono font-bold" style={{ color: "var(--accent-red)" }}>
            ${signal.stopLossPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* P&L (if resolved) */}
      {pnl !== null && (
        <div
          className="py-1.5 px-2 rounded-[var(--radius-sm)] text-center mb-2"
          style={{
            background: pnl >= 0 ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
          }}
        >
          <span
            className="text-sm font-mono font-bold"
            style={{ color: pnl >= 0 ? "#10B981" : "#EF4444" }}
          >
            {pnl >= 0 ? "+" : ""}
            {pnl.toFixed(2)}%
          </span>
        </div>
      )}

      {/* Notes */}
      {signal.notes && (
        <p className="text-xs font-body mb-2" style={{ color: "var(--text-secondary)" }}>
          {signal.notes}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
          {new Date(signal.publishedAt).toLocaleDateString()}{" "}
          {new Date(signal.publishedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
        {signal.status === "active" && onCancel && (
          <button
            onClick={() => onCancel(signal.id)}
            className="text-[10px] font-body cursor-pointer"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-red)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            Cancel Signal
          </button>
        )}
      </div>
    </div>
  );
}
