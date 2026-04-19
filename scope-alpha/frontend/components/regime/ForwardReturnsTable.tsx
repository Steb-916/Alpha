"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { useForwardReturns } from "@/hooks/useForwardReturns";
import type { OnChainAsset } from "@/types/onchain";
import type {
  ForwardReturnDistribution,
  RegimeLabel,
} from "@/types/regime";

interface Props {
  asset: OnChainAsset;
  regime: RegimeLabel;
}

function sourceDisclosure(dist: ForwardReturnDistribution): string {
  const n = dist.total_observations;
  const since = dist.observation_window_start
    ? new Date(dist.observation_window_start).toISOString().slice(0, 10)
    : null;
  if (dist.source === "backfill") {
    return `Based on ${n} observations — backfill-derived${
      since ? ` from ${since} onward` : ""
    }. Live accumulation begins at classifier launch.`;
  }
  if (dist.source === "live") {
    return `Based on ${n} observations — live since ${since ?? "classifier launch"}.`;
  }
  return `Based on ${n} observations — mixed backfill + live since ${since ?? "unknown"}.`;
}

function pct(v: number): string {
  return `${v >= 0 ? "+" : ""}${(v * 100).toFixed(2)}%`;
}

export function ForwardReturnsTable({ asset, regime }: Props) {
  const { data, isLoading, unavailable } = useForwardReturns(asset, regime);

  if (isLoading) {
    return (
      <GlassCard>
        <div className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
          Computing historical forward returns…
        </div>
      </GlassCard>
    );
  }

  if (unavailable || !data?.distribution) {
    return (
      <GlassCard>
        <div className="text-xs font-mono mb-1" style={{ color: "var(--text-primary)" }}>
          Historical forward returns
        </div>
        <p className="text-xs font-body" style={{ color: "var(--text-secondary)" }}>
          {data?.quant_engine_configured === false
            ? "Quant Engine not configured — forward returns unavailable."
            : "No observations of this regime in the persisted history yet. Distribution populates as RegimeSnapshot rows accumulate."}
        </p>
      </GlassCard>
    );
  }

  const dist = data.distribution;
  const hasSamples = dist.total_observations > 0;

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-2">
        <div
          className="text-xs font-mono uppercase tracking-wider"
          style={{ color: "var(--text-primary)" }}
        >
          Historical forward returns in <em>{regime.replace(/_/g, " ")}</em>
        </div>
        <div
          className="text-[10px] font-mono uppercase tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          source: {dist.source}
        </div>
      </div>
      {hasSamples ? (
        <table className="w-full text-xs font-mono">
          <thead>
            <tr
              style={{
                color: "var(--text-muted)",
                borderBottom: "1px solid var(--glass-border)",
              }}
            >
              <th className="text-left py-1 pr-3">Horizon</th>
              <th className="text-right pr-3">Median</th>
              <th className="text-right pr-3">P25</th>
              <th className="text-right pr-3">P75</th>
              <th className="text-right">N</th>
            </tr>
          </thead>
          <tbody>
            {dist.horizons.map((h) => (
              <tr
                key={h.horizon}
                style={{ borderBottom: "1px solid rgba(148,163,184,0.07)" }}
              >
                <td className="py-1 pr-3" style={{ color: "var(--text-secondary)" }}>
                  {h.horizon}
                </td>
                <td
                  className="text-right pr-3"
                  style={{
                    color:
                      h.sample_count === 0
                        ? "var(--text-muted)"
                        : h.median_return >= 0
                          ? "var(--data-green)"
                          : "var(--data-red)",
                  }}
                >
                  {h.sample_count > 0 ? pct(h.median_return) : "—"}
                </td>
                <td
                  className="text-right pr-3"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {h.sample_count > 0 ? pct(h.p25_return) : "—"}
                </td>
                <td
                  className="text-right pr-3"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {h.sample_count > 0 ? pct(h.p75_return) : "—"}
                </td>
                <td className="text-right" style={{ color: "var(--text-muted)" }}>
                  {h.sample_count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-xs font-body" style={{ color: "var(--text-secondary)" }}>
          No qualifying observations for this regime yet. Distribution
          populates as the classifier runs.
        </p>
      )}
      <div
        className="mt-2 text-[10px] font-mono leading-relaxed"
        style={{ color: "var(--text-muted)" }}
      >
        {sourceDisclosure(dist)}
        <br />
        Past performance does not predict future outcomes.
      </div>
    </GlassCard>
  );
}
