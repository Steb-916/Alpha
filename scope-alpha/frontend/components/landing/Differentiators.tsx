"use client";

import { Zap, Layers, Sparkles } from "lucide-react";

const POINTS = [
  {
    icon: Layers,
    title: "Cross-domain synthesis",
    body: "Derivatives, options, and on-chain data in one view. Regime classification and convergence scoring are computed from all three domains — not just one.",
  },
  {
    icon: Sparkles,
    title: "Proprietary quant tools",
    body: "Risk-neutral density curves, vol cone percentiles, CVD divergence detection, liquidation heatmaps, and cross-exchange arb scoring — validated in Python, shipped to the browser.",
  },
  {
    icon: Zap,
    title: "Real-time data",
    body: "Binance, Bybit, and Deribit WebSocket streams feed the terminal in sub-second time. No delayed feeds, no 15-minute stale data, no tier upgrades.",
  },
];

export function Differentiators() {
  return (
    <section
      className="px-6 py-16 max-w-6xl mx-auto"
      style={{ borderTop: "1px solid var(--glass-border)" }}
    >
      <div className="text-center mb-10">
        <h2
          className="text-2xl md:text-3xl font-bold font-display mb-3"
          style={{ color: "var(--text-primary)" }}
        >
          What makes Scope Alpha different
        </h2>
        <p
          className="text-sm md:text-base font-body"
          style={{ color: "var(--text-secondary)" }}
        >
          Institutional-grade tooling without an institutional price tag.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {POINTS.map((p) => {
          const Icon = p.icon;
          return (
            <div key={p.title} className="text-left">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center mb-4"
                style={{
                  background: "rgba(0, 212, 170, 0.1)",
                  border: "1px solid var(--accent-green)",
                }}
              >
                <Icon
                  size={18}
                  strokeWidth={1.75}
                  style={{ color: "var(--accent-green)" }}
                />
              </div>
              <div
                className="text-lg font-bold font-display mb-2"
                style={{ color: "var(--text-primary)" }}
              >
                {p.title}
              </div>
              <p
                className="text-sm font-body leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
              >
                {p.body}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
