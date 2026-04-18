"use client";

import { useMemo } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { useMaxPainPinRisk } from "@/hooks/useMaxPainPinRisk";
import { UnavailableBanner } from "../UnavailableBanner";

const DISCLAIMER =
  "This information is for educational and analytical purposes only. It is not financial advice, investment advice, or a recommendation to buy or sell any asset.";

function formatCountdown(dte: number): string {
  if (dte <= 0) return "Expired";
  if (dte < 1) return `${Math.round(dte * 24)}h`;
  return `${dte}d`;
}

function pinRiskColor(score: number): string {
  if (score >= 60) return "var(--data-red)";
  if (score >= 30) return "var(--data-yellow)";
  return "var(--accent-green)";
}

interface Props { asset: string }

export function MaxPainPinRiskView({ asset }: Props) {
  const { data, isLoading, unavailable, quantEngineConfigured } = useMaxPainPinRisk(asset);

  const nearExpiry = useMemo(() => {
    if (!data) return null;
    return data.expirations
      .filter((e) => e.daysToExpiry <= 7 && e.daysToExpiry >= 0)
      .sort((a, b) => a.daysToExpiry - b.daysToExpiry)[0] ?? null;
  }, [data]);

  if (isLoading) {
    return (
      <GlassCard>
        <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>Loading…</p>
      </GlassCard>
    );
  }
  if (unavailable || !data) {
    return <UnavailableBanner quantEngineConfigured={quantEngineConfigured} tool="Max Pain / Pin Risk" />;
  }

  return (
    <div className="h-full flex flex-col gap-3 overflow-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold font-display" style={{ color: "var(--text-primary)" }}>
          Max Pain &amp; Pin Risk — {asset}
        </h2>
        <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
          Spot ${data.spot.toLocaleString()}
        </span>
      </div>

      {nearExpiry && (
        <GlassCard>
          <div className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
            Nearest Expiry — High Pin Risk Alert
          </div>
          <div className="flex items-center gap-4">
            <div>
              <div className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>Max Pain</div>
              <div className="text-lg font-bold font-mono" style={{ color: "var(--data-yellow)" }}>
                {nearExpiry.maxPain != null ? `$${nearExpiry.maxPain.toLocaleString()}` : "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>DTE</div>
              <div className="text-lg font-bold font-mono" style={{ color: "var(--text-primary)" }}>
                {formatCountdown(nearExpiry.daysToExpiry)}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>Pin Risk</div>
              <div className="text-lg font-bold font-mono" style={{ color: pinRiskColor(nearExpiry.pinRiskScore) }}>
                {nearExpiry.pinRiskScore}/100
              </div>
            </div>
          </div>
          <p className="text-xs font-body mt-2" style={{ color: "var(--text-secondary)" }}>
            Price is near a high-open-interest strike close to expiration. This may increase the chance of price clustering near that level, depending on market conditions.
          </p>
        </GlassCard>
      )}

      <GlassCard>
        <div className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
          Max Pain by Expiration
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--glass-border)" }}>
                <th className="text-left py-1 pr-3">Expiry</th>
                <th className="text-right pr-3">DTE</th>
                <th className="text-right pr-3">Max Pain</th>
                <th className="text-right pr-3">Spot Dist %</th>
                <th className="text-right pr-3">Highest OI Strike</th>
                <th className="text-right">Pin Risk</th>
              </tr>
            </thead>
            <tbody>
              {data.expirations.map((e) => (
                <tr key={e.expiration} style={{ borderBottom: "1px solid rgba(148,163,184,0.07)" }}>
                  <td className="py-1 pr-3" style={{ color: "var(--text-primary)" }}>{e.expiration}</td>
                  <td className="text-right pr-3" style={{ color: "var(--text-secondary)" }}>
                    {formatCountdown(e.daysToExpiry)}
                  </td>
                  <td className="text-right pr-3" style={{ color: "var(--data-yellow)" }}>
                    {e.maxPain != null ? `$${e.maxPain.toLocaleString()}` : "—"}
                  </td>
                  <td className="text-right pr-3" style={{ color: "var(--text-secondary)" }}>
                    {e.spotDistancePct != null
                      ? `${e.spotDistancePct >= 0 ? "+" : ""}${e.spotDistancePct.toFixed(1)}%`
                      : "—"}
                  </td>
                  <td className="text-right pr-3" style={{ color: "var(--text-secondary)" }}>
                    {e.highestOiStrike != null ? `$${e.highestOiStrike.toLocaleString()}` : "—"}
                  </td>
                  <td className="text-right">
                    <span style={{ color: pinRiskColor(e.pinRiskScore) }}>
                      {e.pinRiskScore}
                    </span>
                    <div className="inline-block ml-1 align-middle rounded-sm overflow-hidden"
                      style={{ width: 30, height: 5, background: "var(--glass-border)" }}>
                      <div style={{
                        width: `${e.pinRiskScore}%`, height: "100%",
                        background: pinRiskColor(e.pinRiskScore),
                      }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <GlassCard>
        <p className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{DISCLAIMER}</p>
      </GlassCard>
    </div>
  );
}
