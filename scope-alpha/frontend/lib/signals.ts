// Signal type definitions

export type SignalDirection = "long" | "short";
export type SignalConviction = "low" | "medium" | "high";
// Phase 4: 'draft' and 'resolved' added to support the new DB-backed flow.
// Legacy 'target_hit' / 'stopped_out' / 'expired' are kept for the existing
// in-memory signalStore so the demo flow continues to work unchanged.
export type SignalStatus =
  | "active"
  | "target_hit"
  | "stopped_out"
  | "expired"
  | "cancelled"
  | "draft"
  | "resolved";

// Phase 4: optional multi-target array. The new DB-backed serializer always
// populates this (synthesizing a single TP1 from targetPrice for legacy
// single-target signals); the legacy in-memory signalStore omits it.
export interface SignalTarget {
  id: string;
  label: string;
  price: number;
  closePercent: number;
  hitAt: string | null;
  hitPrice: number | null;
  order: number;
}

export interface Signal {
  id: string;
  analystId: string;
  assetSymbol: string;
  direction: SignalDirection;
  entryPrice: number;
  targetPrice: number;
  stopLossPrice: number;
  timeframe: string;
  conviction: SignalConviction;
  notes: string | null;
  status: SignalStatus;
  publishedAt: string;
  resolvedAt: string | null;
  resolvedPrice: number | null;
  resultPnlPercent: number | null;
  createdAt: string;
  // Phase 4 additions (optional for backwards compat)
  targets?: SignalTarget[];
  templateId?: string | null;
  screenshotUrl?: string | null;
}

export interface CreateSignalInput {
  assetSymbol: string;
  direction: SignalDirection;
  entryPrice: number;
  targetPrice: number;
  stopLossPrice: number;
  timeframe: string;
  conviction: SignalConviction;
  notes?: string;
}

export function calculatePnl(
  direction: SignalDirection,
  entryPrice: number,
  exitPrice: number
): number {
  if (direction === "long") {
    return ((exitPrice - entryPrice) / entryPrice) * 100;
  }
  return ((entryPrice - exitPrice) / entryPrice) * 100;
}

export function getSignalStatusColor(status: SignalStatus): string {
  switch (status) {
    case "active":
      return "var(--accent-blue)";
    case "target_hit":
      return "var(--accent-green)";
    case "stopped_out":
      return "var(--accent-red)";
    case "expired":
      return "var(--text-muted)";
    case "cancelled":
      return "var(--text-tertiary)";
    case "draft":
      return "var(--text-muted)";
    case "resolved":
      return "var(--accent-green)";
  }
}

export function getSignalStatusLabel(status: SignalStatus): string {
  switch (status) {
    case "active":
      return "Active";
    case "target_hit":
      return "Target Hit";
    case "stopped_out":
      return "Stopped Out";
    case "expired":
      return "Expired";
    case "cancelled":
      return "Cancelled";
    case "draft":
      return "Draft";
    case "resolved":
      return "Resolved";
  }
}

export function getConvictionColor(conviction: SignalConviction): string {
  switch (conviction) {
    case "high":
      return "var(--accent-green)";
    case "medium":
      return "var(--accent-yellow)";
    case "low":
      return "var(--text-muted)";
  }
}
