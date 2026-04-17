"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { usePinRisk } from "@/hooks/usePinRisk";

interface PinRiskCardProps {
  asset: string;
  expiry?: string;
}

export function PinRiskCard({ asset, expiry }: PinRiskCardProps) {
  const { data, isLoading } = usePinRisk(asset, expiry ?? null);

  if (isLoading) {
    return (
      <GlassCard>
        <div
          className="text-xs font-mono"
          style={{ color: "var(--text-muted)" }}
        >
          Computing pin risk…
        </div>
      </GlassCard>
    );
  }
  if (!data) return null;

  const badge =
    data.risk_level === "high"
      ? { label: "HIGH", color: "var(--data-red)" }
      : data.risk_level === "moderate"
        ? { label: "MODERATE", color: "var(--data-yellow)" }
        : { label: "LOW", color: "var(--data-green)" };

  const daysLabel =
    data.days_to_expiry < 1
      ? `${Math.max(0, Math.round(data.days_to_expiry * 24))}h`
      : `${Math.round(data.days_to_expiry)}d`;

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-2">
        <div
          className="text-xs font-mono uppercase tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          Max pain &amp; pin risk — nearest expiry
        </div>
        <span
          className="px-2 py-0.5 rounded-[var(--radius-pill)] text-[10px] font-mono uppercase tracking-wider"
          style={{
            background: "var(--glass-bg)",
            color: badge.color,
            border: `1px solid ${badge.color}`,
          }}
        >
          {badge.label}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-2">
        <div>
          <div
            className="text-[10px] font-mono uppercase tracking-wider mb-0.5"
            style={{ color: "var(--text-muted)" }}
          >
            Max pain
          </div>
          <div
            className="text-sm font-bold font-mono"
            style={{ color: "var(--text-primary)" }}
          >
            ${data.max_pain_strike.toLocaleString()}
          </div>
        </div>
        <div>
          <div
            className="text-[10px] font-mono uppercase tracking-wider mb-0.5"
            style={{ color: "var(--text-muted)" }}
          >
            Distance
          </div>
          <div
            className="text-sm font-bold font-mono"
            style={{ color: "var(--text-primary)" }}
          >
            {data.current_distance_pct.toFixed(2)}%
          </div>
        </div>
        <div>
          <div
            className="text-[10px] font-mono uppercase tracking-wider mb-0.5"
            style={{ color: "var(--text-muted)" }}
          >
            To expiry
          </div>
          <div
            className="text-sm font-bold font-mono"
            style={{ color: "var(--text-primary)" }}
          >
            {daysLabel}
          </div>
        </div>
      </div>

      <p
        className="text-xs font-body"
        style={{ color: "var(--text-secondary)" }}
      >
        {data.assessment}
      </p>
    </GlassCard>
  );
}
