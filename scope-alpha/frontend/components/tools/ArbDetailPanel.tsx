"use client";

import type { ArbOpportunity } from "@/lib/analytics/arb-scanner";
import { PositionCalculator } from "@/components/tools/PositionCalculator";
import { formatPercent, formatFundingRate } from "@/lib/utils";

interface ArbDetailPanelProps {
  opportunity: ArbOpportunity;
}

export function ArbDetailPanel({ opportunity }: ArbDetailPanelProps) {
  const lineColor =
    opportunity.riskScore === "low"
      ? "var(--accent-green)"
      : opportunity.riskScore === "medium"
        ? "var(--data-yellow)"
        : "var(--data-red)";

  return (
    <div className="grid grid-cols-2 gap-3 py-3">
      <div>
        <div
          className="text-xs font-bold font-mono uppercase tracking-wider mb-3"
          style={{ color: "var(--text-muted)" }}
        >
          Leg Details
        </div>
        <div className="space-y-2 text-xs font-mono">
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--text-muted)" }}>Asset</span>
            <span style={{ color: "var(--text-primary)" }}>{opportunity.asset}</span>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--text-muted)" }}>Type</span>
            <span style={{ color: "var(--text-primary)" }}>{opportunity.type}</span>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--text-muted)" }}>Long on</span>
            <span
              className="uppercase"
              style={{ color: "var(--accent-green)" }}
            >
              {opportunity.longExchange}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--text-muted)" }}>Short on</span>
            <span
              className="uppercase"
              style={{ color: "var(--data-red)" }}
            >
              {opportunity.shortExchange}
            </span>
          </div>
          {opportunity.type === "funding" && (
            <>
              <div className="flex items-center justify-between">
                <span style={{ color: "var(--text-muted)" }}>Long rate</span>
                <span>
                  {formatFundingRate(opportunity.longRate ?? 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ color: "var(--text-muted)" }}>Short rate</span>
                <span>{formatFundingRate(opportunity.shortRate ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ color: "var(--text-muted)" }}>Net rate / 8h</span>
                <span>{formatFundingRate(opportunity.netRate ?? 0)}</span>
              </div>
            </>
          )}
          {opportunity.type === "basis" && (
            <div className="flex items-center justify-between">
              <span style={{ color: "var(--text-muted)" }}>Basis diff</span>
              <span>{formatPercent(opportunity.basisDiff ?? 0, true)}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--text-muted)" }}>Gross annualized</span>
            <span style={{ color: "var(--accent-green)" }}>
              {formatPercent(opportunity.annualizedYield, true)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--text-muted)" }}>Fees</span>
            <span style={{ color: "var(--data-red)" }}>
              −{opportunity.estimatedFees.toFixed(2)}%
            </span>
          </div>
          <div className="flex items-center justify-between pt-2" style={{ borderTop: "1px solid var(--glass-border)" }}>
            <span style={{ color: "var(--text-secondary)" }}>Net yield</span>
            <span style={{ color: lineColor }}>
              {formatPercent(opportunity.netYieldAfterFees, true)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--text-muted)" }}>Spread stability</span>
            <span>{(opportunity.spreadStability * 100).toFixed(0)}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--text-muted)" }}>Spread z-score</span>
            <span>{opportunity.spreadZScore.toFixed(2)}</span>
          </div>
        </div>
      </div>
      <PositionCalculator annualizedYieldPct={opportunity.netYieldAfterFees} />
    </div>
  );
}
