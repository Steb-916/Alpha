"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import type {
  FeatureSupport,
  RegimeFeatureVector,
} from "@/types/regime";

interface Props {
  featureVector: RegimeFeatureVector;
  featureSupport: FeatureSupport;
}

interface FeatureRow {
  key: keyof RegimeFeatureVector;
  label: string;
  formatter: (v: unknown) => string;
  tier: 1 | 2 | 3;
}

// Pretty-print helpers — unaware of regime context
function pct(v: unknown): string {
  return typeof v === "number" ? `${(v * 100).toFixed(0)}%` : "—";
}
function sign(v: unknown): string {
  if (typeof v !== "number") return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}`;
}
function num(v: unknown, digits = 2): string {
  return typeof v === "number" ? v.toFixed(digits) : "—";
}
function str(v: unknown): string {
  return typeof v === "string" ? v : "—";
}
function fractionPct(v: unknown): string {
  return typeof v === "number" ? `${(v * 100).toFixed(1)}%` : "—";
}

const TIER_1_ROWS: FeatureRow[] = [
  { key: "health_score", label: "Health score", formatter: (v) => num(v, 0), tier: 1 },
  { key: "funding_percentile_30d", label: "Funding pct 30d", formatter: pct, tier: 1 },
  { key: "oi_change_7d", label: "OI change 7d", formatter: fractionPct, tier: 1 },
  { key: "liquidation_intensity_24h", label: "Liq intensity 24h", formatter: pct, tier: 1 },
  { key: "basis_percentile", label: "Basis pct", formatter: pct, tier: 1 },
  { key: "mvrv_regime", label: "MVRV regime", formatter: str, tier: 1 },
];

const TIER_2_ROWS: FeatureRow[] = [
  { key: "iv_percentile", label: "IV percentile", formatter: pct, tier: 2 },
  { key: "skew_25d", label: "25d skew", formatter: sign, tier: 2 },
  { key: "vrp_sign", label: "VRP sign", formatter: str, tier: 2 },
];

const TIER_3_ROWS: FeatureRow[] = [
  { key: "gex_regime", label: "GEX regime", formatter: str, tier: 3 },
  { key: "flow_regime", label: "Flow regime", formatter: str, tier: 3 },
  { key: "whale_intensity_24h", label: "Whale intensity 24h", formatter: pct, tier: 3 },
];

function classifyRow(key: string, support: FeatureSupport): "supporting" | "neutral" | "conflicting" {
  if (support.supporting.includes(key)) return "supporting";
  if (support.conflicting.includes(key)) return "conflicting";
  return "neutral";
}

function supportBadge(
  status: "supporting" | "neutral" | "conflicting",
): { label: string; color: string } {
  if (status === "supporting") {
    return { label: "supports", color: "var(--data-green)" };
  }
  if (status === "conflicting") {
    return { label: "conflicts", color: "var(--data-red)" };
  }
  return { label: "neutral", color: "var(--text-muted)" };
}

function TierTable({
  title,
  subtitle,
  rows,
  fv,
  support,
}: {
  title: string;
  subtitle: string;
  rows: FeatureRow[];
  fv: RegimeFeatureVector;
  support: FeatureSupport;
}) {
  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-2">
        <div
          className="text-xs font-mono uppercase tracking-wider"
          style={{ color: "var(--text-primary)" }}
        >
          {title}
        </div>
        <div
          className="text-[10px] font-mono"
          style={{ color: "var(--text-muted)" }}
        >
          {subtitle}
        </div>
      </div>
      <table className="w-full text-xs font-mono">
        <thead>
          <tr
            style={{
              color: "var(--text-muted)",
              borderBottom: "1px solid var(--glass-border)",
            }}
          >
            <th className="text-left py-1 pr-3">Feature</th>
            <th className="text-right pr-3">Value</th>
            <th className="text-right">Support</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const value = fv[r.key];
            const status = classifyRow(r.key, support);
            const badge = supportBadge(status);
            return (
              <tr
                key={r.key}
                style={{ borderBottom: "1px solid rgba(148,163,184,0.07)" }}
              >
                <td className="py-1 pr-3" style={{ color: "var(--text-secondary)" }}>
                  {r.label}
                </td>
                <td
                  className="text-right pr-3"
                  style={{ color: "var(--text-primary)" }}
                >
                  {r.formatter(value)}
                </td>
                <td
                  className="text-right"
                  style={{ color: badge.color }}
                >
                  {badge.label}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </GlassCard>
  );
}

export function FeatureContributionsPanel({ featureVector, featureSupport }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      <TierTable
        title="Derivatives (Tier 1)"
        subtitle="primary weight"
        rows={TIER_1_ROWS}
        fv={featureVector}
        support={featureSupport}
      />
      <TierTable
        title="Options (Tier 2)"
        subtitle="secondary weight"
        rows={TIER_2_ROWS}
        fv={featureVector}
        support={featureSupport}
      />
      <TierTable
        title="On-chain / flow (Tier 3)"
        subtitle="modifier weight"
        rows={TIER_3_ROWS}
        fv={featureVector}
        support={featureSupport}
      />
    </div>
  );
}
