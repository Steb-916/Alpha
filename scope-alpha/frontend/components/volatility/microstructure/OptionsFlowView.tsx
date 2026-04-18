"use client";

import { useState, useMemo } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { useOptionsFlow } from "@/hooks/useOptionsFlow";
import { UnavailableBanner } from "../UnavailableBanner";

const DISCLAIMER =
  "This information is for educational and analytical purposes only. It is not financial advice, investment advice, or a recommendation to buy or sell any asset.";

function fmtPremium(v: number): string {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function unusualBadge(score: number) {
  if (score >= 70) return { label: "High", color: "var(--data-red)" };
  if (score >= 40) return { label: "Med", color: "var(--data-yellow)" };
  return { label: "Low", color: "var(--text-muted)" };
}

interface Props { asset: string }

export function OptionsFlowView({ asset }: Props) {
  const [minPremium, setMinPremium] = useState(0);
  const { data, isLoading, unavailable, quantEngineConfigured } = useOptionsFlow(asset, minPremium);

  const flow = useMemo(() => {
    if (!data) return null;
    const callPct = data.netCallPremium + data.netPutPremium > 0
      ? data.netCallPremium / (data.netCallPremium + data.netPutPremium)
      : 0.5;
    return { callPct };
  }, [data]);

  if (isLoading) {
    return (
      <GlassCard>
        <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>Loading…</p>
      </GlassCard>
    );
  }
  if (unavailable || !data) {
    return <UnavailableBanner quantEngineConfigured={quantEngineConfigured} tool="Options Flow" />;
  }

  return (
    <div className="h-full flex flex-col gap-3 overflow-auto">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold font-display" style={{ color: "var(--text-primary)" }}>
          Options Flow Scanner — {asset}
        </h2>
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
            Min Premium
          </label>
          <select
            value={minPremium}
            onChange={(e) => setMinPremium(Number(e.target.value))}
            className="text-xs font-mono px-2 py-1 rounded"
            style={{
              background: "var(--glass-bg)",
              border: "1px solid var(--glass-border)",
              color: "var(--text-secondary)",
            }}
          >
            <option value={0}>All</option>
            <option value={10000}>$10K+</option>
            <option value={50000}>$50K+</option>
            <option value={100000}>$100K+</option>
            <option value={500000}>$500K+</option>
          </select>
        </div>
      </div>

      {/* Net premium flow bar */}
      {flow && (
        <GlassCard>
          <div className="text-[10px] font-mono uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
            Net Premium Flow — Calls vs Puts
          </div>
          <div className="flex gap-3 items-center">
            <div className="flex-1 rounded-full overflow-hidden" style={{ height: 8, background: "var(--glass-border)" }}>
              <div style={{
                width: `${flow.callPct * 100}%`,
                height: "100%",
                background: "var(--accent-green)",
                transition: "width 0.3s ease",
              }} />
            </div>
            <div className="flex gap-3 text-xs font-mono shrink-0">
              <span style={{ color: "var(--accent-green)" }}>Calls {fmtPremium(data.netCallPremium)}</span>
              <span style={{ color: "var(--data-red)" }}>Puts {fmtPremium(data.netPutPremium)}</span>
            </div>
          </div>
          <div className="text-[10px] font-mono mt-1" style={{ color: "var(--text-muted)" }}>
            Net flow: {data.netPremiumFlow >= 0 ? "+" : ""}{fmtPremium(data.netPremiumFlow)} ({data.netPremiumFlow >= 0 ? "call-biased" : "put-biased"})
          </div>
        </GlassCard>
      )}

      <GlassCard>
        <div className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
          Flow Events ({data.events.length}) — based on hourly volume deltas
        </div>
        {data.events.length === 0 ? (
          <p className="text-xs font-mono text-center py-6" style={{ color: "var(--text-muted)" }}>
            No unusual flow detected in this window. Check back after the next refresh cycle.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--glass-border)" }}>
                  <th className="text-left py-1 pr-3">Instrument</th>
                  <th className="text-right pr-3">Type</th>
                  <th className="text-right pr-3">Strike</th>
                  <th className="text-right pr-3">Expiry</th>
                  <th className="text-right pr-3">Size</th>
                  <th className="text-right pr-3">Premium</th>
                  <th className="text-right">Unusual</th>
                </tr>
              </thead>
              <tbody>
                {data.events.slice(0, 50).map((e) => {
                  const badge = unusualBadge(e.unusualScore);
                  return (
                    <tr key={e.id} style={{ borderBottom: "1px solid rgba(148,163,184,0.07)" }}>
                      <td className="py-1 pr-3" style={{ color: "var(--text-secondary)", maxWidth: 140 }}>
                        <span className="truncate block" title={e.instrumentName}>{e.instrumentName}</span>
                      </td>
                      <td className="text-right pr-3" style={{
                        color: e.optionType === "call" ? "var(--accent-green)" : "var(--data-red)",
                      }}>
                        {e.optionType.toUpperCase()}
                      </td>
                      <td className="text-right pr-3" style={{ color: "var(--text-primary)" }}>
                        ${e.strike.toLocaleString()}
                      </td>
                      <td className="text-right pr-3" style={{ color: "var(--text-muted)" }}>{e.expiration}</td>
                      <td className="text-right pr-3" style={{ color: "var(--text-secondary)" }}>
                        {e.size.toFixed(1)}
                      </td>
                      <td className="text-right pr-3" style={{ color: "var(--data-yellow)" }}>
                        {fmtPremium(e.premiumUsd)}
                      </td>
                      <td className="text-right">
                        <span className="px-1.5 py-0.5 rounded text-[9px]"
                          style={{ color: badge.color, border: `1px solid ${badge.color}` }}>
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      <GlassCard>
        <p className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
          Flow events are derived from hourly volume deltas between consecutive chain snapshots. Trade direction (buy/sell) is not available from market summary data.
          {" "}{DISCLAIMER}
        </p>
      </GlassCard>
    </div>
  );
}
