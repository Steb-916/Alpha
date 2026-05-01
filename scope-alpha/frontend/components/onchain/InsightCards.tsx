"use client";

import useSWR from "swr";
import Link from "next/link";
import type { InsightCard } from "@/lib/onchain/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function severityStyle(severity: InsightCard["severity"]): { border: string; bg: string; badge: string } {
  if (severity === "high") return {
    border: "var(--data-red)",
    bg: "rgba(239,68,68,0.06)",
    badge: "var(--data-red)",
  };
  if (severity === "medium") return {
    border: "var(--data-yellow)",
    bg: "rgba(234,179,8,0.06)",
    badge: "var(--data-yellow)",
  };
  return {
    border: "var(--accent-green)",
    bg: "rgba(0,212,170,0.06)",
    badge: "var(--accent-green)",
  };
}

function typeIcon(type: InsightCard["type"]): string {
  if (type === "distribution") return "↑ Distribution";
  if (type === "accumulation") return "↓ Accumulation";
  if (type === "squeeze_risk") return "⚡ Squeeze Risk";
  return "◈ Signal";
}

function tabForType(type: InsightCard["type"]): string {
  if (type === "squeeze_risk") return "flows";
  if (type === "distribution" || type === "accumulation") return "valuation";
  return "overview";
}

interface Props {
  asset: string;
}

export function InsightCards({ asset }: Props) {
  const { data, isLoading } = useSWR<InsightCard[]>(
    `/api/market/onchain/insights?asset=${asset}`,
    fetcher,
    { refreshInterval: 15 * 60 * 1000 },
  );

  if (isLoading || !data || !Array.isArray(data) || data.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 mb-3">
      <div className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
        Cross-Domain Insights
      </div>
      <div className="grid grid-cols-1 gap-2">
        {data.map((card) => {
          const style = severityStyle(card.severity);
          return (
            <Link
              key={card.id}
              href={`/terminal/onchain?view=${tabForType(card.type)}`}
              className="block rounded-[var(--radius-sm)] px-4 py-3 transition-opacity hover:opacity-80"
              style={{
                background: style.bg,
                border: `1px solid ${style.border}`,
              }}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="text-xs font-bold font-display" style={{ color: "var(--text-primary)" }}>
                  {card.title}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <span
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded-full"
                    style={{ color: style.badge, background: `${style.badge}20`, border: `1px solid ${style.badge}` }}
                  >
                    {typeIcon(card.type)}
                  </span>
                  <span
                    className="text-[10px] font-mono uppercase"
                    style={{ color: style.badge }}
                  >
                    {card.severity}
                  </span>
                </div>
              </div>
              <p className="text-[11px] font-body mb-2" style={{ color: "var(--text-secondary)" }}>
                {card.description}
              </p>
              <div className="flex flex-wrap gap-1">
                {card.signals.map((sig, i) => (
                  <span
                    key={i}
                    className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                    style={{ background: "var(--glass-bg)", color: "var(--text-muted)", border: "1px solid var(--glass-border)" }}
                  >
                    {sig}
                  </span>
                ))}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
