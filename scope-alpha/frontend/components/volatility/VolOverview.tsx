"use client";

import { useMemo } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { DataCell } from "@/components/ui/DataCell";
import { useOptionsChain } from "@/hooks/useOptionsChain";
import { useSkew } from "@/hooks/useSkew";
import { useVRP } from "@/hooks/useVRP";
import { useVolCone } from "@/hooks/useVolCone";
import { formatPercent, formatLargeNumber } from "@/lib/utils";
import { PinRiskCard } from "./PinRiskCard";

interface VolOverviewProps {
  asset: string;
}

export function VolOverview({ asset }: VolOverviewProps) {
  const { data: chain, unavailable: chainUnavailable } =
    useOptionsChain(asset);
  const { data: skew, quantEngineConfigured: skewConfigured } = useSkew(asset);
  const { data: vrp } = useVRP(asset);
  const { data: cone } = useVolCone(asset);

  const headline = useMemo(() => {
    const atm30 = skew?.term_structure.find(
      (t) => Math.abs(t.expiry_days - 30) <= 7,
    )?.atm_iv;
    const skew30 = skew?.by_expiry.find(
      (b) => Math.abs(b.expiry_days - 30) <= 7,
    )?.skew_25d;
    const termShape = skew?.term_structure_shape ?? null;
    const totalOI = chain?.expirations.reduce((s, e) => s + e.totalOI, 0) ?? 0;
    const totalVolume =
      chain?.expirations.reduce((s, e) => s + e.totalVolume24h, 0) ?? 0;

    const nearest = chain?.expirations[0];

    return { atm30, skew30, termShape, totalOI, totalVolume, nearest };
  }, [chain, skew]);

  if (chainUnavailable) {
    return (
      <div className="h-full flex items-center justify-center">
        <GlassCard className="max-w-lg text-center">
          <div
            className="text-sm font-bold font-display mb-2"
            style={{ color: "var(--text-primary)" }}
          >
            No options chain data yet
          </div>
          <p
            className="text-xs font-body"
            style={{ color: "var(--text-secondary)" }}
          >
            Trigger{" "}
            <code
              className="px-1 rounded"
              style={{ background: "var(--glass-bg)", color: "var(--accent-green)" }}
            >
              /api/cron/refresh-options
            </code>{" "}
            or wait for the hourly cron. Options data is available for BTC
            and ETH only.
          </p>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-3 overflow-auto">
      <div className="grid grid-cols-4 gap-2">
        <GlassCard noPadding glow="green">
          <DataCell
            label="ATM IV 30d"
            value={
              headline.atm30 != null
                ? `${headline.atm30.toFixed(1)}%`
                : "—"
            }
            subtitle={skewConfigured ? "Fitted" : "Quant engine pending"}
            color="var(--accent-green)"
          />
        </GlassCard>
        <GlassCard noPadding glow="purple">
          <DataCell
            label="25d Skew 30d"
            value={
              headline.skew30 != null
                ? headline.skew30.toFixed(2)
                : "—"
            }
            subtitle={
              headline.skew30 != null
                ? headline.skew30 < 0
                  ? "Puts bid"
                  : "Calls bid"
                : "—"
            }
            color="var(--data-purple)"
          />
        </GlassCard>
        <GlassCard noPadding glow="blue">
          <DataCell
            label="Term Structure"
            value={headline.termShape ?? "—"}
            subtitle="Shape"
            color="var(--data-blue)"
          />
        </GlassCard>
        <GlassCard noPadding>
          <DataCell
            label="VRP"
            value={
              vrp?.current_vrp != null
                ? formatPercent(vrp.current_vrp, true)
                : "—"
            }
            subtitle={
              vrp?.current_vrp_percentile != null
                ? `${vrp.current_vrp_percentile.toFixed(0)}th pct`
                : "—"
            }
            color="var(--data-yellow)"
          />
        </GlassCard>
      </div>

      {/* Chain metrics — always available once chain data is cached */}
      <GlassCard>
        <div
          className="text-xs font-mono uppercase tracking-wider mb-3"
          style={{ color: "var(--text-muted)" }}
        >
          Chain snapshot
        </div>
        <div className="grid grid-cols-4 gap-4 text-sm font-mono">
          <div>
            <div
              className="text-[10px] uppercase tracking-wider"
              style={{ color: "var(--text-muted)" }}
            >
              Total Instruments
            </div>
            <div style={{ color: "var(--text-primary)" }}>
              {chain?.totalInstruments ?? "—"}
            </div>
          </div>
          <div>
            <div
              className="text-[10px] uppercase tracking-wider"
              style={{ color: "var(--text-muted)" }}
            >
              Expirations
            </div>
            <div style={{ color: "var(--text-primary)" }}>
              {chain?.expirations.length ?? 0}
            </div>
          </div>
          <div>
            <div
              className="text-[10px] uppercase tracking-wider"
              style={{ color: "var(--text-muted)" }}
            >
              Aggregate OI
            </div>
            <div style={{ color: "var(--data-blue)" }}>
              {formatLargeNumber(headline.totalOI)}
            </div>
          </div>
          <div>
            <div
              className="text-[10px] uppercase tracking-wider"
              style={{ color: "var(--text-muted)" }}
            >
              24h Volume
            </div>
            <div style={{ color: "var(--accent-green)" }}>
              {formatLargeNumber(headline.totalVolume)}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Per-expiry snapshot table */}
      <GlassCard noPadding>
        <div
          className="px-4 py-3"
          style={{ borderBottom: "1px solid var(--glass-border)" }}
        >
          <span
            className="text-xs font-mono uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            Per-Expiration Summary
          </span>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr
                style={{
                  background: "var(--glass-bg-hover)",
                  borderBottom: "1px solid var(--glass-border)",
                }}
              >
                <th
                  className="text-left py-2 px-3 text-[10px] uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  Expiry
                </th>
                <th
                  className="text-right py-2 px-3 text-[10px] uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  Days
                </th>
                <th
                  className="text-right py-2 px-3 text-[10px] uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  ATM IV
                </th>
                <th
                  className="text-right py-2 px-3 text-[10px] uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  OI
                </th>
                <th
                  className="text-right py-2 px-3 text-[10px] uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  P/C
                </th>
                <th
                  className="text-right py-2 px-3 text-[10px] uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  Max Pain
                </th>
              </tr>
            </thead>
            <tbody>
              {(chain?.expirations ?? []).map((e) => (
                <tr
                  key={e.expiration}
                  style={{ borderBottom: "1px solid var(--glass-border)" }}
                >
                  <td
                    className="py-1.5 px-3"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {e.expiration.slice(0, 10)}
                  </td>
                  <td
                    className="py-1.5 px-3 text-right"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {Math.round(e.daysToExpiry)}
                  </td>
                  <td
                    className="py-1.5 px-3 text-right"
                    style={{ color: "var(--accent-green)" }}
                  >
                    {e.atmIV != null ? `${e.atmIV.toFixed(1)}%` : "—"}
                  </td>
                  <td
                    className="py-1.5 px-3 text-right"
                    style={{ color: "var(--data-blue)" }}
                  >
                    {formatLargeNumber(e.totalOI)}
                  </td>
                  <td className="py-1.5 px-3 text-right">
                    {e.putCallRatio.toFixed(2)}
                  </td>
                  <td
                    className="py-1.5 px-3 text-right"
                    style={{ color: "var(--data-yellow)" }}
                  >
                    {e.maxPainStrike != null
                      ? `$${e.maxPainStrike.toLocaleString()}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {cone?.assessment && (
        <GlassCard>
          <div
            className="text-xs font-mono uppercase tracking-wider mb-1"
            style={{ color: "var(--text-muted)" }}
          >
            Vol Cone Assessment
          </div>
          <p
            className="text-sm font-body"
            style={{ color: "var(--text-primary)" }}
          >
            {cone.assessment}
          </p>
        </GlassCard>
      )}

      <PinRiskCard asset={asset} />
    </div>
  );
}
