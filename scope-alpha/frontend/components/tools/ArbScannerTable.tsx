"use client";

import { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { useArbScanner } from "@/hooks/useArbScanner";
import { ArbDetailPanel } from "@/components/tools/ArbDetailPanel";
import type { ArbOpportunity, ArbRisk } from "@/lib/analytics/arb-scanner";
import { formatPercent } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

function riskColor(r: ArbRisk): string {
  if (r === "low") return "var(--accent-green)";
  if (r === "medium") return "var(--data-yellow)";
  return "var(--data-red)";
}

function StabilityBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value * 100));
  return (
    <div
      className="w-16 h-1.5 rounded overflow-hidden"
      style={{ background: "var(--glass-bg)" }}
    >
      <div
        className="h-full rounded"
        style={{
          width: `${pct}%`,
          background:
            pct > 70
              ? "var(--accent-green)"
              : pct > 50
                ? "var(--data-yellow)"
                : "var(--data-red)",
        }}
      />
    </div>
  );
}

export function ArbScannerTable() {
  const { data, isLoading } = useArbScanner();
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  if (isLoading && !data) {
    return (
      <GlassCard>
        <p
          className="text-sm font-mono"
          style={{ color: "var(--text-muted)" }}
        >
          Scanning for opportunities…
        </p>
      </GlassCard>
    );
  }

  const opportunities = data?.opportunities ?? [];

  return (
    <div className="space-y-3">
      <div
        className="text-[11px] font-mono"
        style={{ color: "var(--text-muted)" }}
      >
        Scanned {data?.assetsScanned ?? 0} assets · {opportunities.length}{" "}
        opportunities found · sorted by net yield after fees
      </div>

      <GlassCard noPadding>
        <div className="overflow-x-auto">
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
                  Asset
                </th>
                <th
                  className="text-left py-2 px-3 text-[10px] uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  Type
                </th>
                <th
                  className="text-left py-2 px-3 text-[10px] uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  Long
                </th>
                <th
                  className="text-left py-2 px-3 text-[10px] uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  Short
                </th>
                <th
                  className="text-right py-2 px-3 text-[10px] uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  Gross Ann.
                </th>
                <th
                  className="text-right py-2 px-3 text-[10px] uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  Net Ann.
                </th>
                <th
                  className="text-center py-2 px-3 text-[10px] uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  Stability
                </th>
                <th
                  className="text-center py-2 px-3 text-[10px] uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  Risk
                </th>
                <th className="py-2 px-3" />
              </tr>
            </thead>
            <tbody>
              {opportunities.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="py-6 text-center text-xs font-mono"
                    style={{ color: "var(--text-muted)" }}
                  >
                    No opportunities exceeding thresholds right now. Check back
                    in a minute.
                  </td>
                </tr>
              )}
              {opportunities.map((op, i) => {
                const key = `${op.asset}-${op.type}-${i}`;
                const isExpanded = expandedKey === key;
                return renderOpportunityRow({
                  key,
                  op,
                  isExpanded,
                  toggle: () =>
                    setExpandedKey(isExpanded ? null : key),
                });
              })}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <p
        className="text-[10px] font-mono"
        style={{ color: "var(--text-muted)" }}
      >
        This tool shows funding rate differentials between exchanges. It does
        not constitute financial advice. Executing arbitrage involves
        counterparty risk, execution risk, and potential for liquidation.
      </p>
    </div>
  );
}

function renderOpportunityRow(args: {
  key: string;
  op: ArbOpportunity;
  isExpanded: boolean;
  toggle: () => void;
}) {
  const { key, op, isExpanded, toggle } = args;

  return (
    <>
      <tr
        key={key}
        onClick={toggle}
        className="cursor-pointer"
        style={{
          borderBottom: "1px solid var(--glass-border)",
          background: isExpanded ? "var(--glass-bg-hover)" : "transparent",
        }}
      >
        <td
          className="py-2 px-3 font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          {op.asset}
        </td>
        <td
          className="py-2 px-3 uppercase"
          style={{ color: "var(--text-muted)" }}
        >
          {op.type}
        </td>
        <td
          className="py-2 px-3 uppercase"
          style={{ color: "var(--accent-green)" }}
        >
          {op.longExchange}
        </td>
        <td
          className="py-2 px-3 uppercase"
          style={{ color: "var(--data-red)" }}
        >
          {op.shortExchange}
        </td>
        <td className="py-2 px-3 text-right">
          {formatPercent(op.annualizedYield, true)}
        </td>
        <td
          className="py-2 px-3 text-right font-semibold"
          style={{ color: riskColor(op.riskScore) }}
        >
          {formatPercent(op.netYieldAfterFees, true)}
        </td>
        <td className="py-2 px-3 flex items-center justify-center">
          <StabilityBar value={op.spreadStability} />
        </td>
        <td className="py-2 px-3 text-center">
          <span
            className="px-1.5 py-0.5 rounded-[var(--radius-pill)] text-[10px] uppercase"
            style={{
              background: "var(--glass-bg)",
              color: riskColor(op.riskScore),
              border: `1px solid ${riskColor(op.riskScore)}`,
            }}
          >
            {op.riskScore}
          </span>
        </td>
        <td className="py-2 px-3 text-right">
          <ChevronDown
            size={14}
            strokeWidth={1.75}
            style={{
              color: "var(--text-muted)",
              transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease",
            }}
          />
        </td>
      </tr>
      {isExpanded && (
        <tr key={`${key}-detail`}>
          <td
            colSpan={9}
            style={{
              background: "var(--glass-bg)",
              borderBottom: "1px solid var(--glass-border)",
            }}
          >
            <div className="px-3">
              <ArbDetailPanel opportunity={op} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
