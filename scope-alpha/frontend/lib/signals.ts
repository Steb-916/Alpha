// Signal type definitions

export type SignalDirection = "long" | "short";
export type SignalConviction = "low" | "medium" | "high";
export type SignalStatus = "active" | "target_hit" | "stopped_out" | "expired" | "cancelled";

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
