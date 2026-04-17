"use client";

import { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { formatPercent } from "@/lib/utils";

interface PositionCalculatorProps {
  annualizedYieldPct: number;
}

export function PositionCalculator({
  annualizedYieldPct,
}: PositionCalculatorProps) {
  const [capital, setCapital] = useState(10000);
  const [leverage, setLeverage] = useState(3);

  const effective = capital * leverage;
  const yearly = (effective * annualizedYieldPct) / 100;
  const monthly = yearly / 12;

  return (
    <GlassCard>
      <div
        className="text-xs font-bold font-mono uppercase tracking-wider mb-3"
        style={{ color: "var(--text-muted)" }}
      >
        Position Calculator
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <label className="block">
          <span
            className="text-[10px] font-mono uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            Capital ($)
          </span>
          <input
            type="number"
            value={capital}
            onChange={(e) => setCapital(parseFloat(e.target.value) || 0)}
            min={0}
            step={100}
            className="w-full mt-1 px-3 py-2 text-sm font-mono rounded-[var(--radius-sm)] outline-none"
            style={{
              background: "var(--glass-bg)",
              border: "1px solid var(--glass-border)",
              color: "var(--text-primary)",
            }}
          />
        </label>
        <label className="block">
          <span
            className="text-[10px] font-mono uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            Leverage
          </span>
          <input
            type="number"
            value={leverage}
            onChange={(e) => setLeverage(parseFloat(e.target.value) || 1)}
            min={1}
            max={20}
            step={0.5}
            className="w-full mt-1 px-3 py-2 text-sm font-mono rounded-[var(--radius-sm)] outline-none"
            style={{
              background: "var(--glass-bg)",
              border: "1px solid var(--glass-border)",
              color: "var(--text-primary)",
            }}
          />
        </label>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <div
            className="text-[10px] font-mono uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            Effective notional
          </div>
          <div
            className="text-sm font-bold font-mono"
            style={{ color: "var(--text-primary)" }}
          >
            ${effective.toLocaleString()}
          </div>
        </div>
        <div>
          <div
            className="text-[10px] font-mono uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            Projected / month
          </div>
          <div
            className="text-sm font-bold font-mono"
            style={{ color: "var(--accent-green)" }}
          >
            ${monthly.toFixed(2)}
          </div>
        </div>
        <div>
          <div
            className="text-[10px] font-mono uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            Projected / year
          </div>
          <div
            className="text-sm font-bold font-mono"
            style={{ color: "var(--accent-green)" }}
          >
            ${yearly.toFixed(2)}
          </div>
        </div>
      </div>
      <p
        className="text-[10px] font-mono mt-3"
        style={{ color: "var(--text-muted)" }}
      >
        Yield of {formatPercent(annualizedYieldPct, true)} assumed; does not
        account for liquidation risk, funding variance, or exchange fees beyond
        the round-trip estimate.
      </p>
    </GlassCard>
  );
}
