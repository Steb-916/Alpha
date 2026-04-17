"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import {
  Activity,
  ArrowLeftRight,
  BarChart3,
  Brain,
  Globe,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";

type Status = "live" | "soon";

interface Feature {
  title: string;
  description: string;
  status: Status;
  icon: LucideIcon;
}

const FEATURES: Feature[] = [
  {
    title: "Derivatives Terminal",
    description:
      "Real-time funding rates, open interest, liquidations, basis analysis, and a multi-asset screener across major exchanges.",
    status: "live",
    icon: BarChart3,
  },
  {
    title: "Volatility & Options",
    description:
      "Implied vol surface, risk-neutral density, skew, volatility cone, and VRP — powered by Deribit and our quant engine.",
    status: "live",
    icon: Activity,
  },
  {
    title: "Arb Scanner",
    description:
      "Cross-exchange funding-rate and basis arbitrage opportunities scored by spread stability and net yield after fees.",
    status: "live",
    icon: ArrowLeftRight,
  },
  {
    title: "On-Chain Intelligence",
    description:
      "Exchange flows, MVRV z-score, SOPR, whale tracking, stablecoin flows, and supply dynamics across major chains.",
    status: "soon",
    icon: Globe,
  },
  {
    title: "Quantitative Tools",
    description:
      "Custom multi-factor screener and visual strategy backtester across all data domains. No coding required.",
    status: "soon",
    icon: Brain,
  },
  {
    title: "Macro & Sentiment",
    description:
      "Cross-asset correlations, ETF flows, market regime classification, and sentiment-price divergence detection.",
    status: "soon",
    icon: MessageCircle,
  },
];

function StatusBadge({ status }: { status: Status }) {
  const label = status === "live" ? "LIVE" : "COMING SOON";
  const color =
    status === "live" ? "var(--accent-green)" : "var(--data-yellow)";
  return (
    <span
      className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-[var(--radius-pill)]"
      style={{
        background: `${color}22`,
        color,
        border: `1px solid ${color}55`,
      }}
    >
      {label}
    </span>
  );
}

export function FeatureCards() {
  return (
    <section className="px-6 py-16 max-w-6xl mx-auto">
      <div className="text-center mb-10">
        <h2
          className="text-2xl md:text-3xl font-bold font-display mb-3"
          style={{ color: "var(--text-primary)" }}
        >
          One platform, every domain
        </h2>
        <p
          className="text-sm md:text-base font-body"
          style={{ color: "var(--text-secondary)" }}
        >
          Derivatives, options, on-chain, macro, sentiment — synthesized, not
          siloed.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {FEATURES.map((feature) => {
          const Icon = feature.icon;
          return (
            <GlassCard key={feature.title} className="text-left">
              <div className="flex items-center justify-between mb-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{
                    background: "var(--glass-bg)",
                    border: "1px solid var(--glass-border)",
                  }}
                >
                  <Icon
                    size={16}
                    strokeWidth={1.75}
                    style={{
                      color:
                        feature.status === "live"
                          ? "var(--accent-green)"
                          : "var(--text-muted)",
                    }}
                  />
                </div>
                <StatusBadge status={feature.status} />
              </div>
              <div
                className="text-base font-bold font-display mb-2"
                style={{ color: "var(--text-primary)" }}
              >
                {feature.title}
              </div>
              <div
                className="text-sm font-body leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
              >
                {feature.description}
              </div>
            </GlassCard>
          );
        })}
      </div>
    </section>
  );
}
