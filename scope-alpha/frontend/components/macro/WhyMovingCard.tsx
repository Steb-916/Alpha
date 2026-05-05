"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { useWhyMoving } from "@/hooks/useMacro";

const SEVERITY_COLORS = {
  high:   "var(--data-red)",
  medium: "var(--data-yellow)",
  low:    "var(--text-muted)",
};

const SEVERITY_BG = {
  high:   "rgba(239,68,68,0.08)",
  medium: "rgba(234,179,8,0.08)",
  low:    "rgba(255,255,255,0.03)",
};

function PriceChangeBadge({ pct }: { pct: number }) {
  const isPos = pct >= 0;
  const color = isPos ? "var(--accent-green)" : "var(--data-red)";
  return (
    <span
      className="text-xs font-mono font-semibold px-2 py-0.5 rounded"
      style={{ background: `${color}14`, color, border: `1px solid ${color}30` }}
    >
      {isPos ? "+" : ""}{pct.toFixed(2)}%
    </span>
  );
}

export function WhyMovingCard({ asset = "BTC" }: { asset?: string }) {
  const { data, isLoading, error } = useWhyMoving(asset);

  if (isLoading) {
    return (
      <GlassCard>
        <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
          Analyzing price drivers…
        </p>
      </GlassCard>
    );
  }

  if (error || !data) return null;

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3
            className="text-sm font-mono font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            Why Is {asset} Moving?
          </h3>
          <PriceChangeBadge pct={data.priceChange24h} />
          {data._stale && (
            <span
              className="text-[10px] font-mono px-1.5 py-0.5 rounded"
              style={{ background: "rgba(255,200,0,0.1)", color: "var(--data-yellow)" }}
            >
              STALE
            </span>
          )}
        </div>
        <span
          className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded"
          style={{
            background: data.isMoving ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.04)",
            color: data.isMoving ? "var(--data-red)" : "var(--text-muted)",
            border: `1px solid ${data.isMoving ? "rgba(239,68,68,0.3)" : "var(--glass-border)"}`,
          }}
        >
          {data.isMoving ? "⚡ Active Move" : "Normal Range"}
        </span>
      </div>

      {/* Narrative */}
      <p
        className="text-sm font-body leading-relaxed mb-4"
        style={{ color: "var(--text-secondary)" }}
      >
        {data.narrative}
      </p>

      {/* Signals */}
      {(data.primaryDriver || data.secondaryDrivers.length > 0) && (
        <div className="flex flex-col gap-2">
          {data.primaryDriver && (
            <div
              className="rounded-[var(--radius-sm)] px-3 py-2"
              style={{
                background: SEVERITY_BG[data.primaryDriver.severity],
                border: `1px solid ${SEVERITY_COLORS[data.primaryDriver.severity]}30`,
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-[10px] font-mono uppercase tracking-widest"
                  style={{ color: SEVERITY_COLORS[data.primaryDriver.severity] }}
                >
                  Primary · {data.primaryDriver.domain}
                </span>
              </div>
              <p className="text-xs font-body" style={{ color: "var(--text-secondary)" }}>
                {data.primaryDriver.observation}
              </p>
            </div>
          )}
          {data.secondaryDrivers.map((sig, i) => (
            <div
              key={i}
              className="rounded-[var(--radius-sm)] px-3 py-2"
              style={{
                background: SEVERITY_BG[sig.severity],
                border: `1px solid ${SEVERITY_COLORS[sig.severity]}20`,
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-[10px] font-mono uppercase tracking-widest"
                  style={{ color: SEVERITY_COLORS[sig.severity] }}
                >
                  Secondary · {sig.domain}
                </span>
              </div>
              <p className="text-xs font-body" style={{ color: "var(--text-muted)" }}>
                {sig.observation}
              </p>
            </div>
          ))}
        </div>
      )}

      <p className="text-[9px] font-mono mt-3" style={{ color: "var(--text-muted)" }}>
        Updated {new Date(data.computedAt).toLocaleTimeString()} · 24h window · 3% threshold
      </p>
    </GlassCard>
  );
}
